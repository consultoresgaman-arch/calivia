import { useEffect, useRef } from 'react';
import { X, Mail, CalendarClock, Sparkles } from 'lucide-react';
import { isCheckoutConfigured, openCheckout } from './lib/payments';

interface Props {
  open: boolean;
  onClose: () => void;
  isPremium: boolean;
  userId: string;
  name?: string | null;
}

const CALENDLY_URL = 'https://calendly.com/consultoresgaman/30min';
const CONTACT_EMAIL = 'consultoresgaman@gmail.com';

function ensureCalendlyScript(onReady: () => void) {
  if ((window as any).Calendly) {
    onReady();
    return;
  }
  const existing = document.getElementById('calendly-widget-script') as HTMLScriptElement | null;
  if (existing) {
    existing.addEventListener('load', onReady, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.id = 'calendly-widget-script';
  script.src = 'https://assets.calendly.com/assets/external/widget.js';
  script.async = true;
  script.addEventListener('load', onReady, { once: true });
  document.body.appendChild(script);
}

export default function ScheduleModal({ open, onClose, isPremium, userId, name }: Props) {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    ensureCalendlyScript(() => {
      if (cancelled || !widgetRef.current) return;
      const Calendly = (window as any).Calendly;
      if (Calendly?.initInlineWidget) {
        widgetRef.current.innerHTML = '';
        Calendly.initInlineWidget({ url: CALENDLY_URL, parentElement: widgetRef.current });
      }
    });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="schedule-overlay">
      <div className="schedule-bar">
        <button className="schedule-close" onClick={onClose} type="button"><X size={20} /><span>Volver</span></button>
      </div>

      <div className="schedule-info">
        {isPremium ? (
          <p className="schedule-price schedule-price-premium">
            <Sparkles size={15} strokeWidth={2} />
            Inversión preferencial por ser miembro: <strong>$25.000 CLP</strong> <span>(~$27 USD)</span>
          </p>
        ) : (
          <>
            <p className="schedule-price">
              <CalendarClock size={15} strokeWidth={2} />
              Inversión por la sesión: <strong>$35.000 CLP</strong> <span>(~$38 USD)</span>
            </p>
            {isCheckoutConfigured() && (
              <button type="button" className="schedule-upsell" onClick={() => openCheckout({ userId, name })}>
                ¿Quieres ahorrar $10.000 CLP (~$11 USD) en esta sesión? Hazte miembro Premium aquí
              </button>
            )}
          </>
        )}
        <a className="schedule-contact" href={`mailto:${CONTACT_EMAIL}`}>
          <Mail size={14} strokeWidth={2} /><span>¿Dudas antes de agendar? {CONTACT_EMAIL}</span>
        </a>
      </div>

      <div className="schedule-widget-wrap">
        <div ref={widgetRef} className="schedule-widget" />
      </div>

      <style>{`
        .schedule-overlay {
          position: fixed; inset: 0; z-index: 250;
          background: var(--bg);
          display: flex; flex-direction: column; animation: fadeIn 0.3s ease;
        }
        .schedule-bar { display: flex; align-items: center; padding: 14px 20px; padding-top: max(14px, env(safe-area-inset-top)); }
        .schedule-close { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .schedule-close:hover { background: var(--muted); color: var(--text); }

        .schedule-info {
          margin: 0 20px 12px; padding: 12px 16px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
          display: flex; flex-direction: column; gap: 6px;
        }
        .schedule-price { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--text); flex-wrap: wrap; }
        .schedule-price strong { color: var(--primary-600); }
        .schedule-price span { color: var(--text-soft); font-weight: 500; font-size: 12px; }
        .schedule-price-premium {
          padding: 7px 10px; margin: -1px -2px 1px; border-radius: 10px;
          background: rgba(196,154,90,0.10); color: var(--text);
        }
        .schedule-price-premium strong { color: var(--warn); }
        .schedule-price-premium svg { color: var(--warn); flex-shrink: 0; }
        .schedule-upsell {
          align-self: flex-start; margin: -2px 0 0; padding: 0; border: none; background: none;
          font-size: 11.5px; color: var(--text-soft); text-decoration: underline; cursor: pointer; text-align: left;
        }
        .schedule-upsell:hover { color: var(--primary-600); }
        .schedule-contact { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--primary-600); text-decoration: none; }
        .schedule-contact:hover { text-decoration: underline; }

        .schedule-widget-wrap { flex: 1; min-height: 0; padding: 0 20px 20px; padding-bottom: max(20px, env(safe-area-inset-bottom)); }
        .schedule-widget { width: 100%; height: 100%; min-height: 560px; }
      `}</style>
    </div>
  );
}
