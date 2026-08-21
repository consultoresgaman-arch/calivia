/*
# Tareas diarias

## Propósito
Organizador simple de pendientes (laborales, de estudio o personales) con
hora opcional, para que el paciente estructure su día.

## 1. Tabla nueva `tasks`
- Owner-scoped: cada quien solo ve/edita las suyas, vía
  `current_session_user_id()` (mismo mecanismo de sesión propia de la
  migración `20260805130000_custom_table_based_auth.sql`).

## 2. Nota sobre "alarmas"
Esta tabla solo guarda el dato (`due_at`). El recordatorio en sí lo dispara
el cliente (Notification API) mientras la app está abierta en el navegador;
no hay push notifications del lado servidor en esta migración.
*/

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_session_user_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON public.tasks (user_id, due_at);

DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
CREATE POLICY "tasks_select_own"
ON public.tasks FOR SELECT
TO anon
USING (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
CREATE POLICY "tasks_insert_own"
ON public.tasks FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
CREATE POLICY "tasks_update_own"
ON public.tasks FOR UPDATE
TO anon
USING (user_id = public.current_session_user_id())
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;
CREATE POLICY "tasks_delete_own"
ON public.tasks FOR DELETE
TO anon
USING (user_id = public.current_session_user_id());
