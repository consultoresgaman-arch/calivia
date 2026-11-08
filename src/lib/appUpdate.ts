import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface InstallSourcePlugin {
  getInstaller(): Promise<{ installer: string | null }>;
}

const InstallSource = registerPlugin<InstallSourcePlugin>('InstallSource');

// Fijas en el código: el archivo remoto solo informa el número de versión, nunca
// a dónde descargar, para que un cambio en ese archivo no pueda redirigir la descarga.
const VERSION_URL = 'https://calivia.vercel.app/version.json';
export const APK_DOWNLOAD_URL = 'https://calivia.vercel.app/Calivia.apk';
const PLAY_STORE_INSTALLER = 'com.android.vending';

export interface AvailableUpdate {
  versionCode: number;
  versionName: string;
}

// Devuelve la versión nueva si corresponde avisar, o null. Solo en Android y solo
// si la app no vino de Google Play.
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    const { installer } = await InstallSource.getInstaller();
    if (installer === PLAY_STORE_INSTALLER) return null;

    const info = await CapacitorApp.getInfo();
    const installedCode = Number.parseInt(info.build, 10);
    if (!Number.isFinite(installedCode)) return null;

    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const remote = await res.json() as Partial<AvailableUpdate>;
    if (typeof remote.versionCode !== 'number' || typeof remote.versionName !== 'string') return null;

    return remote.versionCode > installedCode
      ? { versionCode: remote.versionCode, versionName: remote.versionName }
      : null;
  } catch (err) {
    console.error('[Calivia] checkForUpdate falló:', err);
    return null;
  }
}
