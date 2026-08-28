/*
# Hilos de conversación separados por personalidad + nombres personalizados

## Propósito
Hoy los tres modos de personalidad (Espejo/Amigo/Acompañante, ver
supabase/functions/ai-chat/index.ts) solo cambian el prompt de sistema, pero
la IA sigue viendo el MISMO historial de chat_logs sin importar el modo — así
que cambiar de modo nunca se siente como hablar con alguien distinto, porque
quien responde sigue "recordando" todo lo que se dijo bajo la personalidad
anterior, y en la interfaz es la misma conversación continua. Se pidió que
cada modo se sienta como una persona totalmente aparte: su propio hilo,
sin memoria de los otros modos, e idealmente con su propio nombre.

## 1. `chat_logs.mode`
Columna nueva, nullable (NULL = hilo por defecto de Calivia, el de siempre).
Cada modo (`espejo`/`amigo`/`acompanante`) escribe y lee únicamente su propio
hilo — tanto el frontend (al listar y al insertar el mensaje del usuario)
como la Edge Function (al armar el historial que le manda a la IA y al
guardar la respuesta) filtran por esta columna. Así, cambiar de modo
"resetea" la conversación visible y el contexto que ve el modelo, sin borrar
nada — el hilo anterior sigue ahí si se vuelve a ese modo.

## 2. `profiles.persona_name_*`
Un nombre personalizado opcional por modo (si se deja vacío, se usa el
nombre genérico del modo — "Espejo"/"Amigo"/"Acompañante" — como hasta
ahora). Se edita desde ProfileSettingsModal. La Edge Function lo inyecta en
el prompt de sistema de ese modo para que la IA se presente con ese nombre.

## 3. RPCs de sesión
`register_profile`, `login_profile` y `resolve_session` se actualizan para
devolver también los 3 nombres nuevos, junto con TODOS los campos que ya
devolvían (ver 20260828000000_fix_session_rpcs_dropped_avatar_and_specialist_fields.sql
— la causa raíz de aquel bug fue justamente una migración que olvidó
arrastrar campos ya existentes al recrear estas funciones, así que acá se
copian explícitamente todos para no repetir el error).
*/

ALTER TABLE public.chat_logs
  ADD COLUMN IF NOT EXISTS mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_logs_mode_check'
  ) THEN
    ALTER TABLE public.chat_logs
      ADD CONSTRAINT chat_logs_mode_check
      CHECK (mode IS NULL OR mode IN ('espejo', 'amigo', 'acompanante'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chat_logs_user_mode_created_idx
  ON public.chat_logs (user_id, mode, created_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS persona_name_espejo text,
  ADD COLUMN IF NOT EXISTS persona_name_amigo text,
  ADD COLUMN IF NOT EXISTS persona_name_acompanante text;

DROP FUNCTION IF EXISTS public.register_profile(text, text, text);
DROP FUNCTION IF EXISTS public.login_profile(text, text);
DROP FUNCTION IF EXISTS public.resolve_session(uuid);

CREATE OR REPLACE FUNCTION public.register_profile(p_name text, p_password text, p_role text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  avatar_path text, phone text, license_number text, bio text,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text,
  persona_name_espejo text, persona_name_amigo text, persona_name_acompanante text,
  session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name text := trim(p_name);
  v_role text := coalesce(p_role, 'patient');
  v_id uuid;
  v_token uuid;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'El nombre no puede estar vacío';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;
  IF v_role NOT IN ('patient', 'psychologist') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(trim(p.full_name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'Ese nombre ya está en uso';
  END IF;

  INSERT INTO public.profiles (full_name, role, password_hash)
  VALUES (v_name, v_role, crypt(p_password, gen_salt('bf')))
  RETURNING profiles.id INTO v_id;

  INSERT INTO public.sessions (user_id) VALUES (v_id) RETURNING token INTO v_token;

  RETURN QUERY
    SELECT p.id, p.full_name, p.role, p.country,
           (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
           p.created_at,
           p.avatar_path, p.phone, p.license_number, p.bio,
           p.preferred_name, p.occupation, p.terms_accepted_at, p.terms_version,
           p.persona_name_espejo, p.persona_name_amigo, p.persona_name_acompanante, v_token
    FROM public.profiles p WHERE p.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_profile(p_name text, p_password text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  avatar_path text, phone text, license_number text, bio text,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text,
  persona_name_espejo text, persona_name_amigo text, persona_name_acompanante text,
  session_token uuid
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

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country,
                      (v_row.is_premium AND (v_row.premium_until IS NULL OR v_row.premium_until > now())),
                      v_row.created_at,
                      v_row.avatar_path, v_row.phone, v_row.license_number, v_row.bio,
                      v_row.preferred_name, v_row.occupation, v_row.terms_accepted_at, v_row.terms_version,
                      v_row.persona_name_espejo, v_row.persona_name_amigo, v_row.persona_name_acompanante, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_session(p_token uuid)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  avatar_path text, phone text, license_number text, bio text,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text,
  persona_name_espejo text, persona_name_amigo text, persona_name_acompanante text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.country,
         (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
         p.created_at,
         p.avatar_path, p.phone, p.license_number, p.bio,
         p.preferred_name, p.occupation, p.terms_accepted_at, p.terms_version,
         p.persona_name_espejo, p.persona_name_amigo, p.persona_name_acompanante
  FROM public.sessions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_session(uuid) TO anon;
