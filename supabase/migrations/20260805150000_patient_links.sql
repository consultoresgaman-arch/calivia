/*
# Vínculo explícito paciente-psicólogo

## Problema anterior
Cualquier perfil con `role = 'psychologist'` veía TODOS los pacientes
(`is_psychologist(uid) AND role = 'patient'`). Eso ya no alcanza: se pidió
que un psicólogo solo vea los pacientes que enlazó explícitamente a su
perfil.

## 1. Tabla `patient_links`
- `psychologist_id`, `patient_id` (cada paciente enlazado a lo sumo a un
  psicólogo — UNIQUE en `patient_id`).
- Sin política de INSERT directa: crear un vínculo pasa solo por
  `link_patient()`, que verifica que quien llama sea psicólogo.

## 2. `is_linked_patient(psych_id, pat_id)`
Helper `SECURITY DEFINER` para usar dentro de las políticas RLS de
`profiles`, `checkins`, `chat_logs` y `ai_reports`, reemplazando el chequeo
genérico `is_psychologist(uid)` por uno que exige el vínculo explícito.

## 3. `link_patient(p_name)` / `unlink_patient(p_patient_id)`
El psicólogo busca por nombre exacto (case-insensitive) y enlaza; no hace
falta que el paciente acepte nada explícitamente (mismo modelo de
"agregar por nombre" que ya usa el login). Solo un psicólogo puede llamarlas.
*/

CREATE TABLE IF NOT EXISTS public.patient_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);

ALTER TABLE public.patient_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS patient_links_psych_idx ON public.patient_links (psychologist_id);

DROP POLICY IF EXISTS "patient_links_select_for_psychologist" ON public.patient_links;
CREATE POLICY "patient_links_select_for_psychologist"
ON public.patient_links FOR SELECT
TO anon
USING (psychologist_id = public.current_session_user_id());

DROP POLICY IF EXISTS "patient_links_delete_for_psychologist" ON public.patient_links;
CREATE POLICY "patient_links_delete_for_psychologist"
ON public.patient_links FOR DELETE
TO anon
USING (psychologist_id = public.current_session_user_id());

CREATE OR REPLACE FUNCTION public.is_linked_patient(psych_id uuid, pat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_links l
    WHERE l.psychologist_id = psych_id AND l.patient_id = pat_id
  );
$$;

CREATE OR REPLACE FUNCTION public.link_patient(p_name text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_psych uuid := public.current_session_user_id();
  v_patient_id uuid;
BEGIN
  IF v_psych IS NULL OR NOT public.is_psychologist(v_psych) THEN
    RAISE EXCEPTION 'Solo un psicólogo puede vincular pacientes';
  END IF;

  SELECT p.id INTO v_patient_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name)) AND p.role = 'patient';

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un paciente con ese nombre';
  END IF;

  INSERT INTO public.patient_links (psychologist_id, patient_id)
  VALUES (v_psych, v_patient_id)
  ON CONFLICT (patient_id) DO UPDATE SET psychologist_id = EXCLUDED.psychologist_id, created_at = now();

  RETURN QUERY SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = v_patient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_patient(p_patient_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.patient_links
  WHERE patient_id = p_patient_id AND psychologist_id = public.current_session_user_id();
$$;

GRANT EXECUTE ON FUNCTION public.link_patient(text) TO anon;
GRANT EXECUTE ON FUNCTION public.unlink_patient(uuid) TO anon;

-- Reescribe las políticas SELECT: "psicólogo ve paciente" ahora exige
-- vínculo explícito en vez de bastar con is_psychologist().

DROP POLICY IF EXISTS "profiles_select_own_or_psychologist" ON public.profiles;
CREATE POLICY "profiles_select_own_or_psychologist"
ON public.profiles FOR SELECT
TO anon
USING (
  id = public.current_session_user_id()
  OR (role = 'patient' AND public.is_linked_patient(public.current_session_user_id(), id))
);

DROP POLICY IF EXISTS "checkins_select_own_or_psychologist" ON public.checkins;
CREATE POLICY "checkins_select_own_or_psychologist"
ON public.checkins FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_linked_patient(public.current_session_user_id(), user_id)
);

DROP POLICY IF EXISTS "chat_logs_select_own_or_psychologist" ON public.chat_logs;
CREATE POLICY "chat_logs_select_own_or_psychologist"
ON public.chat_logs FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_linked_patient(public.current_session_user_id(), user_id)
);

DROP POLICY IF EXISTS "ai_reports_select_own_or_psychologist" ON public.ai_reports;
CREATE POLICY "ai_reports_select_own_or_psychologist"
ON public.ai_reports FOR SELECT
TO anon
USING (
  user_id = public.current_session_user_id()
  OR public.is_linked_patient(public.current_session_user_id(), user_id)
);
