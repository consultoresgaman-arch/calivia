import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { sendReminderPush } from '../_shared/push.ts';

// Recordatorio push enviado por un administrador. Mismo criterio que las
// funciones admin_* de SQL: solo service_role puede usarla. Se invoca desde el
// panel de Supabase (Edge Functions > admin-reminder > Test, rol service_role)
// o con curl usando la service_role key.
//
// Cuerpo:
//   title, body           texto de la notificación (sin nombres ni datos clínicos:
//                         se ve en la pantalla de bloqueo y pasa por Google)
//   role                  'patient' (por defecto) | 'psychologist' | 'all'
//   userIds               opcional: solo estas cuentas
//   excludeUserIds        opcional: cuentas a omitir (p. ej. las propias de prueba)
//   inactiveDays          opcional: solo quien no usa la app hace N días o más
//   send                  true para enviar; si falta, solo muestra a quién llegaría

const MAX_TITLE = 65;
const MAX_BODY = 240;
const MAX_IDS = 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// verify_jwt ya validó la firma en el gateway, así que el claim es confiable.
function isServiceRole(req: Request): boolean {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const payload = token.split('.')[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

function isUuidList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_IDS &&
    value.every((v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Solo administradores (service_role)' }, 403);

  try {
    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') return json({ error: 'Cuerpo JSON inválido' }, 400);

    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (!title || title.length > MAX_TITLE) return json({ error: `title obligatorio, máx. ${MAX_TITLE} caracteres` }, 400);
    if (!body || body.length > MAX_BODY) return json({ error: `body obligatorio, máx. ${MAX_BODY} caracteres` }, 400);

    const role = input.role ?? 'patient';
    if (!['patient', 'psychologist', 'all'].includes(role)) return json({ error: 'role inválido' }, 400);
    if (input.userIds !== undefined && !isUuidList(input.userIds)) return json({ error: 'userIds inválido' }, 400);
    if (input.excludeUserIds !== undefined && !isUuidList(input.excludeUserIds)) return json({ error: 'excludeUserIds inválido' }, 400);
    const inactiveDays = input.inactiveDays;
    if (inactiveDays !== undefined && !(Number.isInteger(inactiveDays) && inactiveDays >= 1 && inactiveDays <= 3650)) {
      return json({ error: 'inactiveDays debe ser un entero entre 1 y 3650' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Solo cuentas con teléfono registrado: al resto no se le puede notificar.
    const { data: tokens, error: tokErr } = await supabase.from('device_tokens').select('user_id');
    if (tokErr) throw tokErr;
    let ids = [...new Set((tokens ?? []).map((t) => t.user_id as string))];

    if (input.userIds) {
      const wanted = new Set(input.userIds as string[]);
      ids = ids.filter((id) => wanted.has(id));
    }
    if (input.excludeUserIds) {
      const excluded = new Set(input.excludeUserIds as string[]);
      ids = ids.filter((id) => !excluded.has(id));
    }

    let profiles: { id: string; full_name: string | null; role: string }[] = [];
    if (ids.length > 0) {
      let query = supabase.from('profiles').select('id, full_name, role, created_at').in('id', ids);
      if (role !== 'all') query = query.eq('role', role);
      if (inactiveDays) {
        // Una cuenta recién creada tampoco cuenta como inactiva.
        query = query.lt('created_at', new Date(Date.now() - inactiveDays * 86400_000).toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      profiles = data ?? [];
    }

    if (inactiveDays && profiles.length > 0) {
      const cutoff = new Date(Date.now() - inactiveDays * 86400_000).toISOString();
      const candidateIds = profiles.map((p) => p.id);
      const active = new Set<string>();
      for (const table of ['chat_logs', 'checkins', 'journal_entries', 'sessions']) {
        const { data, error } = await supabase.from(table).select('user_id').in('user_id', candidateIds).gte('created_at', cutoff);
        if (error) throw error;
        for (const row of data ?? []) active.add(row.user_id as string);
      }
      profiles = profiles.filter((p) => !active.has(p.id));
    }

    const recipients = profiles.map((p) => ({ id: p.id, name: p.full_name, role: p.role }));

    if (input.send !== true) {
      return json({ preview: true, title, body, count: recipients.length, recipients });
    }

    const result = await sendReminderPush(supabase, recipients.map((r) => r.id), title, body);
    console.log('admin-reminder enviado', { recipients: recipients.length, ...result });
    return json({ preview: false, title, body, count: recipients.length, ...result });
  } catch (err) {
    console.error('admin-reminder falló:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
