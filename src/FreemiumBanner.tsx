import { useState } from 'react';
import { Sparkles, X, Zap, Brain, MessageCircle, Music, Gamepad2, TrendingUp, Headphones } from 'lucide-react';
import { isCheckoutConfigured, openCheckout } from './lib/payments';
import { useT } from './lib/i18n';
import strings from './FreemiumBanner.i18n';

interface Props {
  messagesToday: number;
  maxFree: number;
  userId: string;
  name?: string | null;
}

interface Benefit {
  icon: typeof Brain;
  titleKey: 'benefit1Title' | 'benefit2Title' | 'benefit3Title' | 'benefit4Title' | 'benefit5Title' | 'benefit6Title';
  descKey: 'benefit1Desc' | 'benefit2Desc' | 'benefit3Desc' | 'benefit4Desc' | 'benefit5Desc' | 'benefit6Desc';
  accent: string;
}

const BENEFITS: Benefit[] = [
  { icon: Brain, titleKey: 'benefit1Title', descKey: 'benefit1Desc', accent: 'rgba(112,130,56,0.12)' },
  { icon: MessageCircle, titleKey: 'benefit2Title', descKey: 'benefit2Desc', accent: 'rgba(140,138,126,0.12)' },
  { icon: Music, titleKey: 'benefit3Title', descKey: 'benefit3Desc', accent: 'rgba(168,184,126,0.15)' },
  { icon: Gamepad2, titleKey: 'benefit4Title', descKey: 'benefit4Desc', accent: 'rgba(229,217,182,0.25)' },
  { icon: TrendingUp, titleKey: 'benefit5Title', descKey: 'benefit5Desc', accent: 'rgba(112,130,56,0.12)' },
  { icon: Headphones, titleKey: 'benefit6Title', descKey: 'benefit6Desc', accent: 'rgba(140,138,126,0.12)' },
];

