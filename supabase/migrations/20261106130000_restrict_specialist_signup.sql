/*
# Registro de especialistas solo con aprobación

El registro público crea únicamente pacientes. Un especialista se registra como
cualquier persona y, tras revisar su licencia, se activa con
`admin_verify_professional`, que solo puede ejecutar service_role o el SQL Editor.

Las versiones anteriores de la app que intenten registrar un especialista reciben
un error, en vez de crear en silencio una cuenta con otro rol.
*/

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
SET search_path = public, extensions
AS $$
DECLARE
  v_name text := trim(p_name);
  v_id uuid;
  v_token uuid;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'El nombre no puede estar vacío';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;
  IF coalesce(p_role, 'patient') <> 'patient' THEN
    RAISE EXCEPTION 'Las cuentas de especialista requieren aprobación. Escribe a consultoresgaman@gmail.com';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(trim(p.full_name)) = lower(v_name)) THEN
    RAISE EXCEPTION 'Ese nombre ya está en uso';
  END IF;

  INSERT INTO public.profiles (full_name, role, password_hash)
  VALUES (v_name, 'patient', crypt(p_password, gen_salt('bf')))
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

CREATE OR REPLACE FUNCTION public.admin_verify_professional(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p SET role = 'psychologist'
    WHERE lower(trim(p.full_name)) = lower(trim(p_name)) AND p.role = 'patient';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró un paciente con ese nombre';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_professional(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_professional(text) TO service_role;

NOTIFY pgrst, 'reload schema';
