/*
# Endurecimiento de seguridad — fase 1

Compatible con la app instalada, salvo una excepción deliberada:
"Olvidé mi contraseña" deja de funcionar en versiones anteriores hasta que se
publique la versión que usa la Edge Function `secure-auth`.

## Cambios
1. `check_rate_limit` deja de ser invocable desde el cliente.
2. Los códigos de recuperación se generan con CSPRNG, se guardan como hash y
   solo queda uno vigente por cuenta.
3. `reset_password_with_code` pasa a ser solo de service_role y cierra todas
   las sesiones de la cuenta. Los intentos se cuentan en `secure-auth`, en una
   transacción separada: dentro de una RPC pública el contador se puede revertir.
4. `profiles`: el cliente solo puede escribir las columnas que edita la app.
5. `ai_reports` y los mensajes de la IA dejan de ser escribibles desde el cliente.
6. Nueva `patient_revoke_link`: el paciente puede retirar el acceso a su profesional.
7. Nuevas `auth_login` y `auth_confirm_patient_link`, solo service_role, que usa
   `secure-auth`. No sustituyen aún a las RPC públicas: eso ocurre en la fase 2.
*/

-- ===== 1. Limitador =====

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- ===== 2. Generación de códigos de recuperación =====

CREATE OR REPLACE FUNCTION public.create_password_reset_code(p_name text)
RETURNS TABLE(profile_id uuid, recovery_email text, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  v_code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');

  UPDATE public.password_resets r SET used = true
    WHERE r.profile_id = v_profile.id AND r.used = false;

  INSERT INTO public.password_resets (profile_id, code, expires_at)
  VALUES (v_profile.id, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes');

  -- El código en claro solo vuelve a la Edge Function, que lo envía por correo.
  RETURN QUERY SELECT v_profile.id, v_profile.recovery_email, v_code;
END;
$$;

-- Los códigos anteriores estaban en claro y ya no coincidirían con el hash.
UPDATE public.password_resets SET used = true WHERE used = false;

-- ===== 3. Canje del código: solo service_role =====

DROP FUNCTION IF EXISTS public.reset_password_with_code(text, text, text);

CREATE FUNCTION public.reset_password_with_code(p_name text, p_code text, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile_id uuid;
  v_reset_id uuid;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RETURN false;
  END IF;

  SELECT p.id INTO v_profile_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name))
    LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT r.id INTO v_reset_id FROM public.password_resets r
    WHERE r.profile_id = v_profile_id
      AND r.code = encode(digest(p_code, 'sha256'), 'hex')
      AND r.used = false
      AND r.expires_at > now()
    ORDER BY r.created_at DESC
    LIMIT 1;
  IF v_reset_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = v_profile_id;
  UPDATE public.password_resets SET used = true WHERE profile_id = v_profile_id;
  DELETE FROM public.sessions WHERE user_id = v_profile_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_password_with_code(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_with_code(text, text, text) TO service_role;

-- ===== 4. profiles: escritura limitada a las columnas de la app =====
-- La lectura por columnas va en la fase 2, porque la app instalada usa select('*').

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM anon, authenticated;

GRANT UPDATE (
  country, avatar_path, phone, license_number, bio, preferred_name, occupation,
  terms_accepted_at, terms_version,
  persona_name_espejo, persona_name_amigo, persona_name_acompanante
) ON public.profiles TO anon;

-- ===== 5. Contenido generado por el sistema =====

DROP POLICY IF EXISTS "insert_own_ai_reports" ON public.ai_reports;
DROP POLICY IF EXISTS "update_own_ai_reports" ON public.ai_reports;

DROP POLICY IF EXISTS "update_own_chat_logs" ON public.chat_logs;
DROP POLICY IF EXISTS "insert_own_chat_logs" ON public.chat_logs;
CREATE POLICY "insert_own_user_chat_logs"
ON public.chat_logs FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id() AND role = 'user');

-- ===== 6. El paciente puede retirar el acceso =====

CREATE OR REPLACE FUNCTION public.patient_revoke_link()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.patient_links WHERE patient_id = public.current_session_user_id();
$$;

REVOKE ALL ON FUNCTION public.patient_revoke_link() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.patient_revoke_link() TO anon;

-- ===== 7. Funciones internas para secure-auth =====

CREATE OR REPLACE FUNCTION public.auth_login(p_name text, p_password text)
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
  v_row public.profiles%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO v_row FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name))
    LIMIT 1;

  IF NOT FOUND OR v_row.password_hash IS NULL
     OR v_row.password_hash <> crypt(p_password, v_row.password_hash) THEN
    RETURN;
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

REVOKE ALL ON FUNCTION public.auth_login(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_login(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.auth_confirm_patient_link(p_psych uuid, p_patient_name text, p_code text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.patient_links%ROWTYPE;
  v_patient_id uuid;
BEGIN
  IF NOT public.is_psychologist(p_psych) THEN
    RETURN;
  END IF;

  SELECT p.id INTO v_patient_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_patient_name)) AND p.role = 'patient';
  IF v_patient_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.patient_links l
    WHERE l.patient_id = v_patient_id AND l.psychologist_id = p_psych;

  IF NOT FOUND OR v_row.status <> 'code_issued' OR v_row.approval_code IS NULL
     OR trim(v_row.approval_code) <> trim(p_code) THEN
    RETURN;
  END IF;

  UPDATE public.patient_links l
  SET status = 'accepted', accepted_at = now(), approval_code = NULL
  WHERE l.patient_id = v_patient_id AND l.psychologist_id = p_psych;

  RETURN QUERY SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = v_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_confirm_patient_link(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_confirm_patient_link(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
