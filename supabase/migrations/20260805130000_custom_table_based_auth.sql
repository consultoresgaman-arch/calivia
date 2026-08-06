/*
# Autenticación propia basada en tabla (reemplaza supabase.auth)

## Propósito
Elimina la dependencia de Supabase Auth (GoTrue) para evitar por completo los
límites de envío de correo, ya que el login ahora es solo nombre + contraseña
y nunca existió un correo real que confirmar. `profiles` pasa a ser la única
fuente de verdad de identidad; ya no depende de `auth.users`.

## 1. Cambios en `profiles`
- Se quita la FK hacia `auth.users` y el id ahora se genera con
  `gen_random_uuid()` (antes venía de `auth.users.id`).
- Se agrega `password_hash` (bcrypt vía `pgcrypto`, nunca texto plano).
- Se elimina la columna `email` (ya no se usa para nada).
- `full_name` pasa a ser el identificador de login: se crea un índice único
  sobre su versión normalizada (minúsculas, sin espacios extra). Antes de
  crear el índice se renombran duplicados existentes para no romper la
  migración con datos de prueba previos.

## 2. Tabla nueva `sessions`
- Reemplaza la sesión de Supabase Auth por un token de sesión propio
  (uuid aleatorio, no adivinable). RLS está activo y SIN políticas: nadie
  puede leer/escribir esta tabla directamente vía la API pública, solo las
  funciones `SECURITY DEFINER` de abajo (que al ser dueñas de la tabla
  evitan RLS internamente).

## 3. Funciones `SECURITY DEFINER`
- `register_profile` / `login_profile`: crean el hash con `crypt()` /
  lo verifican, y devuelven el perfil + un `session_token` nuevo.
- `resolve_session`: dado un token, devuelve el perfil si la sesión es válida
  (usada al recargar la app para restaurar sesión).
- `logout_session`: borra el token (cierre de sesión).
- `current_session_user_id`: helper usado DENTRO de las políticas RLS de
  todas las tablas para saber "quién soy", leyendo el header personalizado
  `x-session-token` que el cliente manda en cada request (PostgREST expone
  los headers de la request vía `current_setting('request.headers', true)`).

## 4. Políticas RLS reescritas
Como ya no existe una sesión real de Supabase Auth, cada request llega con
el rol `anon` (la anon key), nunca `authenticated`. Todas las políticas de
`profiles`, `checkins`, `chat_logs`, `ai_reports` y `trusted_contacts` se
reescriben para el rol `anon`, comparando contra
`current_session_user_id()` en vez de `auth.uid()`. El nivel de privacidad
(cada quien ve solo lo suyo, el psicólogo ve a todos los pacientes) se
mantiene igual que antes.

También se corrigen las FK de `checkins`, `chat_logs`, `ai_reports` y
`trusted_contacts`, que apuntaban a `auth.users(id)`, para que apunten a
`public.profiles(id)` — ya no existirá una fila en `auth.users` para los
nuevos registros.

## 5. Notas de seguridad
- El trigger `protect_premium_columns` (creado en la migración anterior)
  usaba `auth.role() = 'authenticated'` para bloquear cambios de
  `is_premium` desde el cliente. Como ahora el cliente siempre es `anon`,
  se corrige a `auth.role() <> 'service_role'`, que sigue bloqueando al
  cliente y sigue permitiendo al webhook de Lemon Squeezy (que usa la
  service role key) marcar premium.
*/

-- ===== 1. profiles =====

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Renombra duplicados de nombre normalizado antes de forzar unicidad,
-- para no romper la migración con datos de prueba previos a este cambio.
WITH dupes AS (
  SELECT id, row_number() OVER (
    PARTITION BY lower(trim(full_name)) ORDER BY created_at
  ) AS rn
  FROM public.profiles
  WHERE full_name IS NOT NULL AND trim(full_name) <> ''
)
UPDATE public.profiles p
SET full_name = p.full_name || '-' || substr(p.id::text, 1, 4)
FROM dupes d
WHERE p.id = d.id AND d.rn > 1;

