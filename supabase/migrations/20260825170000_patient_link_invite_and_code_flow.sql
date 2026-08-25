/*
# Vínculo psicólogo-paciente: invitación + código de aprobación

## Problema anterior
`link_patient(p_name)` dejaba a CUALQUIER psicólogo vincularse a CUALQUIER
paciente con solo escribir su nombre exacto — sin que el paciente
participara ni consintiera. Desde ese instante el psicólogo ya veía sus
check-ins, reportes y fechas de actividad. El frontend (PatientDashboard.tsx)
ya tenía media construida una UI de "solicitud pendiente" que llamaba a
funciones que nunca existieron (`accept_patient_link` / `reject_patient_link`)
contra una columna `status` que tampoco existía — quedó a medio camino.

## Flujo nuevo
1. El psicólogo invita al paciente por nombre → `invite_patient()`, crea la
   fila en estado 'pending'. Todavía SIN acceso a nada del paciente.
2. El paciente ve la invitación pendiente y la acepta o la rechaza.
   - Aceptar → `accept_patient_link()`: genera un código numérico de 6
     dígitos, pasa a 'code_issued', y se lo muestra al paciente. Todavía SIN
     acceso — el código es la prueba de que el paciente participó de verdad.
   - Rechazar → `reject_patient_link()`: borra la invitación.
3. El paciente le da el código al psicólogo (fuera de la app: en sesión, por
   mensaje, como prefieran). El psicólogo lo ingresa →
   `confirm_patient_link_code(nombre, código)`. Recién ahí pasa a 'accepted'
   y el psicólogo obtiene acceso (check-ins, reportes, fechas de actividad —
   nunca el contenido del chat, eso ya quedó cerrado en la migración
   anterior).

## Cambios
- `patient_links`: columnas `status`, `approval_code`, `accepted_at`. Las
  filas existentes (vínculos ya establecidos bajo el modelo anterior) se
  marcan 'accepted' retroactivamente — no se revoca acceso ya otorgado.
- `is_linked_patient()`: se mantiene "sin importar el estado" — solo se usa
  para que el psicólogo vea el NOMBRE del paciente durante el proceso de
  invitación (no es dato sensible). Nueva `is_accepted_patient()`, que sí
  exige status='accepted', reemplaza a `is_linked_patient()` en las
  políticas de `checkins` y `ai_reports` (datos sensibles reales).
- Nueva política `patient_links_select_for_patient`: el paciente puede leer
  sus propias filas (para ver invitaciones pendientes/códigos emitidos).
- `link_patient()` se reemplaza por `invite_patient()`.
- Nuevas `accept_patient_link()`, `reject_patient_link()`,
  `confirm_patient_link_code()` (con límite de intentos vía
  check_rate_limit, para no poder fuerza-bruta el código de 6 dígitos).
*/

-- 1. Columnas nuevas + backfill de vínculos ya existentes
ALTER TABLE public.patient_links
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'code_issued', 'accepted')),
  ADD COLUMN IF NOT EXISTS approval_code text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

UPDATE public.patient_links
SET status = 'accepted', accepted_at = created_at
WHERE status = 'pending';
-- (En este punto todas las filas eran pre-existentes: la tabla recién ahora
-- gana la noción de 'pending' de verdad, así que este UPDATE alcanza a
-- todo lo creado bajo el modelo anterior sin distinguirlo de nada nuevo.)

-- 2. Helper estricto para datos sensibles (checkins, ai_reports, chat activity)
CREATE OR REPLACE FUNCTION public.is_accepted_patient(psych_id uuid, pat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_links l
    WHERE l.psychologist_id = psych_id AND l.patient_id = pat_id AND l.status = 'accepted'
  );
$$;

DROP POLICY IF EXISTS "checkins_select_own_or_psychologist" ON public.checkins;
CREATE POLICY "checkins_select_own_or_psychologist"
ON public.checkins FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_accepted_patient(public.current_session_user_id(), user_id)
);

DROP POLICY IF EXISTS "ai_reports_select_own_or_psychologist" ON public.ai_reports;
CREATE POLICY "ai_reports_select_own_or_psychologist"
ON public.ai_reports FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_accepted_patient(public.current_session_user_id(), user_id)
);

-- 3. El paciente puede ver sus propias filas de patient_links
DROP POLICY IF EXISTS "patient_links_select_for_patient" ON public.patient_links;
CREATE POLICY "patient_links_select_for_patient"
ON public.patient_links FOR SELECT
TO anon
USING (patient_id = public.current_session_user_id());

-- 4. invite_patient(): reemplaza a link_patient(), ya no vincula directo
DROP FUNCTION IF EXISTS public.link_patient(text);

