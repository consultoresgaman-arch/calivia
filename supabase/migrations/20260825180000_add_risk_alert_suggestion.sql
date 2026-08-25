/*
# Add a treatment-suggestion field to risk_alerts

## Purpose
Risk alerts previously only carried a keyword-match "reason" and a raw
excerpt — useful, but the psychologist had to figure out a next step
themselves in the moment. Adds a short, AI-assisted suggested next step
(generated server-side in supabase/functions/ai-chat/index.ts, using the
message that triggered the alert), so the alert itself is actionable.
*/

ALTER TABLE public.risk_alerts
  ADD COLUMN IF NOT EXISTS treatment_suggestion text;