export default function FreemiumBanner({ messagesToday, maxFree, userId, name }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const t = useT(strings);

  if (dismissed) return null;
  const remaining = Math.max(0, maxFree - messagesToday);
  const pct = Math.min(100, (messagesToday / maxFree) * 100);

  function goToCheckout() {
    openCheckout({ userId, name });
  }

  return (
    <>
      <div className="freemium-bar">
        <div className="fm-info" onClick={() => setExpanded(true)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(true); }}>
          <div className="fm-badge">
            <Sparkles size={14} strokeWidth={2} />
            <span>{t('badge')}</span>
          </div>
          <span className="fm-limit">
            {remaining > 0
              ? t(remaining === 1 ? 'messagesAvailableOne' : 'messagesAvailableMany', { n: remaining })
              : t('limitReached')}
          </span>
          <div className="fm-progress">
            <div className="fm-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <button className="fm-upgrade-btn" type="button" onClick={(e) => { e.stopPropagation(); setExpanded(true); }}>
            <Zap size={13} strokeWidth={2.5} />
            <span>{t('upgradeBtn')}</span>
          </button>
        </div>
        <button className="fm-dismiss" onClick={() => setDismissed(true)} aria-label={t('closeNotice')} type="button">
          <X size={15} />
        </button>
      </div>

      {expanded && (
        <div className="fm-overlay" onClick={() => setExpanded(false)}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="fm-close" onClick={() => setExpanded(false)} aria-label={t('close')} type="button">
              <X size={20} />
            </button>

            <div className="fm-modal-head">
              <div className="fm-modal-icon">
                <Sparkles size={26} strokeWidth={1.8} />
              </div>
              <h2>{t('modalTitle')}</h2>
              <p>{t('modalSubtitle')}</p>
            </div>

            <div className="fm-price">
              <span className="fm-amount">$8</span>
              <span className="fm-period">{t('pricePeriod')}</span>
            </div>

            <div className="fm-benefit-grid">
              {BENEFITS.map((b, i) => {
                const Icon = b.icon;
                return (
                  <div
                    className="fm-benefit-card"
                    key={b.titleKey}
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div className="fm-benefit-icon" style={{ background: b.accent }}>
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <div className="fm-benefit-body">
                      <h3>{t(b.titleKey)}</h3>
                      <p>{t(b.descKey)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="fm-cta" type="button" onClick={goToCheckout} disabled={!isCheckoutConfigured()}>
              {t('ctaStart')}
            </button>
            {!isCheckoutConfigured() && (
              <p className="fm-fine">{t('paymentConfiguring')}</p>
            )}
            <p className="fm-fine">{t('cancelAnytime')}</p>
          </div>
        </div>
      )}

      <style>{`
        .freemium-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: linear-gradient(135deg, var(--surface-2), var(--bg-warm));
          border: 1px solid var(--border);
          border-radius: 14px;
          margin-bottom: 4px;
        }
        .fm-info {
          display: flex; align-items: center; gap: 12px; flex: 1; flex-wrap: wrap;
          cursor: pointer; min-width: 0;
        }
        .fm-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px;
          background: rgba(112,130,56,0.1);
          color: var(--primary-600);
          border-radius: 999px;
          font-size: 12px; font-weight: 700;
          white-space: nowrap;
        }
        .fm-limit {
          font-size: 13px; color: var(--text-soft); font-weight: 500;
          white-space: nowrap;
        }
        .fm-progress {
          flex: 1; min-width: 60px; max-width: 100px;
          height: 5px; border-radius: 999px;
          background: var(--border);
          overflow: hidden;
        }
        .fm-progress-fill {
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, var(--secondary), var(--primary));
          transition: width 0.4s ease;
        }
        .fm-upgrade-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 12px;
          border: 1.5px solid var(--primary);
          background: transparent;
          color: var(--primary-600);
          border-radius: 999px;
          font-size: 12px; font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .fm-upgrade-btn:hover { background: rgba(112,130,56,0.08); }
        .fm-dismiss {
          border: none; background: transparent;
          color: var(--text-muted);
          cursor: pointer; padding: 4px;
          display: grid; place-items: center;
          border-radius: 50%;
          transition: background 0.15s;
        }
        .fm-dismiss:hover { background: var(--muted); color: var(--text-soft); }

        .fm-overlay {
          position: fixed; inset: 0;
          background: rgba(58,58,54,0.4);
          backdrop-filter: blur(6px);
          display: grid; place-items: center;
          padding: 16px; z-index: 200;
          animation: fadeIn 0.2s ease;
        }
        .fm-modal {
          width: 100%; max-width: 460px;
          background: var(--surface);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          padding: 28px 22px 24px;
          animation: pop 0.25s ease;
          position: relative;
          max-height: 92vh; overflow-y: auto;
        }
        .fm-close {
          position: absolute; top: 16px; right: 16px;
          border: none; background: var(--muted);
          color: var(--text-soft);
          width: 32px; height: 32px;
          border-radius: 50%; cursor: pointer;
          display: grid; place-items: center;
          transition: background 0.15s; z-index: 2;
        }
        .fm-close:hover { background: var(--border); }
        .fm-modal-head { text-align: center; margin-bottom: 18px; }
        .fm-modal-icon {
          width: 56px; height: 56px;
          margin: 0 auto 12px;
          border-radius: 18px;
          background: linear-gradient(135deg, var(--primary-200), var(--primary));
          color: #fff;
          display: grid; place-items: center;
          box-shadow: var(--shadow-warm);
        }
        .fm-modal-head h2 { margin: 0 0 6px; font-size: 20px; font-weight: 700; }
        .fm-modal-head p { margin: 0; font-size: 14px; color: var(--text-soft); }
        .fm-price {
          text-align: center; margin-bottom: 22px;
          display: flex; align-items: baseline; justify-content: center; gap: 6px;
        }
        .fm-amount { font-size: 34px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
        .fm-period { font-size: 15px; color: var(--text-soft); font-weight: 600; }

        .fm-benefit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 22px;
        }
        @media (max-width: 420px) {
          .fm-benefit-grid { grid-template-columns: 1fr; }
        }
        .fm-benefit-card {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 14px;
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-sm);
          background: var(--surface-2);
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
          animation: slideUp 0.4s ease both;
        }
        .fm-benefit-card:hover {
          border-color: var(--primary-200);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(58,58,54,0.06);
        }
        .fm-benefit-icon {
          width: 40px; height: 40px; border-radius: 12px;
          display: grid; place-items: center; flex-shrink: 0;
          color: var(--primary-600);
        }
        .fm-benefit-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .fm-benefit-body h3 {
          margin: 0; font-size: 13.5px; font-weight: 700; color: var(--text);
          line-height: 1.3;
        }
        .fm-benefit-body p {
          margin: 0; font-size: 12px; color: var(--text-soft); line-height: 1.5;
        }

        .fm-cta {
          width: 100%; padding: 15px;
          border: none; border-radius: 14px;
          background: var(--primary);
          color: #fff;
          font-size: 16px; font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.15s;
          box-shadow: 0 4px 16px rgba(112,130,56,0.25);
        }
        .fm-cta:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        .fm-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(112,130,56,0.3); }
        .fm-cta:active { transform: scale(0.99); }
        .fm-fine { text-align: center; margin: 12px 0 0; font-size: 12px; color: var(--text-muted); }
      `}</style>
    </>
  );
}
