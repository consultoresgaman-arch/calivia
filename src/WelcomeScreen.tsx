import { useState, type CSSProperties } from 'react';
import { useT } from './lib/i18n';
import LanguageSelector from './LanguageSelector';
import strings from './WelcomeScreen.i18n';

interface Props {
  onEnter: () => void;
}

export default function WelcomeScreen({ onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);
  const t = useT(strings);

  function handleEnter() {
    setLeaving(true);
    setTimeout(onEnter, 600);
  }

  return (
    <div className={`entry-screen ${leaving ? 'leaving' : ''}`}>
      <div className="entry-aura" />
      <div className="entry-aura entry-aura-2" />
      <div className="entry-stars">
        {STARS.map((s, i) => (
          <span key={i} className="entry-star" style={s} />
        ))}
        {PARTICLES.map((p, i) => (
          <span key={`p${i}`} className="entry-particle" style={p} />
        ))}
      </div>

      <div className="entry-lang anim-fade-slow">
        <LanguageSelector compact dark />
      </div>

      <div className="entry-content">
        <div className="entry-brand anim-fade-slow">
          <img src="/logo-calivia.png" alt="Calivia" className="entry-logo-img" />
        </div>

        <p className="entry-tagline anim-slide" style={{ animationDelay: '0.4s' }}>
          {t('tagline')}
        </p>

        <button
          className="entry-btn anim-slide"
          style={{ animationDelay: '0.7s' }}
          onClick={handleEnter}
          type="button"
        >
          {t('enterBtn')}
        </button>

        <p className="entry-foot anim-fade-slow" style={{ animationDelay: '1.2s' }}>
          {t('footer')}
        </p>
      </div>

      <style>{`
        .entry-screen {
          position: fixed; inset: 0; z-index: 100;
          background:
            radial-gradient(ellipse at 50% 40%, rgba(168,184,126,0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(112,130,56,0.05) 0%, transparent 40%),
            linear-gradient(170deg, #1a1d1a 0%, #222622 50%, #1e2220 100%);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 28px 24px;
          transition: opacity 0.5s ease, filter 0.5s ease;
        }
        .entry-screen.leaving { opacity: 0; filter: blur(12px); pointer-events: none; }

        .entry-lang {
          position: absolute; z-index: 2;
          top: max(16px, env(safe-area-inset-top)); right: 16px;
        }

        .entry-aura {
          position: absolute; top: 50%; left: 50%;
          width: 320px; height: 320px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(168,184,126,0.12) 0%, transparent 60%);
          filter: blur(40px); pointer-events: none;
          animation: breathe 8s ease-in-out infinite;
        }
        .entry-aura-2 {
          top: 70%; left: 30%; width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(112,130,56,0.10) 0%, transparent 60%);
          animation: breathe 11s ease-in-out infinite reverse;
        }

        .entry-stars { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .entry-star {
          position: absolute; width: 3px; height: 3px;
          border-radius: 50%; background: rgba(168,184,126,0.4);
          animation: float 6s ease-in-out infinite;
        }
        .entry-particle {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, rgba(168,184,126,0.55), rgba(168,184,126,0.05) 70%);
          animation-name: drift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes drift {
          0% { transform: translate(0, 0); opacity: 0.15; }
          50% { transform: translate(var(--dx, 18px), var(--dy, -26px)); opacity: 0.55; }
          100% { transform: translate(0, 0); opacity: 0.15; }
        }

        .entry-content {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; gap: 28px;
          max-width: 360px; width: 100%;
        }

        .entry-brand { display: flex; align-items: center; justify-content: center; }
        .entry-logo-img { height: 56px; width: auto; object-fit: contain; }

        .entry-tagline {
          margin: 0; font-size: 17px; line-height: 1.5;
          color: var(--dark-text-soft); text-align: center;
          max-width: 300px;
        }

        .entry-btn {
          padding: 18px 32px;
          border: none; border-radius: 999px;
          background: var(--dark-accent);
          color: #1a1d1a;
          font-size: 16px; font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 24px rgba(168,184,126,0.3), 0 0 0 0 rgba(168,184,126,0.4);
          transition: transform 0.15s, box-shadow 0.3s;
          animation: entryPulse 3s ease-in-out infinite;
          max-width: 340px; width: 100%;
        }
        .entry-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 32px rgba(168,184,126,0.4);
        }
        .entry-btn:active { transform: scale(0.98); }

        @keyframes entryPulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(168,184,126,0.3), 0 0 0 0 rgba(168,184,126,0.3); }
          50% { box-shadow: 0 4px 24px rgba(168,184,126,0.3), 0 0 0 14px rgba(168,184,126,0); }
        }

        .entry-foot {
          margin: 0; font-size: 13px;
          color: var(--dark-text-muted); text-align: center;
        }
      `}</style>
    </div>
  );
}

const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const size = 4 + Math.random() * 10;
  const duration = 9 + Math.random() * 10;
  return {
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDuration: `${duration}s`,
    animationDelay: `${(i * 0.6) % duration}s`,
    '--dx': `${(Math.random() - 0.5) * 60}px`,
    '--dy': `${-20 - Math.random() * 40}px`,
  } as CSSProperties;
});

const STARS = [
  { left: '15%', top: '20%', animationDelay: '0s', animationDuration: '5s' },
  { left: '80%', top: '15%', animationDelay: '1s', animationDuration: '6s' },
  { left: '25%', top: '70%', animationDelay: '0.5s', animationDuration: '4.5s' },
  { left: '70%', top: '65%', animationDelay: '2s', animationDuration: '5.5s' },
  { left: '50%', top: '10%', animationDelay: '1.5s', animationDuration: '7s' },
  { left: '90%', top: '45%', animationDelay: '0.3s', animationDuration: '4s' },
  { left: '10%', top: '50%', animationDelay: '2.5s', animationDuration: '6s' },
] as const;
