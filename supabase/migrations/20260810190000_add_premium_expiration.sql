/*
# Expiración real para accesos premium de cortesía

## Propósito
Hoy `is_premium` es un booleano simple que el webhook de Lemon Squeezy
enciende/apaga según la suscripción de pago. No hay forma de dar un acceso
premium de cortesía con fecha de vencimiento (ej. una prueba de 30 días para
una persona puntual) sin quedar activado indefinidamente.

## 1. Columna nueva
- `profiles.premium_until` (timestamptz, nullable): si es NULL, el acceso
  premium (cuando `is_premium = true`) no vence solo — es el caso normal de
  una suscripción de pago activa, controlada por el webhook. Si tiene fecha,
  el acceso premium efectivo solo es válido hasta esa fecha.

## 2. "Premium efectivo"
`register_profile`, `login_profile` y `resolve_session` (las únicas fuentes
de las que el cliente arma su `Profile`) ahora devuelven
`is_premium AND (premium_until IS NULL OR premium_until > now())` en vez de
la columna cruda, así que un acceso vencido deja de reflejarse como premium
en el cliente sin necesitar un cron que apague la columna.

## 3. admin_grant_premium (solo service_role)
Función auxiliar para otorgar accesos de cortesía con vencimiento real, en
vez de escribir UPDATEs sueltos a mano contra producción. Mismo patrón que
`admin_reset_password`: SECURITY DEFINER, revocada de anon/authenticated,
solo ejecutable con la service role key.

## 4. Seguridad
`premium_until` se agrega a la lista de columnas que `protect_premium_columns`
resetea cuando la request no viene con `service_role`, igual que el resto de
columnas premium.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamptz;

CREATE OR REPLACE FUNCTION public.protect_premium_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.is_premium := OLD.is_premium;
    NEW.premium_since := OLD.premium_since;
    NEW.premium_until := OLD.premium_until;
    NEW.lemonsqueezy_customer_id := OLD.lemonsqueezy_customer_id;
    NEW.lemonsqueezy_subscription_id := OLD.lemonsqueezy_subscription_id;
  END IF;
  RETURN NEW;
END;
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
    SELECT p.id, p.full_name, p.role, p.country,
           (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
           p.created_at, v_token
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

  RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.role, v_row.country,
    (v_row.is_premium AND (v_row.premium_until IS NULL OR v_row.premium_until > now())),
    v_row.created_at, v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_session(p_token uuid)
RETURNS TABLE(id uuid, full_name text, role text, country text, is_premium boolean, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.country,
         (p.is_premium AND (p.premium_until IS NULL OR p.premium_until > now())) AS is_premium,
         p.created_at
  FROM public.sessions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_premium(p_profile_id uuid, p_days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'p_days debe ser mayor a 0';
  END IF;
  UPDATE public.profiles
  SET is_premium = true,
      premium_since = now(),
      premium_until = now() + (p_days || ' days')::interval
  WHERE id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium(uuid, integer) TO service_role;
