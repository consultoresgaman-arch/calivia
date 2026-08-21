/*
# Bitácora Psicológica — esquema inicial

1. Propósito
   App de bitácora psicológica con dos roles: `patient` (paciente) y
   `psychologist` (psicólogo). Los pacientes registran su ánimo y un mensaje
   diario; los psicólogos ven la lista de pacientes y sus registros.

2. Tablas nuevas
   - `profiles`
     - `id` (uuid, PK, referencia a `auth.users.id`, ON DELETE CASCADE)
     - `email` (text, not null) — copia del email de auth para que las edge
       functions puedan enviar recordatorios sin acceder a `auth.users`.
     - `full_name` (text, nullable) — nombre visible del usuario.
     - `role` (text, not null, default `'patient'`) — `'patient'` o
       `'psychologist'`. Validado por CHECK.
     - `created_at` (timestamptz, default now())
   - `checkins`
     - `id` (uuid, PK)
     - `user_id` (uuid, not null, default `auth.uid()`, FK a `auth.users`,
       ON DELETE CASCADE) — paciente autor del registro.
     - `mood` (smallint, not null, 1..5) — nivel de ánimo (1 muy bajo, 5 muy alto).
     - `message` (text, nullable) — mensaje diario del paciente.
     - `created_at` (timestamptz, default now())

3. Funciones auxiliares
   - `is_psychologist(uid uuid)` — SECURITY DEFINER, STABLE. Devuelve true si
     el usuario indicado tiene rol `psychologist`. Evita recursión de RLS al
     consultar el rol dentro de las políticas.

4. Seguridad (RLS)
   - `profiles`: RLS activado.
     - SELECT: el usuario lee su propio perfil, o un psicólogo lee perfiles de
       pacientes (`role = 'patient'`).
     - INSERT: un usuario puede insertar solo su propio perfil.
     - UPDATE: solo el propio perfil.
     - DELETE: solo el propio perfil.
   - `checkins`: RLS activado.
     - SELECT: el paciente lee sus registros; un psicólogo lee todos.
     - INSERT: el paciente inserta registros propios (`user_id` por defecto
       `auth.uid()`).
     - UPDATE / DELETE: solo el autor.

5. Notas importantes
   1) `user_id` en `checkins` tiene `DEFAULT auth.uid()` para que los inserts
      del cliente (que omiten `user_id`) satisfagan el `WITH CHECK` de RLS.
   2) `profiles.email` se completa desde el cliente justo después del signUp.
   3) Las políticas usan `is_psychologist()` (SECURITY DEFINER) para evitar
      recursión infinita al consultar `profiles` desde una política sobre
      `profiles`.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'psychologist')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mood smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkins_user_id_created_at_idx
  ON public.checkins (user_id, created_at DESC);

-- Función auxiliar para evitar recursión de RLS al consultar el rol.
CREATE OR REPLACE FUNCTION public.is_psychologist(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'psychologist'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- ===== profiles policies =====
DROP POLICY IF EXISTS "profiles_select_own_or_psychologist" ON public.profiles;
CREATE POLICY "profiles_select_own_or_psychologist"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR (public.is_psychologist(auth.uid()) AND role = 'patient')
);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- ===== checkins policies =====
DROP POLICY IF EXISTS "checkins_select_own_or_psychologist" ON public.checkins;
CREATE POLICY "checkins_select_own_or_psychologist"
ON public.checkins FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_psychologist(auth.uid())
);

DROP POLICY IF EXISTS "checkins_insert_own" ON public.checkins;
CREATE POLICY "checkins_insert_own"
ON public.checkins FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins_update_own" ON public.checkins;
CREATE POLICY "checkins_update_own"
ON public.checkins FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checkins_delete_own" ON public.checkins;
CREATE POLICY "checkins_delete_own"
ON public.checkins FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