DROP INDEX IF EXISTS profiles_name_key_idx;
CREATE UNIQUE INDEX profiles_name_key_idx ON public.profiles (lower(trim(full_name)));

-- ===== 2. sessions =====

CREATE TABLE IF NOT EXISTS public.sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: el acceso solo pasa por las funciones de abajo.

-- ===== 3. Funciones SECURITY DEFINER =====

CREATE OR REPLACE FUNCTION public.current_session_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.user_id FROM public.sessions s
  WHERE s.token = NULLIF(
    current_setting('request.headers', true)::json ->> 'x-session-token', ''
  )::uuid
  AND s.expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.register_profile(p_name text, p_password text, p_role text)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz, session_token uuid)
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
    SELECT p.id, p.full_name, p.role, p.country, p.is_premium, p.created_at, v_token
    FROM public.profiles p WHERE p.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_profile(p_name text, p_password text)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz, session_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO v_row FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name))
    LIMIT 1;

  IF NOT FOUND OR v_row.password_hash IS NULL
     OR v_row.password_hash <> crypt(p_password, v_row.password_hash) THEN
    RAISE EXCEPTION 'Nombre o contraseña incorrectos';
  END IF;

  INSERT INTO public.sessions (user_id) VALUES (v_row.id) RETURNING token INTO v_token;

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country, v_row.is_premium, v_row.created_at, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_session(p_token uuid)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.country, p.is_premium, p.created_at
  FROM public.sessions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.logout_session(p_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.sessions WHERE token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_session(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.logout_session(uuid) TO anon;

-- ===== 4. FKs hacia profiles en vez de auth.users =====

ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_user_id_fkey;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.checkins ALTER COLUMN user_id SET DEFAULT public.current_session_user_id();

ALTER TABLE public.chat_logs DROP CONSTRAINT IF EXISTS chat_logs_user_id_fkey;
ALTER TABLE public.chat_logs ADD CONSTRAINT chat_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chat_logs ALTER COLUMN user_id SET DEFAULT public.current_session_user_id();

ALTER TABLE public.ai_reports DROP CONSTRAINT IF EXISTS ai_reports_user_id_fkey;
ALTER TABLE public.ai_reports ADD CONSTRAINT ai_reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.ai_reports ALTER COLUMN user_id SET DEFAULT public.current_session_user_id();

ALTER TABLE public.trusted_contacts DROP CONSTRAINT IF EXISTS trusted_contacts_user_id_fkey;
ALTER TABLE public.trusted_contacts ADD CONSTRAINT trusted_contacts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.trusted_contacts ALTER COLUMN user_id SET DEFAULT public.current_session_user_id();

-- ===== 5. is_psychologist ahora se invoca con current_session_user_id() =====
-- (la función en sí no cambia de firma, solo quién la llama)

-- ===== 6. Políticas RLS: de auth.uid()/authenticated a current_session_user_id()/anon =====

-- --- profiles ---
DROP POLICY IF EXISTS "profiles_select_own_or_psychologist" ON public.profiles;
CREATE POLICY "profiles_select_own_or_psychologist"
ON public.profiles FOR SELECT
TO anon
USING (
  id = public.current_session_user_id()
  OR (public.is_psychologist(public.current_session_user_id()) AND role = 'patient')
);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
-- Ya no hace falta: el registro pasa exclusivamente por register_profile().

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO anon
USING (id = public.current_session_user_id())
WITH CHECK (id = public.current_session_user_id());

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
ON public.profiles FOR DELETE
TO anon
USING (id = public.current_session_user_id());

-- --- checkins ---
DROP POLICY IF EXISTS "checkins_select_own_or_psychologist" ON public.checkins;
CREATE POLICY "checkins_select_own_or_psychologist"
ON public.checkins FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_psychologist(public.current_session_user_id())
);

DROP POLICY IF EXISTS "checkins_insert_own" ON public.checkins;
CREATE POLICY "checkins_insert_own"
ON public.checkins FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "checkins_update_own" ON public.checkins;
CREATE POLICY "checkins_update_own"
ON public.checkins FOR UPDATE
TO anon
USING (user_id = public.current_session_user_id())
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "checkins_delete_own" ON public.checkins;
CREATE POLICY "checkins_delete_own"
ON public.checkins FOR DELETE
TO anon
USING (user_id = public.current_session_user_id());

-- --- chat_logs ---
DROP POLICY IF EXISTS "select_own_chat_logs" ON public.chat_logs;
DROP POLICY IF EXISTS "select_all_chat_logs_for_psychologist" ON public.chat_logs;
DROP POLICY IF EXISTS "chat_logs_select_own_or_psychologist" ON public.chat_logs;
CREATE POLICY "chat_logs_select_own_or_psychologist"
ON public.chat_logs FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_psychologist(public.current_session_user_id())
);

