/*
# Alertas de riesgo (best-effort, por palabras clave)

## Qué es y qué NO es
Esta tabla registra coincidencias de un lexicón de palabras clave de riesgo
(ideación suicida, autolesión, crisis aguda) detectadas en los mensajes del
paciente, para avisar al psicólogo vinculado. Es una heurística simple de
texto, corrida en el edge function `ai-chat` — NO es una evaluación clínica
de riesgo ni reemplaza el juicio profesional. Puede tener falsos negativos
(frases de riesgo que no calcen con el lexicón) y falsos positivos.

## Tabla `risk_alerts`
- Solo la inserta el edge function `ai-chat` con la service role key
  (bypassa RLS). No hay política de INSERT para `anon`.
- El psicólogo vinculado puede leer y marcar como revisada (`acknowledged`)
  sus propias alertas.
*/

CREATE TABLE IF NOT EXISTS public.risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  psychologist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  message_excerpt text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS risk_alerts_psych_idx ON public.risk_alerts (psychologist_id, acknowledged, created_at DESC);

DROP POLICY IF EXISTS "risk_alerts_select_for_psychologist" ON public.risk_alerts;
CREATE POLICY "risk_alerts_select_for_psychologist"
ON public.risk_alerts FOR SELECT
TO anon
USING (psychologist_id = public.current_session_user_id());

DROP POLICY IF EXISTS "risk_alerts_update_for_psychologist" ON public.risk_alerts;
CREATE POLICY "risk_alerts_update_for_psychologist"
ON public.risk_alerts FOR UPDATE
TO anon
USING (psychologist_id = public.current_session_user_id())
WITH CHECK (psychologist_id = public.current_session_user_id());
