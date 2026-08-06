/*
# Reset administrativo de contraseña + correo de recuperación

## 1. admin_reset_password (solo service_role)
Función de emergencia para restablecer una contraseña sin pasar por el
flujo normal. A propósito NO se otorga a `anon` — si cualquiera con la
clave pública pudiera llamarla, sería un secuestro de cuentas trivial.
Solo se invoca con la service role key (fuera del cliente).

## 2. Correo de recuperación (NO de login)
`profiles.recovery_email` es opcional y nunca se usa para iniciar sesión
— el login sigue siendo solo nombre + contraseña. Sirve únicamente para
poder recuperar el acceso si se olvida la contraseña, vía un código de un
solo uso enviado por correo (tabla `password_resets`).
*/

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_profile_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;
  UPDATE public.profiles
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_password(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_reset_password(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(uuid, text) TO service_role;

-- ===== Correo de recuperación =====

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email text;

CREATE TABLE IF NOT EXISTS public.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
-- Sin políticas para anon/authenticated a propósito: solo las funciones
-- SECURITY DEFINER de abajo (y el edge function con service role) tocan
-- esta tabla. Nadie debe poder leer códigos de reseteo ajenos.

CREATE INDEX IF NOT EXISTS password_resets_profile_idx ON public.password_resets (profile_id, used, expires_at);

-- El usuario autenticado (por su propia sesión) puede fijar/actualizar su
-- correo de recuperación.
CREATE OR REPLACE FUNCTION public.set_recovery_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := public.current_session_user_id();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;
  IF p_email IS NOT NULL AND p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Correo inválido';
  END IF;
  UPDATE public.profiles SET recovery_email = nullif(trim(p_email), '') WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_recovery_email(text) TO anon;

-- Genera un código de recuperación de 6 dígitos si el perfil tiene correo
-- de recuperación configurado. Devuelve el correo (para que el edge
-- function sepa a quién mandar el email) y el código — el edge function
-- usa la service role key, así que puede llamarla igual que el cliente,
-- pero el código en sí solo viaja del edge function al correo, nunca de
-- vuelta al navegador de quien pide el reseteo (evita que alguien vea el
-- código de otra persona en la respuesta de red).
CREATE OR REPLACE FUNCTION public.create_password_reset_code(p_name text)
RETURNS TABLE(profile_id uuid, recovery_email text, code text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_code text;
BEGIN
  SELECT * INTO v_profile FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name))
    LIMIT 1;

  IF NOT FOUND OR v_profile.recovery_email IS NULL THEN
    RETURN;
  END IF;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  INSERT INTO public.password_resets (profile_id, code, expires_at)
  VALUES (v_profile.id, v_code, now() + interval '15 minutes');

  RETURN QUERY SELECT v_profile.id, v_profile.recovery_email, v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_password_reset_code(text) TO anon;

CREATE OR REPLACE FUNCTION public.reset_password_with_code(p_name text, p_code text, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id uuid;
  v_reset public.password_resets%ROWTYPE;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  SELECT p.id INTO v_profile_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name))
    LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Código inválido o vencido';
  END IF;

  SELECT * INTO v_reset FROM public.password_resets r
    WHERE r.profile_id = v_profile_id
      AND r.code = p_code
      AND r.used = false
      AND r.expires_at > now()
    ORDER BY r.created_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código inválido o vencido';
  END IF;

  UPDATE public.profiles SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = v_profile_id;
  UPDATE public.password_resets SET used = true WHERE id = v_reset.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_password_with_code(text, text, text) TO anon;
