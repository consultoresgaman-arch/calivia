import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Download, X } from 'lucide-react';
import { useT, type Strings } from './lib/i18n';
import { APK_DOWNLOAD_URL, checkForUpdate, type AvailableUpdate } from './lib/appUpdate';

const strings: Strings = {
  es: {
    title: 'Hay una nueva versión de Calivia ({{version}})',
    body: 'Descárgala e instálala sobre la actual. Conservas tu cuenta y tus datos.',
    update: 'Actualizar',
    later: 'Ahora no',
  },
  en: {
    title: 'A new version of Calivia is available ({{version}})',
    body: 'Download it and install it over the current one. You keep your account and data.',
    update: 'Update',
    later: 'Not now',
  },
  pt: {
    title: 'Há uma nova versão da Calivia ({{version}})',
    body: 'Baixe e instale sobre a atual. Você mantém sua conta e seus dados.',
    update: 'Atualizar',
    later: 'Agora não',
  },
};

const DISMISSED_KEY = 'calivia.update-dismissed';

function readDismissed(): number {
  try {
    return Number.parseInt(localStorage.getItem(DISMISSED_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

// Aviso de actualización para el APK instalado fuera de Google Play. Si se descarta,
// vuelve a aparecer solo cuando salga una versión más nueva que la descartada.
export default function UpdateNotice() {
  const t = useT(strings);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let mounted = true;

    async function check() {
      const available = await checkForUpdate();
      if (!mounted) return;
      setUpdate(available && available.versionCode > readDismissed() ? available : null);
    }

    void check();
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void check();
    });
    return () => {
      mounted = false;
      void listener.then((handle) => handle.remove());
    };
  }, []);

  if (!update) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(update!.versionCode));
    } catch {
      /* ignore */
    }
    setUpdate(null);
  }

  return (
    <div className="update-notice" role="status">
      <div className="update-notice-text">
        <strong>{t('title', { version: update.versionName })}</strong>
        <span>{t('body')}</span>
      </div>
      <div className="update-notice-actions">
        <a className="update-notice-btn" href={APK_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
          <Download size={15} strokeWidth={2} /><span>{t('update')}</span>
        </a>
        <button type="button" className="update-notice-later" onClick={dismiss} aria-label={t('later')}>
          <X size={14} strokeWidth={2} /><span>{t('later')}</span>
        </button>
      </div>
      <style>{`
        .update-notice {
          position: fixed; left: 12px; right: 12px; z-index: 450;
          top: max(12px, env(safe-area-inset-top));
          display: flex; flex-direction: column; gap: 10px;
          padding: 14px 16px; border-radius: 16px;
          background: var(--surface); border: 1px solid var(--border);
          box-shadow: var(--shadow-lg); animation: pop 0.25s ease;
        }
        .update-notice-text { display: flex; flex-direction: column; gap: 3px; }
        .update-notice-text strong { font-size: 14px; color: var(--text); }
        .update-notice-text span { font-size: 12.5px; line-height: 1.45; color: var(--text-soft); }
        .update-notice-actions { display: flex; align-items: center; gap: 10px; }
        .update-notice-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 999px;
          background: var(--primary); color: #fff; font-size: 13.5px; font-weight: 700; text-decoration: none;
        }
        .update-notice-later {
          display: inline-flex; align-items: center; gap: 4px; padding: 6px;
          border: none; background: transparent; color: var(--text-soft); font-size: 13px; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
