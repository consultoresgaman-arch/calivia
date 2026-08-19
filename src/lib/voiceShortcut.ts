import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Puente para el acceso directo nativo "Programar por voz" (mantener presionado el ícono de
// la app → ver android/app/src/main/res/xml/shortcuts.xml). Ese shortcut abre MainActivity
// con la URL "calivia://open/voice-task"; acá la detectamos de dos formas, según si la app
// arrancó recién por el shortcut (arranque en frío) o si ya estaba abierta y el shortcut la
// volvió a traer al frente (evento "appUrlOpen" de @capacitor/app).
const VOICE_SHORTCUT_MARKER = 'voice-task';

function isVoiceShortcutUrl(url: string | null | undefined): boolean {
  return !!url && url.includes(VOICE_SHORTCUT_MARKER);
}

let launchWasVoiceShortcut = false;
let resolveReady: () => void;
const readyPromise = new Promise<void>((resolve) => { resolveReady = resolve; });

// Se llama una sola vez, apenas arranca la app (ver PatientDashboard.tsx), para resolver si
// el arranque en frío vino del shortcut. En web/dev (no nativo) no hay nada que resolver.
export function initVoiceShortcut() {
  if (!Capacitor.isNativePlatform()) {
    resolveReady();
    return;
  }
  CapacitorApp.getLaunchUrl()
    .then((res) => { launchWasVoiceShortcut = isVoiceShortcutUrl(res?.url); })
    .catch((err) => console.error('[Calivia] voiceShortcut: getLaunchUrl falló:', err))
    .finally(() => resolveReady());
}

export function voiceShortcutReady(): Promise<void> {
  return readyPromise;
}

export function wasLaunchedFromVoiceShortcut(): boolean {
  return launchWasVoiceShortcut;
}

// Caso "app ya abierta": la persona vuelve a tocar el shortcut con Calivia ya corriendo, y
// Android reusa la Activity (launchMode="singleTask") en vez de un arranque en frío nuevo.
export function onVoiceShortcutReopen(callback: () => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  let handle: { remove: () => void } | null = null;
  CapacitorApp.addListener('appUrlOpen', (data) => {
    if (isVoiceShortcutUrl(data?.url)) callback();
  }).then((h) => { handle = h; });
  return () => { handle?.remove(); };
}
