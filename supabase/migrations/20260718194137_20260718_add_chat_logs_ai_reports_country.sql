/*
# Add chat logs, AI reports, and country field on profiles

## Purpose
Extiende la bitácora para convertir la app en una plataforma de acompañamiento:
- Chat de IA con guardado de interacciones (logs).
- Reportes terapéuticos diarios generados por IA para el terapeuta.
- Configuración de país en el perfil del paciente (para el botón SOS).

## 1. Modified tables
- `profiles`
  - ADD `country` (text, nullable) — país del paciente en código ISO 3166-1 alpha-2.

## 2. New tables
- `chat_logs` — interacciones del chat de IA (user/assistant).
- `ai_reports` — reportes diarios por paciente (resumen, keywords, sugerencias).

## 3. Security (RLS)
- `chat_logs`: owner-scoped CRUD + SELECT para el terapeuta.
- `ai_reports`: SELECT para paciente (propios) y terapeuta (todos).
- `profiles`, `checkins`, `chat_logs`: SELECT ampliado para el terapeuta (role='psychologist').
*/

-- 1. Add country to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country text;

-- 2. chat_logs
CREATE TABLE IF NOT EXISTS chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS chat_logs_user_created_idx
  ON chat_logs (user_id, created_at DESC);

DROP POLICY IF EXISTS "select_own_chat_logs" ON chat_logs;
CREATE POLICY "select_own_chat_logs" ON chat_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_logs" ON chat_logs;
CREATE POLICY "insert_own_chat_logs" ON chat_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_logs" ON chat_logs;
CREATE POLICY "update_own_chat_logs" ON chat_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_logs" ON chat_logs;
CREATE POLICY "delete_own_chat_logs" ON chat_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3. ai_reports
CREATE TABLE IF NOT EXISTS ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  mood_summary text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  suggestions text NOT NULL,
  raw_context jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_date)
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ai_reports_date_idx
  ON ai_reports (report_date DESC);

-- El paciente puede leer sus propios reportes
DROP POLICY IF EXISTS "select_own_ai_reports" ON ai_reports;
CREATE POLICY "select_own_ai_reports" ON ai_reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- El terapeuta (role='psychologist') puede leer TODOS los reportes
DROP POLICY IF EXISTS "select_all_ai_reports_for_psychologist" ON ai_reports;
CREATE POLICY "select_all_ai_reports_for_psychologist" ON ai_reports FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'psychologist'
    )
  );

-- El terapeuta también puede leer los perfiles de sus pacientes para el dashboard
DROP POLICY IF EXISTS "select_all_profiles_for_psychologist" ON profiles;
CREATE POLICY "select_all_profiles_for_psychologist" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'psychologist'
    )
  );

-- El terapeuta puede leer los checkins de todos (para el dashboard de reportes)
DROP POLICY IF EXISTS "select_all_checkins_for_psychologist" ON checkins;
CREATE POLICY "select_all_checkins_for_psychologist" ON checkins FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'psychologist'
    )
  );

-- El terapeuta puede leer los chat_logs de todos (para el dashboard de reportes)
DROP POLICY IF EXISTS "select_all_chat_logs_for_psychologist" ON chat_logs;
CREATE POLICY "select_all_chat_logs_for_psychologist" ON chat_logs FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'psychologist'
    )
  );

-- INSERT/UPDATE/DELETE owner-scoped para ai_reports
DROP POLICY IF EXISTS "insert_own_ai_reports" ON ai_reports;
CREATE POLICY "insert_own_ai_reports" ON ai_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ai_reports" ON ai_reports;
CREATE POLICY "update_own_ai_reports" ON ai_reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ai_reports" ON ai_reports;
CREATE POLICY "delete_own_ai_reports" ON ai_reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