DROP POLICY IF EXISTS "insert_own_chat_logs" ON public.chat_logs;
CREATE POLICY "insert_own_chat_logs"
ON public.chat_logs FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "update_own_chat_logs" ON public.chat_logs;
CREATE POLICY "update_own_chat_logs"
ON public.chat_logs FOR UPDATE
TO anon
USING (user_id = public.current_session_user_id())
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "delete_own_chat_logs" ON public.chat_logs;
CREATE POLICY "delete_own_chat_logs"
ON public.chat_logs FOR DELETE
TO anon
USING (user_id = public.current_session_user_id());

-- --- ai_reports ---
DROP POLICY IF EXISTS "select_own_ai_reports" ON public.ai_reports;
DROP POLICY IF EXISTS "select_all_ai_reports_for_psychologist" ON public.ai_reports;
DROP POLICY IF EXISTS "ai_reports_select_own_or_psychologist" ON public.ai_reports;
CREATE POLICY "ai_reports_select_own_or_psychologist"
ON public.ai_reports FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_psychologist(public.current_session_user_id())
);

DROP POLICY IF EXISTS "insert_own_ai_reports" ON public.ai_reports;
CREATE POLICY "insert_own_ai_reports"
ON public.ai_reports FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "update_own_ai_reports" ON public.ai_reports;
CREATE POLICY "update_own_ai_reports"
ON public.ai_reports FOR UPDATE
TO anon
USING (user_id = public.current_session_user_id())
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "delete_own_ai_reports" ON public.ai_reports;
CREATE POLICY "delete_own_ai_reports"
ON public.ai_reports FOR DELETE
TO anon
USING (user_id = public.current_session_user_id());

-- --- trusted_contacts ---
DROP POLICY IF EXISTS "select_own_trusted_contacts" ON public.trusted_contacts;
CREATE POLICY "select_own_trusted_contacts"
ON public.trusted_contacts FOR SELECT
TO anon
USING (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "insert_own_trusted_contacts" ON public.trusted_contacts;
CREATE POLICY "insert_own_trusted_contacts"
ON public.trusted_contacts FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "update_own_trusted_contacts" ON public.trusted_contacts;
CREATE POLICY "update_own_trusted_contacts"
ON public.trusted_contacts FOR UPDATE
TO anon
USING (user_id = public.current_session_user_id())
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "delete_own_trusted_contacts" ON public.trusted_contacts;
CREATE POLICY "delete_own_trusted_contacts"
ON public.trusted_contacts FOR DELETE
TO anon
USING (user_id = public.current_session_user_id());

-- ===== 7. Corrige el trigger de protección de columnas premium =====

CREATE OR REPLACE FUNCTION public.protect_premium_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.is_premium := OLD.is_premium;
    NEW.premium_since := OLD.premium_since;
    NEW.lemonsqueezy_customer_id := OLD.lemonsqueezy_customer_id;
    NEW.lemonsqueezy_subscription_id := OLD.lemonsqueezy_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;
