import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useLanguage, useT } from './lib/i18n';
import strings, { NUDGE_MESSAGES } from './MicroPause.i18n';

// Micro-pausas de consciencia: nunca basadas en racha ni en "llevas X días
// sin entrar" — solo una invitación cálida, ocasional, y fácil de rechazar
// sin culpa. Como mucho dos por sesión, cada vez más espaciadas.
const NUDGE_DELAYS_MS = [18 * 60_000, 30 * 60_000];

export default function MicroPause() {
  const { lang } = useLanguage();
  const t = useT(strings);
  const nudgeMessages = NUDGE_MESSAGES[lang];
  const [visible, setVisible] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const nudgeIndexRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    scheduleNext();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleNext() {
    if (nudgeIndexRef.current >= NUDGE_DELAYS_MS.length) return;
    const delay = NUDGE_DELAYS_MS[nudgeIndexRef.current];
    timeoutRef.current = window.setTimeout(() => setVisible(true), delay);
  }

  function dismiss() {
    setVisible(false);
    setBreathing(false);
    nudgeIndexRef.current++;
    scheduleNext();
  }

  function startBreathing() {
    setBreathing(true);
    window.setTimeout(dismiss, 11000);
  }

  if (!visible) return null;

  return (
    <div className="mp-toast anim-pop">
      {!breathing ? (
        <>
          <div className="mp-toast-icon"><Sparkles size={16} strokeWidth={2} /></div>
          <p className="mp-toast-text">{nudgeMessages[nudgeIndexRef.current % nudgeMessages.length]}</p>
          <div className="mp-toast-actions">
            <button type="button" className="mp-yes" onClick={startBreathing}>{t('yes')}</button>
            <button type="button" className="mp-skip" onClick={dismiss}>{t('skip')}</button>
          </div>
        </>
      ) : (
        <div className="mp-breathe">
          <div className="mp-circle" />
          <span>{t('breathe')}</span>
        </div>
      )}
      <button className="mp-close" onClick={dismiss} type="button" aria-label={t('close')}><X size={13} strokeWidth={2} /></button>

      <style>{`
        .mp-toast {
          position: fixed; left: 16px; right: 16px; bottom: 88px; z-index: 60;
          max-width: 380px; margin: 0 auto;
          background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
          box-shadow: var(--shadow-lg); padding: 14px 34px 14px 14px;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .mp-toast-icon { width: 30px; height: 30px; border-radius: 10px; background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .mp-toast-text { flex: 1; min-width: 140px; margin: 0; font-size: 13px; color: var(--text); font-weight: 500; }
        .mp-toast-actions { display: flex; gap: 6px; width: 100%; }
        .mp-yes { flex: 1; padding: 8px; border: none; border-radius: 10px; background: var(--primary); color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; }
        .mp-skip { padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; background: transparent; color: var(--text-soft); font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .mp-close { position: absolute; top: 8px; right: 8px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; }
        .mp-close:hover { background: var(--muted); }

        .mp-breathe { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 6px 0; }
        .mp-circle {
          width: 46px; height: 46px; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-200), var(--primary));
          animation: mpBreathe 5s ease-in-out infinite;
        }
        @keyframes mpBreathe { 0%,100% { transform: scale(0.75); } 50% { transform: scale(1.15); } }
        .mp-breathe span { font-size: 12.5px; color: var(--text-soft); font-weight: 600; }
      `}</style>
    </div>
  );
}
