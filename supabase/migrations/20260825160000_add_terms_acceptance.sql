/*
# Track acceptance of Terms of Use / Privacy Policy

## Purpose
New (and existing, retroactively) users must explicitly accept Calivia's
Terms of Use and Privacy Policy before using the app. This stores that
acceptance so it can be proven/audited later, and versioned so a future
policy change can force re-acceptance without touching existing rows.

## Changes
- `profiles.terms_accepted_at` (timestamptz, nullable): when accepted, null
  until then — the app gates on this being null.
- `profiles.terms_version` (text, nullable): which version was accepted
  (bump the app's CURRENT_TERMS_VERSION constant on any material change to
  force everyone back through the consent screen).
- `register_profile` / `login_profile` / `resolve_session` updated to also
  return these two fields, same as the preferred_name/occupation migration.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

DROP FUNCTION IF EXISTS public.register_profile(text, text, text);
DROP FUNCTION IF EXISTS public.login_profile(text, text);
DROP FUNCTION IF EXISTS public.resolve_session(uuid);

CREATE OR REPLACE FUNCTION public.register_profile(p_name text, p_password text, p_role text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text,
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
    SELECT p.id, p.full_name, p.role, p.country, p.is_premium, p.created_at,
           p.preferred_name, p.occupation, p.terms_accepted_at, p.terms_version, v_token
    FROM public.profiles p WHERE p.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_profile(p_name text, p_password text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text,
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

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country, v_row.is_premium, v_row.created_at,
                      v_row.preferred_name, v_row.occupation, v_row.terms_accepted_at, v_row.terms_version, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_session(p_token uuid)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.country, p.is_premium, p.created_at,
         p.preferred_name, p.occupation, p.terms_accepted_at, p.terms_version
  FROM public.sessions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_session(uuid) TO anon;
