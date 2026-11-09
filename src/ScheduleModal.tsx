import { useEffect, useState } from 'react';
import { X, CalendarClock, Mail, BadgeCheck, Info } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useLanguage, useT } from './lib/i18n';
import { localizeCountryLabel } from './lib/crisis';
import strings from './ScheduleModal.i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Specialist {
  id: string;
  full_name: string;
  professional_title: string | null;
  bio: string | null;
  country: string | null;
  booking_url: string;
  session_price: string | null;
  is_linked: boolean;
}

const CONTACT_EMAIL = 'consultoresgaman@gmail.com';

// Si el directorio no se puede cargar, "Agendar" sigue funcionando como antes.
const FALLBACK_BOOKING_URL = 'https://calendly.com/consultoresgaman/60min';
const FALLBACK_PRICE = '$35.000 CLP (~$38 USD)';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}

export default function ScheduleModal({ open, onClose }: Props) {
  const t = useT(strings);
  const { lang } = useLanguage();
  const [specialists, setSpecialists] = useState<Specialist[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadFailed(false);
    (async () => {
      const { data, error } = await supabase.rpc('list_directory_specialists');
      if (!mounted) return;
      if (error) {
        console.error('[Calivia] list_directory_specialists falló:', error);
        setLoadFailed(true);
        return;
      }
      setSpecialists((data ?? []) as Specialist[]);
    })();
    return () => { mounted = false; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="schedule-overlay">
      <div className="schedule-bar">
        <button className="schedule-close" onClick={onClose} type="button"><X size={20} /><span>{t('back')}</span></button>
      </div>

      <div className="schedule-body">
        <h2 className="schedule-title">{t('title')}</h2>

        {loadFailed ? (
          <div className="schedule-card">
            <p className="schedule-price">
              <CalendarClock size={15} strokeWidth={2} />
              {t('regularPricePrefix')} <strong>{FALLBACK_PRICE}</strong>
            </p>
            <a className="schedule-book" href={FALLBACK_BOOKING_URL} target="_blank" rel="noopener noreferrer">
              {t('bookButton')}
            </a>
          </div>
        ) : specialists === null ? (
          <p className="schedule-muted">{t('loading')}</p>
        ) : specialists.length === 0 ? (
          <p className="schedule-muted">{t('empty')}</p>
        ) : (
          specialists.map((s) => (
            <article key={s.id} className="schedule-card">
              <div className="schedule-head">
                <div className="schedule-avatar" aria-hidden="true">{initials(s.full_name)}</div>
                <div>
                  <h3>{s.full_name}</h3>
                  {s.professional_title && <p className="schedule-role">{s.professional_title}</p>}
                  {s.is_linked && <span className="schedule-linked">{t('yourSpecialist')}</span>}
                </div>
              </div>

              {/* Solo aparecen especialistas con aprobación vigente. El número de
                  registro no se muestra para que no se pueda copiar. */}
              <p className="schedule-license">
                <BadgeCheck size={14} strokeWidth={2} />
                <span>
                  {t('verified')}
                  {s.country ? ` · ${localizeCountryLabel(s.country, lang)}` : ''}
                </span>
              </p>

              {s.bio && <p className="schedule-bio">{s.bio}</p>}

              {s.session_price && (
                <p className="schedule-price">
                  <CalendarClock size={15} strokeWidth={2} />
                  {t('regularPricePrefix')} <strong>{s.session_price}</strong>
                </p>
              )}

              {/* Se abre fuera de la app: un widget de agenda ejecutaría código de
                  terceros en el mismo origen que la sesión del usuario. */}
              <a className="schedule-book" href={s.booking_url} target="_blank" rel="noopener noreferrer">
                {t('bookButton')}
              </a>
            </article>
          ))
        )}

        <p className="schedule-notice">
          <Info size={14} strokeWidth={2} />
          <span>{t('notice')}</span>
        </p>

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
        .schedule-body {
          flex: 1; overflow-y: auto; width: 100%; max-width: 560px; margin: 0 auto;
          padding: 0 20px max(20px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; gap: 12px;
        }
        .schedule-title { margin: 0 0 2px; font-size: 18px; font-weight: 700; color: #fff; }
        .schedule-muted { margin: 0; font-size: 13.5px; color: rgba(255,255,255,0.75); }
        .schedule-card {
          padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
          display: flex; flex-direction: column; gap: 10px;
        }
        .schedule-head { display: flex; align-items: center; gap: 12px; }
        .schedule-avatar {
          width: 46px; height: 46px; flex-shrink: 0; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-200), var(--primary));
          color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 16px;
        }
        .schedule-head h3 { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--text); }
        .schedule-role { margin: 2px 0 0; font-size: 13px; color: var(--text-soft); }
        .schedule-linked { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 999px; background: rgba(112,130,56,0.12); color: var(--primary-600); font-size: 11.5px; font-weight: 700; }
        .schedule-license { margin: 0; display: flex; align-items: flex-start; gap: 6px; font-size: 12.5px; color: var(--primary-600); }
        .schedule-license svg { flex-shrink: 0; margin-top: 1px; }
        .schedule-bio { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--text); white-space: pre-wrap; word-break: break-word; }
        .schedule-price { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 13px; color: var(--text); }
        .schedule-price strong { color: var(--primary-600); }
        .schedule-book { padding: 13px 16px; border-radius: 14px; background: var(--primary); color: #fff; font-size: 15px; font-weight: 700; text-align: center; text-decoration: none; }
        .schedule-notice { margin: 0; display: flex; gap: 7px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.75); }
        .schedule-notice svg { flex-shrink: 0; margin-top: 1px; }
        .schedule-contact { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: var(--primary-200); text-decoration: none; }
        .schedule-contact:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
