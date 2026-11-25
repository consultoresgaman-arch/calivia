import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { sendReminderPush } from '../_shared/push.ts';

// Recordatorio diario automático: uno en la mañana (09:00) y otro en la noche
// (21:00), hora de Chile. Lo dispara pg_cron (ver migración
// 20261125120000_daily_reminder_cron.sql) dos veces por franja, porque pg_cron
// corre en UTC y Chile cambia de horario: la función mira la hora de Santiago y
// solo envía cuando es exactamente la hora de la franja.
//
// Personalización:
//   - El mensaje depende de lo que cada paciente usa más en los últimos 30 días
//     (diario, chat o registro de ánimo), o de si lleva días sin entrar. Si no
//     hay un uso claro, se le invita a respirar.
//   - Solo el de la mañana lleva el nombre. El de la noche nunca: el texto se ve
//     en la pantalla de bloqueo y pasa por Google, y de noche es más fácil que
//     el teléfono quede a la vista de otra persona.
//
// Se despliega con --no-verify-jwt: pg_cron no tiene un JWT. En su lugar exige
// el encabezado x-cron-secret, que se compara con el secreto guardado en Vault.
//
// Cuerpo opcional (para probar a mano):
//   slot     'morning' | 'night'  fuerza la franja sin mirar la hora
//   dryRun   true: no envía, solo cuenta cuántos mensajes de cada tipo saldrían

const ZONE = 'America/Santiago';
const HOURS: Record<number, Slot> = { 9: 'morning', 21: 'night' };
const RECENT_ACTIVITY_HOURS = 6;   // quien usó la app hace poco no recibe nada
const INACTIVE_DAYS = 7;           // desde aquí se le escribe como "te extrañamos"

type Slot = 'morning' | 'night';
type Segment = 'journal' | 'chat' | 'checkin' | 'breathe' | 'inactive';
// {n} se reemplaza por ", Nombre" (o nada si no hay nombre); {N} por "Nombre, " al inicio.
type Message = { title: string; body: string };

const MESSAGES: Record<Slot, Record<Segment, Message[]>> = {
  morning: {
    journal: [
      { title: 'Buenos días{n} ☀️', body: 'Antes de empezar, anota en tu diario cómo amaneciste. Un minuto basta.' },
      { title: 'Buenos días{n} 🌿', body: '¿Qué te gustaría soltar hoy? Tu diario está listo para escucharte.' },
    ],
    chat: [
      { title: 'Buenos días{n} 🌿', body: '¿Cómo amaneciste? Cuéntale a Calivia, aquí estamos para escucharte.' },
      { title: 'Buenos días{n} ☀️', body: 'Si el día empieza pesado, conversa un rato con Calivia antes de salir.' },
    ],
    checkin: [
      { title: 'Buenos días{n} ☀️', body: '¿Cómo te sientes hoy? Registra tu ánimo en un toque.' },
      { title: 'Buenos días{n} 🌿', body: 'Registrar tu ánimo cada día te ayuda a entender tus semanas.' },
    ],
    breathe: [
      { title: 'Buenos días{n} 🌿', body: 'Empieza con calma: un minuto de respiración guiada en Calivia.' },
      { title: 'Buenos días{n} ☀️', body: 'Antes de empezar el día, regálate un minuto para respirar.' },
    ],
    inactive: [
      { title: '{N}te extrañamos 🌿', body: 'Cuando quieras, aquí estamos. Un minuto para ti puede cambiar el día.' },
      { title: 'Hola{n} 💛', body: 'Sin presión: Calivia sigue aquí cuando la necesites.' },
    ],
  },
  night: {
    journal: [
      { title: 'Antes de dormir 🌙', body: 'Escribe en tu diario lo que te dio vueltas hoy y déjalo ahí.' },
      { title: '¿Cómo estuvo tu día? 🌙', body: 'Anota una cosa pequeña que hiciste bien hoy.' },
    ],
    chat: [
      { title: '¿Cómo estuvo tu día? 🌙', body: 'Si algo te quedó dando vueltas, Calivia te escucha antes de dormir.' },
      { title: 'Aquí estamos 🌙', body: 'Conversa un rato antes de dormir. Sin juicios.' },
    ],
    checkin: [
      { title: '¿Cómo terminas el día? 🌙', body: 'Registra tu ánimo antes de dormir, en un toque.' },
      { title: 'Cierra el día con calma 🌙', body: 'Marca cómo te sientes y suelta el resto por hoy.' },
    ],
    breathe: [
      { title: 'Hora de bajar el ritmo 🌙', body: 'Una respiración lenta de un minuto ayuda a dormir mejor.' },
      { title: 'Si la cabeza no para 🌙', body: 'Respira con nosotros un minuto antes de dormir.' },
    ],
    inactive: [
      { title: 'Aquí estamos 🌙', body: 'Si la noche se hace larga, Calivia te acompaña.' },
      { title: 'Te extrañamos 🌙', body: 'Un minuto para ti antes de dormir, cuando quieras.' },
    ],
  },
};

