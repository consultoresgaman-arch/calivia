import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { getSessionToken } from './session';

// Registrar el dispositivo sin google-services.json hace fallar la app en Android,
// así que solo se activa en builds configurados con VITE_PUSH_ENABLED=true.
const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === 'true' && Capacitor.getPlatform() === 'android';
const TOKEN_KEY = 'calivia.push_token';

// Android no deja cambiar el sonido de un canal ya creado: para cambiar uno, hay
// que subir el sufijo del id, también en supabase/functions/_shared/push.ts.
const CHANNELS = [
  { id: 'crisis-alerts-v1', name: 'Alertas de riesgo', sound: 'task_alarm_urgent.wav', importance: 5 as const },
  { id: 'new-task-v1', name: 'Tareas nuevas', sound: 'task_alarm_chime.wav', importance: 4 as const },
  { id: 'task-response-v1', name: 'Respuestas de pacientes', sound: 'task_alarm_soft.wav', importance: 4 as const },
];

async function callPush(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'x-session-token': getSessionToken() ?? '',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`push ${res.status}`);
}

let listenersReady = false;

async function ensureListeners(): Promise<void> {
  if (listenersReady) return;
  listenersReady = true;

  await PushNotifications.addListener('registration', ({ value }) => {
    try { localStorage.setItem(TOKEN_KEY, value); } catch { /* ignore */ }
    callPush({ action: 'register', token: value }).catch((err) => {
      console.error('[Calivia] no se pudo registrar el dispositivo:', err);
    });
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('[Calivia] registro de push falló:', err);
  });

  // Con la app abierta, Android no muestra la notificación remota: se repite como
  // local para que suene igual, por su mismo canal.
  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const channelId = notification.data?.channelId as string | undefined;
    const channel = CHANNELS.find((c) => c.id === channelId);
    if (!channel) return;
    LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 2147483647) || 1,
        title: notification.title ?? 'Calivia',
        body: notification.body ?? '',
        channelId: channel.id,
        sound: channel.sound,
      }],
    }).catch((err) => console.error('[Calivia] notificación local falló:', err));
  });
}

export async function initPushNotifications(): Promise<void> {
  if (!PUSH_ENABLED) return;
  try {
    for (const channel of CHANNELS) {
      await PushNotifications.createChannel({
        id: channel.id,
        name: channel.name,
        importance: channel.importance,
        visibility: 0,
        vibration: true,
        sound: channel.sound,
      });
    }
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;
    await ensureListeners();
    await PushNotifications.register();
  } catch (err) {
    console.error('[Calivia] initPushNotifications falló:', err);
  }
}

// Se llama antes de borrar la sesión: un teléfono compartido no debe seguir
// recibiendo avisos de una cuenta que ya salió.
export async function unregisterPushNotifications(): Promise<void> {
  if (!PUSH_ENABLED) return;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await callPush({ action: 'unregister', token });
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('[Calivia] unregisterPushNotifications falló:', err);
  }
}

export async function notifyTaskAssigned(taskId: string): Promise<void> {
  try {
    await callPush({ action: 'task-assigned', taskId });
  } catch (err) {
    console.error('[Calivia] notifyTaskAssigned falló:', err);
  }
}
