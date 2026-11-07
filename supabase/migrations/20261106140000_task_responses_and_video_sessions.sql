/*
# Respuestas a consignas y enlaces de videollamada

## 1. Respuestas a consignas
Una tarea asignada por el especialista admite una respuesta escrita del paciente.
Se guarda solo a través de la Edge Function `task-response`, que aplica la misma
detección de riesgo que el chat: por eso el cliente deja de poder escribir esas
columnas directamente. El especialista lee únicamente las tareas que él asignó,
y solo mientras el vínculo siga aceptado; nunca las tareas personales del paciente.

## 2. Videollamadas
`video_sessions` guarda el enlace de Google Meet que el especialista envía a un
paciente vinculado. La llamada ocurre en Google, no en Calivia.
*/

-- ===== 1. Respuestas a consignas =====

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS patient_response text CHECK (patient_response IS NULL OR length(patient_response) <= 2000),
  ADD COLUMN IF NOT EXISTS patient_response_at timestamptz;

REVOKE UPDATE ON public.tasks FROM anon, authenticated;
GRANT UPDATE (title, due_at, done, reminder_sound) ON public.tasks TO anon;

DROP POLICY IF EXISTS "tasks_select_assigned_by_psychologist" ON public.tasks;
CREATE POLICY "tasks_select_assigned_by_psychologist"
ON public.tasks FOR SELECT
TO anon
USING (
  assigned_by = public.current_session_user_id()
  AND public.is_accepted_patient(public.current_session_user_id(), user_id)
);

-- ===== 2. Videollamadas =====

CREATE TABLE IF NOT EXISTS public.video_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meet_url text NOT NULL CHECK (meet_url ~ '^https://meet\.google\.com/[a-zA-Z0-9-]+(\?[^[:space:]]*)?$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_sessions_patient_created_idx
  ON public.video_sessions (patient_id, created_at DESC);

ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.video_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.video_sessions TO anon;

DROP POLICY IF EXISTS "video_sessions_select_participants" ON public.video_sessions;
CREATE POLICY "video_sessions_select_participants"
ON public.video_sessions FOR SELECT
TO anon
USING (
  patient_id = public.current_session_user_id()
  OR psychologist_id = public.current_session_user_id()
);

DROP POLICY IF EXISTS "video_sessions_insert_for_linked_patient" ON public.video_sessions;
CREATE POLICY "video_sessions_insert_for_linked_patient"
ON public.video_sessions FOR INSERT
TO anon
WITH CHECK (
  psychologist_id = public.current_session_user_id()
  AND public.is_accepted_patient(public.current_session_user_id(), patient_id)
);

DROP POLICY IF EXISTS "video_sessions_delete_own" ON public.video_sessions;
CREATE POLICY "video_sessions_delete_own"
ON public.video_sessions FOR DELETE
TO anon
USING (psychologist_id = public.current_session_user_id());

NOTIFY pgrst, 'reload schema';
