/*
# Rate limiting infrastructure + login brute-force protection

## Purpose
Cierra dos huecos de seguridad reales encontrados al revisar el sistema:

1. Ninguna Edge Function verificaba que el `userId` recibido en el body
   perteneciera de verdad a quien hace la llamada — usan la service role key
   (que se salta RLS), así que cualquiera con la anon key pública (que va
   embebida en el bundle del cliente, no es secreta) podía escribir chat_logs,
   entradas de journal o tareas a nombre de OTRO usuario con solo mandar su
   UUID. El fix de código vive en supabase/functions/_shared/security.ts
   (resolveSession) y se aplica en cada función; esta migración es la parte
   de datos que lo respalda.
2. `login_profile` no tenía ningún límite de intentos: se podía intentar
   fuerza bruta contra una cuenta específica sin restricción (el hash bcrypt
   hace cada intento lento, pero nada impedía intentos en paralelo).

## Changes
- Tabla `rate_limits`: contador simple por clave + ventana de tiempo.
- Función `check_rate_limit(key, max_per_window, window_seconds)`: upsert
  atómico (single statement, sin condición de carrera entre llamadas
  concurrentes para la misma clave) que devuelve si la petición está dentro
  del límite.
- `login_profile` ahora llama a `check_rate_limit` antes de verificar la
  contraseña: máximo 10 intentos cada 5 minutos POR NOMBRE intentado (no por
  IP — así no se puede eludir con múltiples IPs contra la misma cuenta).
*/

-- 1. Tabla de contadores
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: solo se accede vía check_rate_limit()
-- (SECURITY DEFINER) o directamente con la service role key desde las Edge
-- Functions, ninguna de las dos pasa por RLS.

-- 2. Función de límite: upsert atómico. La cláusula ON CONFLICT DO UPDATE
-- toma el lock de fila del índice único de `key`, así que dos llamadas
-- concurrentes para la MISMA clave nunca pisan el conteo de la otra —
-- distintas claves no compiten entre sí en absoluto.
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max_per_window integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
        THEN now()
      ELSE public.rate_limits.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_per_window;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO anon, service_role;

-- 3. login_profile: máximo 10 intentos cada 5 minutos por nombre intentado.
CREATE OR REPLACE FUNCTION public.login_profile(p_name text, p_password text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  preferred_name text, occupation text, session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
  v_token uuid;
BEGIN
  IF NOT public.check_rate_limit('login:' || lower(trim(p_name)), 10, 300) THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  END IF;

  SELECT * INTO v_row FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name))
    LIMIT 1;

  IF NOT FOUND OR v_row.password_hash IS NULL
     OR v_row.password_hash <> crypt(p_password, v_row.password_hash) THEN
    RAISE EXCEPTION 'Nombre o contraseña incorrectos';
  END IF;

  INSERT INTO public.sessions (user_id) VALUES (v_row.id) RETURNING token INTO v_token;

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country, v_row.is_premium, v_row.created_at,
                      v_row.preferred_name, v_row.occupation, v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon;
