/*
# Create trusted_contacts table

1. New Tables
- `trusted_contacts`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to the authenticated user, references auth.users ON DELETE CASCADE)
  - `name` (text, not null) — the contact's display name
  - `phone` (text, not null) — the contact's phone number
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `trusted_contacts`.
- Owner-scoped CRUD: each authenticated user can only access rows they own.
- Four policies: select_own, insert_own, update_own, delete_own — all scoped to `TO authenticated` with `auth.uid() = user_id`.

3. Notes
- The `DEFAULT auth.uid()` on `user_id` ensures inserts from the frontend (which omit user_id) still satisfy the INSERT policy's WITH CHECK.
- Each user can store contacts they trust (a friend, family member, or their psychologist) to call in a crisis from the SOS screen.
*/

CREATE TABLE IF NOT EXISTS trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "select_own_trusted_contacts"
ON trusted_contacts FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "insert_own_trusted_contacts"
ON trusted_contacts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "update_own_trusted_contacts"
ON trusted_contacts FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "delete_own_trusted_contacts"
ON trusted_contacts FOR DELETE
TO authenticated USING (auth.uid() = user_id);
