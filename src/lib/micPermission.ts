import { Capacitor, registerPlugin } from '@capacitor/core';

interface MicPermissionPlugin {
  requestMicPermission(): Promise<{ granted: boolean }>;
}

const MicPermission = registerPlugin<MicPermissionPlugin>('MicPermission');

// En Android, el WebView solo concede getUserMedia si la app ya tiene el
// permiso RECORD_AUDIO otorgado a nivel de sistema — si nunca se lo hemos
// pedido de forma nativa, el WebView lo deniega en silencio. Por eso primero
// pasamos por el plugin nativo (MicPermissionPlugin, ver MainActivity.java),
// que dispara el diálogo real de Android, y solo después llamamos a
// getUserMedia (que en navegadores normales es la única vía y es inofensivo).
export async function ensureMicPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      // Si el puente nativo tarda o nunca responde, no dejamos el botón
      // colgado esperando para siempre: a los 5s seguimos con el flujo web.
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('mic-plugin-timeout')), 5000);
      });
      const { granted } = await Promise.race([MicPermission.requestMicPermission(), timeout]);
      if (!granted) return false;
    } catch (err) {
      console.error('[Calivia] MicPermission.requestMicPermission falló o expiró, sigo con getUserMedia como respaldo:', err);
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    console.error('[Calivia] getUserMedia denegó el acceso al micrófono:', err);
    return false;
  }
}
