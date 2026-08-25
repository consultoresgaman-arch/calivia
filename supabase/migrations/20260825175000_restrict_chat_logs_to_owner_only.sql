/*
# Restrict chat_logs to the owner only — psychologists no longer read raw chat content

## Purpose
Calivia's privacy commitment to patients is that a linked psychologist NEVER
gets to read the transcript of their private conversations with Calivia —
only automated crisis alerts and AI-generated daily summaries (already the
case via `ai_reports` and `risk_alerts`). Until now, `chat_logs` had a
policy letting any psychologist SELECT every patient's raw messages
(`chat_logs_select_own_or_psychologist`, from
20260805130000_custom_table_based_auth.sql) — this migration removes that
and replaces the one legitimate use of that data (an activity indicator on
the therapist dashboard's calendar) with a function that only ever returns
"this patient chatted on this date", never the message content itself.

## Changes
- `chat_logs` SELECT policy: owner-only now (dropped the psychologist branch).
- New function `patient_chat_activity_dates()`: returns (user_id,
  activity_date) pairs for the calling psychologist's ACCEPTED-linked
  patients only — no `content`, `role`, or message id, ever.
*/

DROP POLICY IF EXISTS "chat_logs_select_own_or_psychologist" ON public.chat_logs;
CREATE POLICY "chat_logs_select_own"
ON public.chat_logs FOR SELECT
TO anon
USING (user_id = public.current_session_user_id());

CREATE OR REPLACE FUNCTION public.patient_chat_activity_dates()
RETURNS TABLE(user_id uuid, activity_date date)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT cl.user_id, cl.created_at::date AS activity_date
  FROM public.chat_logs cl
  WHERE public.is_psychologist(public.current_session_user_id())
    AND EXISTS (
      SELECT 1 FROM public.patient_links pl
      WHERE pl.patient_id = cl.user_id
        AND pl.psychologist_id = public.current_session_user_id()
        AND pl.status = 'accepted'
    );
$$;

GRANT EXECUTE ON FUNCTION public.patient_chat_activity_dates() TO anon;
