/*
# Fix: register_profile / login_profile / resolve_session dropped avatar_path,
# phone, license_number y bio

## Causa raíz
`20260811100000_add_profile_fields_and_avatars.sql` agregó `avatar_path`,
`phone`, `license_number` y `bio` a las tres funciones de sesión. Pero las
dos migraciones posteriores que volvieron a tocar estas mismas funciones
(`20260825130000_expose_preferred_name_in_session_rpcs.sql`, para agregar
`preferred_name`/`occupation`, y `20260825160000_add_terms_acceptance.sql`,
para agregar `terms_accepted_at`/`terms_version`) hicieron `DROP FUNCTION` +
`CREATE OR REPLACE` con una lista de columnas que solo incluía los campos
nuevos de cada una, sin arrastrar los campos de avatar/especialista que ya
existían — así que quedaron eliminados de la firma de las tres funciones sin
que ninguna migración posterior los repusiera.

## Efecto en producción
`resolve_session` (y por lo tanto `AuthContext.profile` en el frontend,
ver src/lib/auth.tsx) nunca devuelve `avatar_path`, `phone`,
`license_number` ni `bio`. Consecuencia visible: alguien sube su foto de
perfil (la subida a Storage y el `UPDATE profiles.avatar_path` sí funcionan
y sí persisten en la tabla), la ve aparecer al instante porque
ProfileSettingsModal usa el resultado local de la subida — pero apenas se
recarga la app o se refresca la sesión, `profile.avatar_path` vuelve a ser
`undefined` (el campo ni siquiera viaja) y el círculo vuelve al placeholder
gris, como si nunca se hubiera guardado. Los campos de especialista
(teléfono, matrícula, biografía) tienen el mismo problema.

## Segunda regresión encontrada en el mismo lugar
Las mismas dos migraciones también reemplazaron el `is_premium` "efectivo"
que calculaba `20260810190000_add_premium_expiration.sql`
(`is_premium AND (premium_until IS NULL OR premium_until > now())`) por la
columna cruda `p.is_premium`, sin darse cuenta. Efecto: desde esa migración,
un acceso premium de cortesía otorgado con `admin_grant_premium` (con fecha
de vencimiento) deja de expirar del lado del cliente — el frontend siempre
ve `is_premium = true` aunque `premium_until` ya haya pasado. Se corrige acá
también, restaurando la fórmula original.

## Fix
Recrea las tres funciones con el conjunto COMPLETO de columnas acumuladas
hasta ahora (mismo patrón que las migraciones anteriores: hay que
dropearlas primero porque Postgres no permite que CREATE OR REPLACE cambie
las columnas de salida) y con el `is_premium` efectivo (con expiración)
restaurado. El resto de la lógica interna de cada función no cambia.
*/

DROP FUNCTION IF EXISTS public.register_profile(text, text, text);
DROP FUNCTION IF EXISTS public.login_profile(text, text);
DROP FUNCTION IF EXISTS public.resolve_session(uuid);

CREATE OR REPLACE FUNCTION public.register_profile(p_name text, p_password text, p_role text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  avatar_path text, phone text, license_number text, bio text,
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
    SELECT p.id, p.full_name, p.role, p.country,
           (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
           p.created_at,
           p.avatar_path, p.phone, p.license_number, p.bio,
           p.preferred_name, p.occupation, p.terms_accepted_at, p.terms_version, v_token
    FROM public.profiles p WHERE p.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_profile(p_name text, p_password text)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  avatar_path text, phone text, license_number text, bio text,
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

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country,
                      (v_row.is_premium AND (v_row.premium_until IS NULL OR v_row.premium_until > now())),
                      v_row.created_at,
                      v_row.avatar_path, v_row.phone, v_row.license_number, v_row.bio,
                      v_row.preferred_name, v_row.occupation, v_row.terms_accepted_at, v_row.terms_version, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_session(p_token uuid)
RETURNS TABLE(
  id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz,
  avatar_path text, phone text, license_number text, bio text,
  preferred_name text, occupation text, terms_accepted_at timestamptz, terms_version text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.country,
         (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
         p.created_at,
         p.avatar_path, p.phone, p.license_number, p.bio,
         p.preferred_name, p.occupation, p.terms_accepted_at, p.terms_version
  FROM public.sessions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.register_profile(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_session(uuid) TO anon;
