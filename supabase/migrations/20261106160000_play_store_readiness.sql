/*
# Preparación para Google Play

1. `verify_user_password`: confirma la contraseña antes de eliminar una cuenta.
   Solo service_role, para que la Edge Function `delete-account` la use.
2. `ai_content_reports`: reportes de respuestas de la IA hechos desde la app.
   El cliente solo puede insertar; se revisan con acceso de administrador.
3. `change_password` cierra las demás sesiones de la cuenta.
*/

-- ===== 1. Confirmación de contraseña =====

CREATE OR REPLACE FUNCTION public.verify_user_password(p_user_id uuid, p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND password_hash = crypt(p_password, password_hash)
  );
$$;

REVOKE ALL ON FUNCTION public.verify_user_password(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_password(uuid, text) TO service_role;

-- ===== 2. Reportes de contenido de IA =====

CREATE TABLE IF NOT EXISTS public.ai_content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_session_user_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) <= 4000),
  reason text NOT NULL CHECK (reason IN ('offensive', 'harmful', 'inaccurate', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_content_reports_created_idx ON public.ai_content_reports (created_at DESC);

ALTER TABLE public.ai_content_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_content_reports FROM anon, authenticated;
GRANT INSERT ON public.ai_content_reports TO anon;

DROP POLICY IF EXISTS "ai_content_reports_insert_own" ON public.ai_content_reports;
CREATE POLICY "ai_content_reports_insert_own"
ON public.ai_content_reports FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

-- ===== 3. Cambiar la contraseña cierra las demás sesiones =====

CREATE OR REPLACE FUNCTION public.change_password(p_current_password text, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := public.current_session_user_id();
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  SELECT password_hash INTO v_hash FROM public.profiles WHERE id = v_uid;

  IF v_hash IS NULL OR v_hash <> crypt(p_current_password, v_hash) THEN
    RAISE EXCEPTION 'La contraseña actual es incorrecta';
  END IF;

  UPDATE public.profiles SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = v_uid;

  DELETE FROM public.sessions
  WHERE user_id = v_uid
    AND token <> NULLIF(current_setting('request.headers', true)::json ->> 'x-session-token', '')::uuid;
END;
$$;

NOTIFY pgrst, 'reload schema';
