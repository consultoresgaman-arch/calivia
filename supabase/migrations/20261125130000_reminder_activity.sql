/*
# Actividad por persona para personalizar el recordatorio diario

daily-reminder elige el mensaje según lo que cada paciente usa más (diario,
chat o registro de ánimo) y detecta a quien lleva días sin entrar. Se calcula
en SQL para no depender del límite de filas de la API y no traer contenido:
solo devuelve conteos y la fecha de la última actividad.

Solo service_role puede llamarla.
*/

CREATE OR REPLACE FUNCTION public.reminder_activity(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, last_activity timestamptz, journal_n int, chat_n int, checkin_n int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    u.id,
    greatest(
      (SELECT max(c.created_at) FROM public.chat_logs c WHERE c.user_id = u.id AND c.role = 'user'),
      (SELECT max(j.created_at) FROM public.journal_entries j WHERE j.user_id = u.id),
      (SELECT max(k.created_at) FROM public.checkins k WHERE k.user_id = u.id),
      (SELECT max(s.created_at) FROM public.sessions s WHERE s.user_id = u.id)
    ),
    (SELECT count(*)::int FROM public.journal_entries j
      WHERE j.user_id = u.id AND j.created_at > now() - interval '30 days'),
    (SELECT count(*)::int FROM public.chat_logs c
      WHERE c.user_id = u.id AND c.role = 'user' AND c.created_at > now() - interval '30 days'),
    (SELECT count(*)::int FROM public.checkins k
      WHERE k.user_id = u.id AND k.created_at > now() - interval '30 days')
  FROM unnest(p_user_ids) AS u(id);
$$;

REVOKE ALL ON FUNCTION public.reminder_activity(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reminder_activity(uuid[]) TO service_role;