CREATE OR REPLACE FUNCTION public.invite_patient(p_name text)
RETURNS TABLE(id uuid, full_name text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_psych uuid := public.current_session_user_id();
  v_patient_id uuid;
  v_existing public.patient_links%ROWTYPE;
BEGIN
  IF v_psych IS NULL OR NOT public.is_psychologist(v_psych) THEN
    RAISE EXCEPTION 'Solo un psicólogo puede invitar pacientes';
  END IF;

  SELECT p.id INTO v_patient_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name)) AND p.role = 'patient';
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un paciente con ese nombre';
  END IF;

  SELECT * INTO v_existing FROM public.patient_links l WHERE l.patient_id = v_patient_id;

  IF FOUND THEN
    IF v_existing.psychologist_id <> v_psych THEN
      RAISE EXCEPTION 'Ese paciente ya está vinculado (o en proceso) con otro profesional';
    END IF;
    IF v_existing.status = 'accepted' THEN
      RAISE EXCEPTION 'Ese paciente ya está vinculado contigo';
    END IF;
    -- Mismo psicólogo, invitación pendiente o con código emitido: la reinicia.
    UPDATE public.patient_links
    SET status = 'pending', approval_code = NULL, accepted_at = NULL, created_at = now()
    WHERE patient_id = v_patient_id;
  ELSE
    INSERT INTO public.patient_links (psychologist_id, patient_id, status)
    VALUES (v_psych, v_patient_id, 'pending');
  END IF;

  RETURN QUERY SELECT p.id, p.full_name, l.status FROM public.profiles p
    JOIN public.patient_links l ON l.patient_id = p.id
    WHERE p.id = v_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_patient(text) TO anon;

-- 5. El paciente acepta: genera y devuelve el código de aprobación
-- (existía una versión anterior del modelo "aceptar = vincula directo, sin
-- código", que vinculaba de inmediato sin devolver nada — el cambio de
-- RETURNS void a RETURNS TABLE(code text) exige borrarla primero.)
DROP FUNCTION IF EXISTS public.accept_patient_link(uuid);

CREATE OR REPLACE FUNCTION public.accept_patient_link(p_psychologist_id uuid)
RETURNS TABLE(code text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient uuid := public.current_session_user_id();
  v_code text;
BEGIN
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patient_links l
    WHERE l.patient_id = v_patient AND l.psychologist_id = p_psychologist_id AND l.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'No hay una invitación pendiente de ese profesional';
  END IF;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  UPDATE public.patient_links
  SET status = 'code_issued', approval_code = v_code
  WHERE patient_id = v_patient AND psychologist_id = p_psychologist_id;

  RETURN QUERY SELECT v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_patient_link(uuid) TO anon;

-- 6. El paciente rechaza (o cancela una invitación que ya había aceptado)
CREATE OR REPLACE FUNCTION public.reject_patient_link(p_psychologist_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.patient_links
  WHERE patient_id = public.current_session_user_id()
    AND psychologist_id = p_psychologist_id
    AND status IN ('pending', 'code_issued');
$$;

GRANT EXECUTE ON FUNCTION public.reject_patient_link(uuid) TO anon;

-- 7. El psicólogo confirma con el código que le dio el paciente
CREATE OR REPLACE FUNCTION public.confirm_patient_link_code(p_patient_name text, p_code text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_psych uuid := public.current_session_user_id();
  v_row public.patient_links%ROWTYPE;
  v_patient_id uuid;
BEGIN
  IF v_psych IS NULL OR NOT public.is_psychologist(v_psych) THEN
    RAISE EXCEPTION 'Solo un psicólogo puede confirmar un vínculo';
  END IF;

  IF NOT public.check_rate_limit('confirm-link:' || v_psych::text, 10, 300) THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  END IF;

  SELECT p.id INTO v_patient_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_patient_name)) AND p.role = 'patient';
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un paciente con ese nombre';
  END IF;

  SELECT * INTO v_row FROM public.patient_links l
    WHERE l.patient_id = v_patient_id AND l.psychologist_id = v_psych;

  IF NOT FOUND OR v_row.status <> 'code_issued' OR v_row.approval_code IS NULL
     OR trim(v_row.approval_code) <> trim(p_code) THEN
    RAISE EXCEPTION 'Código incorrecto o no hay una confirmación pendiente con ese paciente';
  END IF;

  UPDATE public.patient_links
  SET status = 'accepted', accepted_at = now(), approval_code = NULL
  WHERE patient_id = v_patient_id AND psychologist_id = v_psych;

  RETURN QUERY SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = v_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_patient_link_code(text, text) TO anon;
