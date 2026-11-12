import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Share, X } from 'lucide-react';
import { useT, type Strings } from './lib/i18n';
import { APK_DOWNLOAD_URL } from './lib/appUpdate';

const strings: Strings = {
  es: {
    title: 'Instala Calivia en tu teléfono',
    androidBody: 'Con la app recibes recordatorios y la tienes siempre a mano. Si Android te lo pide, permite instalar apps de esta fuente.',
    iosBody: 'Toca Compartir y luego «Agregar a pantalla de inicio» para abrir Calivia como una app.',
    download: 'Descargar la app',
    close: 'Ahora no',
  },
  en: {
    title: 'Install Calivia on your phone',
    androidBody: 'With the app you get reminders and always have it at hand. If Android asks, allow installing apps from this source.',
    iosBody: 'Tap Share and then “Add to Home Screen” to open Calivia like an app.',
    download: 'Download the app',
    close: 'Not now',
  },
  pt: {
    title: 'Instale a Calivia no seu celular',
    androidBody: 'Com o app você recebe lembretes e o tem sempre à mão. Se o Android pedir, permita instalar apps desta fonte.',
    iosBody: 'Toque em Compartilhar e depois em “Adicionar à Tela de Início” para abrir a Calivia como um app.',
    download: 'Baixar o app',
    close: 'Agora não',
  },
};

const DISMISSED_KEY = 'calivia.install-dismissed';

type Platform = 'android' | 'ios';

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  // iPadOS se presenta como Mac; se distingue por la pantalla táctil.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Invita a instalar la app a quien usa Calivia desde el navegador del teléfono:
// el APK en Android y "Agregar a pantalla de inicio" en iPhone. No aparece en la
// app nativa, en la web ya instalada ni en computadores. Si se cierra, no vuelve
// hasta la próxima sesión del navegador.
export default function InstallPrompt() {
  const t = useT(strings);
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isStandalone() || wasDismissed()) return;
    const detected = detectPlatform();
    if (!detected) return;
    // Un momento de espera para no tapar la pantalla mientras carga.
    const timer = window.setTimeout(() => setPlatform(detected), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!platform) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    setPlatform(null);
  }

  return (
    <div className="install-prompt" role="dialog" aria-label={t('title')}>
      <button type="button" className="install-prompt-x" onClick={dismiss} aria-label={t('close')}>
        <X size={16} strokeWidth={2} />
      </button>
      <div className="install-prompt-text">
        <strong>{t('title')}</strong>
        <span>{platform === 'android' ? t('androidBody') : t('iosBody')}</span>
      </div>
      <div className="install-prompt-actions">
        {platform === 'android' ? (
          <a className="install-prompt-btn" href={APK_DOWNLOAD_URL} onClick={dismiss}>
            <Download size={15} strokeWidth={2} /><span>{t('download')}</span>
          </a>
        ) : (
          <span className="install-prompt-hint"><Share size={15} strokeWidth={2} aria-hidden="true" /></span>
        )}
        <button type="button" className="install-prompt-later" onClick={dismiss}>{t('close')}</button>
      </div>
      <style>{`
        .install-prompt {
          position: fixed; left: 12px; right: 12px; z-index: 440;
          bottom: max(12px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; gap: 10px;
          padding: 14px 40px 14px 16px; border-radius: 16px;
          background: var(--surface); border: 1px solid var(--border);
          box-shadow: var(--shadow-lg); animation: pop 0.25s ease;
          max-width: 480px; margin: 0 auto;
        }
        .install-prompt-x {
          position: absolute; top: 8px; right: 8px; padding: 6px;
          border: none; background: transparent; color: var(--text-soft); cursor: pointer;
        }
        .install-prompt-text { display: flex; flex-direction: column; gap: 3px; }
        .install-prompt-text strong { font-size: 14px; color: var(--text); }
        .install-prompt-text span { font-size: 12.5px; line-height: 1.45; color: var(--text-soft); }
        .install-prompt-actions { display: flex; align-items: center; gap: 10px; }
        .install-prompt-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 999px;
          background: var(--primary); color: #fff; font-size: 13.5px; font-weight: 700; text-decoration: none;
        }
        .install-prompt-hint {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 10px;
          background: var(--bg, transparent); border: 1px solid var(--border); color: var(--primary);
        }
        .install-prompt-later {
          padding: 6px; border: none; background: transparent; color: var(--text-soft); font-size: 13px; cursor: pointer;
        }
      `}</style>
    </div>
  );
}
