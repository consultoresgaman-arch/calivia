/*
# Recordatorio diario automático (mañana y noche)

pg_cron llama a la Edge Function daily-reminder. pg_cron corre en UTC y Chile
cambia de horario (UTC-3 en verano, UTC-4 en invierno), así que cada franja se
agenda en las dos horas UTC posibles; la función mira la hora de Santiago y solo
envía cuando son las 09:00 o las 21:00, de modo que llega una vez por franja.

  09:00 Chile = 12:00 UTC (verano) o 13:00 UTC (invierno)
  21:00 Chile = 00:00 UTC (verano) o 01:00 UTC (invierno)

La función se despliega sin verificación de JWT; la protege un secreto aleatorio
generado aquí y guardado en Vault, que nunca sale de la base de datos.

Para pausar los recordatorios:
  select cron.unschedule('daily-reminder-morning');
  select cron.unschedule('daily-reminder-night');
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'daily_reminder_cron_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'daily_reminder_cron_secret',
      'Secreto que pg_cron envía a la Edge Function daily-reminder'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_reminder_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(length(p_secret) > 0 AND p_secret = (
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_reminder_cron_secret'
  ), false);
$$;

REVOKE ALL ON FUNCTION public.check_reminder_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_reminder_cron_secret(text) TO service_role;

SELECT cron.schedule('daily-reminder-morning', '0 12,13 * * *', $cmd$
  SELECT net.http_post(
    url := 'https://byyawboynklclantabde.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
$cmd$);

SELECT cron.schedule('daily-reminder-night', '0 0,1 * * *', $cmd$
  SELECT net.http_post(
    url := 'https://byyawboynklclantabde.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
$cmd$);
