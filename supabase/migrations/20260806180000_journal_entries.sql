/*
# Diario de Consciencia (Espacio de Descarga)

Espacio de escritura libre, separado del chat conversacional: la persona
escribe lo que la abruma de corrida, y la IA responde una sola vez con una
reflexión breve y sugiere UNA herramienta concreta de la app (sonidos,
juegos o el ejercicio de vibración) según el contenido.
*/

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.current_session_user_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  ai_reflection text,
  suggested_tool text CHECK (suggested_tool IN ('sounds', 'games', 'vibration', 'none')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS journal_entries_user_idx ON public.journal_entries (user_id, created_at DESC);

DROP POLICY IF EXISTS "journal_entries_select_own" ON public.journal_entries;
CREATE POLICY "journal_entries_select_own"
ON public.journal_entries FOR SELECT
TO anon
USING (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "journal_entries_insert_own" ON public.journal_entries;
CREATE POLICY "journal_entries_insert_own"
ON public.journal_entries FOR INSERT
TO anon
WITH CHECK (user_id = public.current_session_user_id());

DROP POLICY IF EXISTS "journal_entries_delete_own" ON public.journal_entries;
CREATE POLICY "journal_entries_delete_own"
ON public.journal_entries FOR DELETE
TO anon
USING (user_id = public.current_session_user_id());
