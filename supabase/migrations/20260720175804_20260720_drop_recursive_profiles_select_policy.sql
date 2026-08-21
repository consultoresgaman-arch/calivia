/*
# Fix infinite recursion in profiles RLS

1. Problem
   The `profiles` table had TWO SELECT policies:
   - `profiles_select_own_or_psychologist` — uses the SECURITY DEFINER helper
     `is_psychologist()`, which is safe (no RLS recursion because SECURITY
     DEFINER bypasses the caller's RLS context).
   - `select_all_profiles_for_psychologist` — inlined
     `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND
     p.role = 'psychologist')` directly inside a policy on `profiles`.
     Querying `profiles` from within a policy on `profiles` triggers infinite
     recursion: evaluating the policy requires reading the table, which
     requires evaluating the policy, and so on. This produced the error
     "infinite recursion detected in policy for relation profiles" and
     blocked sign-in / sign-up flows that read `profiles`.

2. Change
   Drop the redundant `select_all_profiles_for_psychologist` policy. The
   remaining `profiles_select_own_or_psychologist` policy already covers the
   psychologist case safely via `is_psychologist()` (SECURITY DEFINER), so no
   access is lost.

3. Security
   - No new policies added.
   - SELECT on `profiles` remains owner-scoped OR psychologist-scoped (via
     the SECURITY DEFINER helper), identical in effect to before but without
     the recursive self-reference.
   - INSERT / UPDATE / DELETE policies on `profiles` are unchanged.
   - `checkins` policies are unchanged.

4. Important notes
   1) Do NOT re-add a SELECT policy on `profiles` that queries `profiles`
      inline. Always route role checks through `is_psychologist()`.
   2) The `is_psychologist()` function MUST remain SECURITY DEFINER so it
      bypasses RLS when reading `profiles`; otherwise the recursion returns.
*/
