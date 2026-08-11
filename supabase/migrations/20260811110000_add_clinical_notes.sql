/*
# Notas clínicas privadas del especialista

## Propósito
Espacio para que el psicólogo anote impresiones de consulta sobre un
paciente vinculado. Es explícitamente privado: el paciente no tiene NINGUNA
política sobre esta tabla, así que no puede leer sus propias notas clínicas
bajo ninguna circunstancia, ni siquiera indirectamente.

## Seguridad
SELECT/INSERT restringidos a `psychologist_id = current_session_user_id()`
más `is_linked_patient(psychologist_id, patient_id)` (misma función ya usada
para checkins/chat_logs/ai_reports). No se permite UPDATE ni DELETE por
ahora — una nota clínica es un registro de lo que se observó en su momento,
no algo pensado para reescribirse.
*/

CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  psychologist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS clinical_notes_patient_idx ON public.clinical_notes (patient_id, created_at DESC);

DROP POLICY IF EXISTS "clinical_notes_select_own_patients" ON public.clinical_notes;
CREATE POLICY "clinical_notes_select_own_patients"
ON public.clinical_notes FOR SELECT
TO anon
USING (
  psychologist_id = public.current_session_user_id()
  AND public.is_linked_patient(psychologist_id, patient_id)
);

DROP POLICY IF EXISTS "clinical_notes_insert_own_patients" ON public.clinical_notes;
CREATE POLICY "clinical_notes_insert_own_patients"
ON public.clinical_notes FOR INSERT
TO anon
WITH CHECK (
  psychologist_id = public.current_session_user_id()
  AND public.is_linked_patient(psychologist_id, patient_id)
);
