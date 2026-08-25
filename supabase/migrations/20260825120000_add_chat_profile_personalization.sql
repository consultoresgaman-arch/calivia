/*
# Add profile personalization fields for chat onboarding

## Purpose
Soporta el flujo de presentación de Calivia en el chat: guardar cómo la
persona quiere que Calivia se dirija a ella y a qué se dedica, para poder
personalizar sus respuestas y consejos, y un timestamp para saber si ya se
le hizo la pregunta de presentación (y así no repetirla en cada turno
mientras se espera la respuesta).

## Changes
- `profiles.preferred_name` (text, nullable): nombre o apodo por el que
  Calivia debe dirigirse a la persona.
- `profiles.occupation` (text, nullable): a qué se dedica, para personalizar
  ejemplos y consejos.
- `profiles.name_prompt_sent_at` (timestamptz, nullable): cuándo se le
  preguntó por última vez cómo dirigirse a ella (evita repetir la pregunta
  de presentación en cada mensaje mientras se espera la respuesta).

No se tocan las políticas RLS: `profiles_update_own` (creada en
20260805130000_custom_table_based_auth.sql) ya permite a cada persona
actualizar cualquier columna de su propia fila, y la función `ai-chat`
(supabase/functions/ai-chat/index.ts) usa la service role key, que además
no está sujeta a RLS.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS name_prompt_sent_at timestamptz;
