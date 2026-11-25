import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { sendReminderPush } from '../_shared/push.ts';

// Recordatorio diario automático: uno en la mañana (09:00) y otro en la noche
// (21:00), hora de Chile. Lo dispara pg_cron (ver migración
// 20261125120000_daily_reminder_cron.sql) dos veces por franja, porque pg_cron
// corre en UTC y Chile cambia de horario: la función mira la hora de Santiago y
// solo envía cuando es exactamente la hora de la franja.
//
// Se despliega con --no-verify-jwt: pg_cron no tiene un JWT. En su lugar exige
// el encabezado x-cron-secret, que se compara con el secreto guardado en Vault.
//
// Cuerpo opcional (para probar a mano):
//   slot     'morning' | 'night'  fuerza la franja sin mirar la hora
//   dryRun   true: no envía, solo cuenta a quién le llegaría

const ZONE = 'America/Santiago';
const HOURS: Record<number, Slot> = { 9: 'morning', 21: 'night' };
// Quien usó la app hace poco no recibe el recordatorio.
const RECENT_ACTIVITY_HOURS = 6;

type Slot = 'morning' | 'night';

// Sin nombres ni datos clínicos: se ven en la pantalla de bloqueo y pasan por Google.
const MESSAGES: Record<Slot, { title: string; body: string }[]> = {
  morning: [
    { title: 'Buenos días 🌿', body: 'Antes de empezar el día, regálate un minuto: respira con nosotros en Calivia.' },
    { title: '¿Cómo amaneciste?', body: 'Cuéntale a Calivia cómo te sientes hoy. Un minuto basta.' },
    { title: 'Un momento para ti ☀️', body: 'Escribe en tu diario lo que quieras soltar antes de empezar el día.' },
    { title: 'Empieza con calma', body: 'Una respiración guiada de un minuto puede cambiar tu mañana.' },
  ],
  night: [
    { title: '¿Cómo estuvo tu día? 🌙', body: 'Suelta lo que te pesa antes de dormir. Tu diario privado te espera.' },
    { title: 'Hora de bajar el ritmo', body: 'Prueba una respiración lenta en Calivia para dormir mejor.' },
    { title: 'Antes de dormir 🌙', body: 'Escribe una cosa pequeña que hiciste bien hoy.' },
    { title: 'Aquí estamos', body: 'Si la cabeza no para, respira con nosotros un minuto.' },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function santiagoNow(): { hour: number; dayIndex: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const dayIndex = Math.floor(Date.UTC(get('year'), get('month') - 1, get('day')) / 86400_000);
  return { hour: get('hour'), dayIndex };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const secret = req.headers.get('x-cron-secret') ?? '';
  const { data: ok, error: authErr } = await supabase.rpc('check_reminder_cron_secret', { p_secret: secret });
  if (authErr || ok !== true) return json({ error: 'No autorizado' }, 403);

  try {
    const input = await req.json().catch(() => ({}));
    const { hour, dayIndex } = santiagoNow();
    const slot: Slot | undefined = input?.slot === 'morning' || input?.slot === 'night' ? input.slot : HOURS[hour];
    if (!slot) return json({ skipped: true, reason: `Son las ${hour}:00 en Chile, fuera de franja` });

    const options = MESSAGES[slot];
    const { title, body } = options[dayIndex % options.length];

    const { data: tokens, error: tokErr } = await supabase.from('device_tokens').select('user_id');
    if (tokErr) throw tokErr;
    const ids = [...new Set((tokens ?? []).map((t) => t.user_id as string))];

    let recipients: string[] = [];
    if (ids.length > 0) {
      const { data, error } = await supabase.from('profiles').select('id').in('id', ids).eq('role', 'patient');
      if (error) throw error;
      recipients = (data ?? []).map((p) => p.id as string);
    }

    if (recipients.length > 0) {
      const cutoff = new Date(Date.now() - RECENT_ACTIVITY_HOURS * 3600_000).toISOString();
      const active = new Set<string>();
      for (const table of ['chat_logs', 'checkins', 'journal_entries', 'sessions']) {
        const { data, error } = await supabase.from(table).select('user_id').in('user_id', recipients).gte('created_at', cutoff);
        if (error) throw error;
        for (const row of data ?? []) active.add(row.user_id as string);
      }
      recipients = recipients.filter((id) => !active.has(id));
    }

    if (input?.dryRun === true) return json({ dryRun: true, slot, title, body, count: recipients.length });

    const result = await sendReminderPush(supabase, recipients, title, body);
    console.log('daily-reminder enviado', { slot, recipients: recipients.length, ...result });
    return json({ slot, title, body, count: recipients.length, ...result });
  } catch (err) {
    console.error('daily-reminder falló:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
