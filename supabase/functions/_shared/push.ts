import type { createClient } from 'npm:@supabase/supabase-js@2.45.4';

type Supabase = ReturnType<typeof createClient>;

export type PushKind = 'crisis' | 'task' | 'task-response';

// Los textos nunca incluyen nombres ni contenido: se muestran en la pantalla de
// bloqueo y pasan por Google. El detalle se ve al entrar a la app.
const PUSH_CONTENT: Record<PushKind, { channelId: string; title: string; body: string }> = {
  crisis: {
    channelId: 'crisis-alerts-v1',
    title: 'Alerta de riesgo',
    body: 'Un paciente requiere tu atención. Abre Calivia.',
  },
  task: {
    channelId: 'new-task-v1',
    title: 'Nueva tarea',
    body: 'Tu especialista te asignó una tarea.',
  },
  'task-response': {
    channelId: 'task-response-v1',
    title: 'Nueva respuesta',
    body: 'Un paciente respondió una tarea.',
  },
};

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64Url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${base64Url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}`);
  const json = await res.json();
  return json.access_token as string;
}

// Best-effort: un fallo de push nunca debe tumbar la alerta, la respuesta ni el
// correo, que siguen siendo la fuente de verdad.
export async function sendPushToUser(supabase: Supabase, userId: string, kind: PushKind): Promise<void> {
  try {
    const rawAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!rawAccount) return;

    const { data: devices, error } = await supabase.from('device_tokens').select('token').eq('user_id', userId);
    if (error) throw error;
    if (!devices || devices.length === 0) return;

    const account = JSON.parse(rawAccount) as ServiceAccount;
    const accessToken = await getAccessToken(account);
    const content = PUSH_CONTENT[kind];

    await Promise.all(devices.map(async ({ token }) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: content.title, body: content.body },
            data: { kind, channelId: content.channelId },
            android: {
              priority: 'HIGH',
              notification: { channel_id: content.channelId, visibility: 'PRIVATE' },
            },
          },
        }),
      });
      if (res.ok) return;
      const detail = await res.text().catch(() => '');
      // Token vencido o de una app desinstalada: se elimina para no reintentar.
      if (res.status === 404 || detail.includes('UNREGISTERED')) {
        await supabase.from('device_tokens').delete().eq('token', token as string);
        return;
      }
      console.error('sendPushToUser: FCM error', res.status, detail.slice(0, 200));
    }));
  } catch (err) {
    console.error('sendPushToUser falló:', err);
  }
}

export interface ReminderResult {
  devices: number;
  sent: number;
  failed: number;
  removed: number;
}

// Recordatorio libre enviado por un administrador (ver admin-reminder). Va sin
// channel_id: la app no tiene canal de recordatorios y Android usa el genérico.
// A diferencia de sendPushToUser, sí lanza error: quien lo llama necesita saber
// si el envío falló.
export async function sendReminderPush(
  supabase: Supabase,
  userIds: string[],
  title: string,
  body: string
): Promise<ReminderResult> {
  const result: ReminderResult = { devices: 0, sent: 0, failed: 0, removed: 0 };
  if (userIds.length === 0) return result;

  const rawAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!rawAccount) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');

  const { data: devices, error } = await supabase.from('device_tokens').select('token').in('user_id', userIds);
  if (error) throw error;
  if (!devices || devices.length === 0) return result;
  result.devices = devices.length;

  const account = JSON.parse(rawAccount) as ServiceAccount;
  const accessToken = await getAccessToken(account);

  await Promise.all(devices.map(async ({ token }) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { kind: 'reminder' },
          android: { priority: 'HIGH', notification: { visibility: 'PRIVATE' } },
        },
      }),
    });
    if (res.ok) {
      result.sent++;
      return;
    }
    const detail = await res.text().catch(() => '');
    if (res.status === 404 || detail.includes('UNREGISTERED')) {
      await supabase.from('device_tokens').delete().eq('token', token as string);
      result.removed++;
      return;
    }
    result.failed++;
    console.error('sendReminderPush: FCM error', res.status, detail.slice(0, 200));
  }));

  return result;
}
