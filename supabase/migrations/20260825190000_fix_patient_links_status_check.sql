/*
# Fix patient_links.status check constraint to allow 'code_issued'

## Why
20260825170000_patient_link_invite_and_code_flow.sql used
`ADD COLUMN IF NOT EXISTS status ... CHECK (...)`, assuming `status` was
brand new. It wasn't: the live database already had a `status` column (from
a legacy schema layer never captured in this repo's migrations, discovered
via smoke-testing this flow), with its own
`patient_links_status_check CHECK (status IN ('pending','accepted'))` and a
default of 'accepted'. Since the column already existed, `ADD COLUMN IF NOT
EXISTS` was a no-op — the new three-state constraint was never actually
applied, so writing 'code_issued' (via accept_patient_link()) failed the
old constraint. This replaces that constraint with the correct one and
fixes the default to 'pending' (new invites should not default to
'accepted').
*/

ALTER TABLE public.patient_links DROP CONSTRAINT IF EXISTS patient_links_status_check;
ALTER TABLE public.patient_links ADD CONSTRAINT patient_links_status_check CHECK (status IN ('pending', 'code_issued', 'accepted'));
ALTER TABLE public.patient_links ALTER COLUMN status SET DEFAULT 'pending';
