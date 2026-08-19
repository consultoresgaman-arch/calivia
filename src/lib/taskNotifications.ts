import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { TaskItem } from './types';

export const NATIVE = Capacitor.isNativePlatform();

// Catálogo de tonos empaquetados en la app (android/app/src/main/res/raw/*.wav). No es un
// selector del sonido real del celular —Android/iOS no dejan que una app de terceros use
// tonos del sistema en notificaciones propias— así que se ofrece un puñado de tonos propios
// para poder distinguir tareas por oído. `key` se guarda en tasks.reminder_sound.
// Android bloquea cambiar el sonido de un canal ya creado con el mismo id, así que cada
// tono vive en su propio canal (con su propio id) para que el sonido quede fijo desde el
// principio y no dependa de qué canal haya quedado creado antes en el dispositivo.
export const SOUND_OPTIONS = [
  { key: 'classic', file: 'task_alarm.wav', labelKey: 'soundClassic' as const },
  { key: 'soft', file: 'task_alarm_soft.wav', labelKey: 'soundSoft' as const },
  { key: 'urgent', file: 'task_alarm_urgent.wav', labelKey: 'soundUrgent' as const },
  { key: 'chime', file: 'task_alarm_chime.wav', labelKey: 'soundChime' as const },
];
export const DEFAULT_SOUND_KEY = SOUND_OPTIONS[0].key;

export function soundOption(key: string) {
  return SOUND_OPTIONS.find((s) => s.key === key) ?? SOUND_OPTIONS[0];
}

export function channelIdForSound(key: string) {
  return `task-reminders-${soundOption(key).key}-v1`;
}

// Los recordatorios nativos se programan a nivel de sistema operativo (AlarmManager en
// Android, UNUserNotificationCenter en iOS) vía @capacitor/local-notifications, así que
// suenan aunque Calivia esté cerrada o en segundo plano. Cada tarea necesita un id numérico
// estable para poder reprogramarla o cancelarla más tarde; como el id de la tarea es un uuid,
// lo convertimos a un entero de 31 bits con un hash simple y determinista.
export function notifIdFromTaskId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

// Se llama desde cualquier pantalla que pueda crear tareas con recordatorio (la pestaña de
// Tareas y el comando de voz), no solo desde TaskManager — así el canal existe sin importar
// por dónde haya entrado la persona primero. Es idempotente (createChannel con el mismo id
// simplemente reemplaza), así que es seguro llamarla más de una vez.
let channelsEnsured = false;
export async function ensureNotificationChannels() {
  if (!NATIVE || channelsEnsured) return;
  channelsEnsured = true;
  for (const s of SOUND_OPTIONS) {
    try {
      await LocalNotifications.createChannel({
        id: channelIdForSound(s.key),
        name: `Recordatorios de tareas · ${s.key}`,
        description: 'Avisos de tareas con hora programada',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: s.file,
      });
    } catch { /* ignore */ }
  }
}

// Programa (o cancela, si ya no corresponde) la alarma nativa de una tarea. Programar de
// nuevo con el mismo id simplemente reemplaza la alarma anterior, así que es seguro repetirlo.
export async function scheduleTaskReminder(task: TaskItem, reminderTitle: string) {
  if (!NATIVE) return;
  const id = notifIdFromTaskId(task.id);
  const dueMs = task.due_at ? new Date(task.due_at).getTime() : null;
  if (task.done || !dueMs || dueMs <= Date.now()) {
    try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* ignore */ }
    return;
  }
  await ensureNotificationChannels();
  const sound = soundOption(task.reminder_sound);
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: reminderTitle,
        body: task.title,
        channelId: channelIdForSound(sound.key),
        sound: sound.file,
        schedule: { at: new Date(dueMs), allowWhileIdle: true },
      }],
    });
  } catch { /* ignore */ }
}

export async function cancelTaskReminder(taskId: string) {
  if (!NATIVE) return;
  try { await LocalNotifications.cancel({ notifications: [{ id: notifIdFromTaskId(taskId) }] }); } catch { /* ignore */ }
}
