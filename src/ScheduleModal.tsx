import { X, CalendarClock, Mail } from 'lucide-react';
import { useT } from './lib/i18n';
import strings from './ScheduleModal.i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CALENDLY_URL = 'https://calendly.com/consultoresgaman/60min';
const CONTACT_EMAIL = 'consultoresgaman@gmail.com';

export default function ScheduleModal({ open, onClose }: Props) {
  const t = useT(strings);

  if (!open) return null;

  return (
    <div className="schedule-overlay">
      <div className="schedule-bar">
        <button className="schedule-close" onClick={onClose} type="button"><X size={20} /><span>{t('back')}</span></button>
      </div>

      <div className="schedule-info">
        <p className="schedule-price">
          <CalendarClock size={15} strokeWidth={2} />
          {t('regularPricePrefix')} <strong>$35.000 CLP</strong> <span>(~$38 USD)</span>
        </p>
        {/* Se abre fuera de la app: el widget de Calendly ejecutaría código de terceros
            en el mismo origen que la sesión del usuario. */}
        <a className="schedule-book" href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
          {t('bookButton')}
        </a>
        <a className="schedule-contact" href={`mailto:${CONTACT_EMAIL}`}>
          <Mail size={14} strokeWidth={2} /><span>{t('contact', { email: CONTACT_EMAIL })}</span>
        </a>
      </div>

      <style>{`
        .schedule-overlay {
          position: fixed; inset: 0; z-index: 250;
          background: var(--bg);
          display: flex; flex-direction: column; animation: fadeIn 0.3s ease;
        }
        .schedule-bar { display: flex; align-items: center; padding: 14px 20px; padding-top: max(14px, env(safe-area-inset-top)); }
        .schedule-close { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-soft); font-size: 13px; font-weight: 600; cursor: pointer; }
        .schedule-close:hover { background: var(--muted); color: var(--text); }
        .schedule-info {
          margin: 0 20px 12px; padding: 16px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
          display: flex; flex-direction: column; gap: 12px;
        }
        .schedule-price { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 13px; color: var(--text); }
        .schedule-price strong { color: var(--primary-600); }
        .schedule-price span { color: var(--text-soft); font-weight: 500; font-size: 12px; }
        .schedule-book { padding: 13px 16px; border-radius: 14px; background: var(--primary); color: #fff; font-size: 15px; font-weight: 700; text-align: center; text-decoration: none; }
        .schedule-contact { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--primary-600); text-decoration: none; }
        .schedule-contact:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
