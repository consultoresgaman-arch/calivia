/*
# Campos de perfil (avatar, teléfono, matrícula, bio) + Storage de avatares

## 1. Columnas nuevas en `profiles`
- `avatar_path` (text, nullable): ruta del objeto dentro del bucket privado
  `avatars` (ej. `{user_id}/avatar.jpg`), NO una URL pública — el cliente
  pide una URL firmada cuando necesita mostrarla.
- `phone`, `license_number`, `bio` (text, nullable): pensados para el perfil
  de especialista, pero son columnas genéricas — la UI decide qué mostrar
  según el rol.

Ninguna de estas columnas está protegida por `protect_premium_columns`, así
que la política ya existente `profiles_update_own` alcanza para que cada
quien edite su propia fila; no hace falta una función SECURITY DEFINER.

## 2. Bucket `avatars`
Privado (no público). Convención: cada usuario sube solo dentro de su propia
carpeta `{user_id}/...`. Políticas sobre `storage.objects`:
- INSERT/UPDATE/DELETE: solo dentro de la carpeta propia.
- SELECT: el dueño, o un psicólogo con vínculo activo hacia ese paciente
  (reutiliza `is_linked_patient`, ya creada en `20260805150000_patient_links.sql`).

## 3. RPCs de sesión
`register_profile`, `login_profile` y `resolve_session` se actualizan para
devolver los 4 campos nuevos (mismo patrón que `20260810190000_add_premium_expiration.sql`).
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS bio text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.current_session_user_id()::text
);

DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder"
ON storage.objects FOR UPDATE
TO anon
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.current_session_user_id()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.current_session_user_id()::text
);

DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder"
ON storage.objects FOR DELETE
TO anon
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.current_session_user_id()::text
);

DROP POLICY IF EXISTS "avatars_select_own_or_linked_psychologist" ON storage.objects;
CREATE POLICY "avatars_select_own_or_linked_psychologist"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = public.current_session_user_id()::text
    OR public.is_linked_patient(public.current_session_user_id(), (storage.foldername(name))[1]::uuid)
  )
);

-- Postgres no permite CREATE OR REPLACE cuando cambia el conjunto de
-- columnas de salida de una función RETURNS TABLE; hay que dropearlas primero.
DROP FUNCTION IF EXISTS public.register_profile(text, text, text);
DROP FUNCTION IF EXISTS public.login_profile(text, text);
DROP FUNCTION IF EXISTS public.resolve_session(uuid);

CREATE OR REPLACE FUNCTION public.register_profile(p_name text, p_password text, p_role text)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz, session_token uuid, avatar_path text, phone text, license_number text, bio text)
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
           p.created_at, v_token, p.avatar_path, p.phone, p.license_number, p.bio
    FROM public.profiles p WHERE p.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_profile(p_name text, p_password text)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz, session_token uuid, avatar_path text, phone text, license_number text, bio text)
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

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country,
    (v_row.is_premium AND (v_row.premium_until IS NULL OR v_row.premium_until > now())),
    v_row.created_at, v_token, v_row.avatar_path, v_row.phone, v_row.license_number, v_row.bio;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_session(p_token uuid)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz, avatar_path text, phone text, license_number text, bio text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.country,
         (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
         p.created_at, p.avatar_path, p.phone, p.license_number, p.bio
  FROM public.sessions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();
$$;

-- DROP FUNCTION también borra los GRANTs previos: hay que reotorgarlos.
GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_session(uuid) TO anon;