interface Activity {
  user_id: string;
  last_activity: string | null;
  journal_n: number;
  chat_n: number;
  checkin_n: number;
}

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

// Solo el primer nombre, y solo si parece un nombre: nada de correos, números ni textos largos.
function firstName(preferred: string | null, full: string | null): string | null {
  const word = (preferred?.trim() || full?.trim() || '').split(/\s+/)[0] ?? '';
  if (!/^\p{L}[\p{L}'-]{0,19}$/u.test(word)) return null;
  return word.charAt(0).toLocaleUpperCase('es') + word.slice(1);
}

function segmentOf(a: Activity | undefined): Segment {
  const last = a?.last_activity ? new Date(a.last_activity).getTime() : 0;
  if (Date.now() - last > INACTIVE_DAYS * 86400_000) return 'inactive';
  const counts: [Segment, number][] = [['journal', a!.journal_n], ['chat', a!.chat_n], ['checkin', a!.checkin_n]];
  const [top, n] = counts.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return n > 0 ? top : 'breathe';
}

function render(msg: Message, name: string | null): Message {
  const fill = (s: string) => s.replace('{n}', name ? `, ${name}` : '').replace('{N}', name ? `${name}, ` : '');
  const title = fill(msg.title);
  return { title: title.charAt(0).toLocaleUpperCase('es') + title.slice(1), body: fill(msg.body) };
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

    const { data: tokens, error: tokErr } = await supabase.from('device_tokens').select('user_id');
    if (tokErr) throw tokErr;
    const ids = [...new Set((tokens ?? []).map((t) => t.user_id as string))];
    if (ids.length === 0) return json({ slot, count: 0 });

    const { data: profiles, error: profErr } = await supabase
      .from('profiles').select('id, preferred_name, full_name').in('id', ids).eq('role', 'patient');
    if (profErr) throw profErr;

    const { data: activity, error: actErr } = await supabase
      .rpc('reminder_activity', { p_user_ids: (profiles ?? []).map((p) => p.id) });
    if (actErr) throw actErr;
    const byUser = new Map((activity as Activity[] ?? []).map((a) => [a.user_id, a]));

    // Un envío por cada texto distinto: así cada persona recibe el suyo.
    const groups = new Map<string, { msg: Message; ids: string[] }>();
    const perSegment: Record<string, number> = {};
    const recentCutoff = Date.now() - RECENT_ACTIVITY_HOURS * 3600_000;
    for (const p of profiles ?? []) {
      const a = byUser.get(p.id as string);
      if (a?.last_activity && new Date(a.last_activity).getTime() > recentCutoff) continue;
      const segment = segmentOf(a);
      const options = MESSAGES[slot][segment];
      const name = slot === 'morning' ? firstName(p.preferred_name as string | null, p.full_name as string | null) : null;
      const msg = render(options[dayIndex % options.length], name);
      const key = `${msg.title}\n${msg.body}`;
      if (!groups.has(key)) groups.set(key, { msg, ids: [] });
      groups.get(key)!.ids.push(p.id as string);
      perSegment[segment] = (perSegment[segment] ?? 0) + 1;
    }
    const count = [...groups.values()].reduce((n, g) => n + g.ids.length, 0);

    if (input?.dryRun === true) return json({ dryRun: true, slot, count, perSegment });

    const total = { devices: 0, sent: 0, failed: 0, removed: 0 };
    for (const { msg, ids: groupIds } of groups.values()) {
      const r = await sendReminderPush(supabase, groupIds, msg.title, msg.body);
      total.devices += r.devices; total.sent += r.sent; total.failed += r.failed; total.removed += r.removed;
    }
    console.log('daily-reminder enviado', { slot, count, perSegment, ...total });
    return json({ slot, count, perSegment, ...total });
  } catch (err) {
    console.error('daily-reminder falló:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
