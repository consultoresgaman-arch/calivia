import { useState } from 'react';
import { Heart } from 'lucide-react';

interface Props {
  onEnter: () => void;
}

export default function WelcomeScreen({ onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);

  function handleEnter() {
    setLeaving(true);
    setTimeout(onEnter, 600);
  }

  return (
    <div className={`entry-screen ${leaving ? 'leaving' : ''}`}>
      <div className="entry-aura" />
      <div className="entry-stars">
        {STARS.map((s, i) => (
          <span key={i} className="entry-star" style={s} />
        ))}
      </div>

      <div className="entry-content">
        <div className="entry-brand anim-fade-slow">
          <div className="entry-logo">
            <Heart size={24} strokeWidth={1.5} />
          </div>
          <span className="entry-name">Calivia</span>
        </div>

        <p className="entry-tagline anim-slide" style={{ animationDelay: '0.4s' }}>
          Un refugio para cuando el ruido es demasiado.
        </p>

        <button
          className="entry-btn anim-slide"
          style={{ animationDelay: '0.7s' }}
          onClick={handleEnter}
          type="button"
        >
          No me siento bien ahora mismo
        </button>

        <p className="entry-foot anim-fade-slow" style={{ animationDelay: '1.2s' }}>
          Sin registros. Sin contraseñas. Solo respira y entra.
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

        .entry-aura {
          position: absolute; top: 50%; left: 50%;
          width: 320px; height: 320px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(168,184,126,0.12) 0%, transparent 60%);
          filter: blur(40px); pointer-events: none;
          animation: breathe 8s ease-in-out infinite;
        }

        .entry-stars { position: absolute; inset: 0; pointer-events: none; }
        .entry-star {
          position: absolute; width: 3px; height: 3px;
          border-radius: 50%; background: rgba(168,184,126,0.4);
          animation: float 6s ease-in-out infinite;
        }

        .entry-content {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; gap: 28px;
          max-width: 360px; width: 100%;
        }

        .entry-brand { display: flex; align-items: center; gap: 10px; }
        .entry-logo {
          width: 44px; height: 44px; border-radius: 14px;
          background: rgba(168,184,126,0.15);
          color: var(--dark-accent);
          display: grid; place-items: center;
          border: 1px solid rgba(168,184,126,0.2);
        }
        .entry-name {
          font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em; color: var(--dark-text);
        }

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

const STARS = [
  { left: '15%', top: '20%', animationDelay: '0s', animationDuration: '5s' },
  { left: '80%', top: '15%', animationDelay: '1s', animationDuration: '6s' },
  { left: '25%', top: '70%', animationDelay: '0.5s', animationDuration: '4.5s' },
  { left: '70%', top: '65%', animationDelay: '2s', animationDuration: '5.5s' },
  { left: '50%', top: '10%', animationDelay: '1.5s', animationDuration: '7s' },
  { left: '90%', top: '45%', animationDelay: '0.3s', animationDuration: '4s' },
  { left: '10%', top: '50%', animationDelay: '2.5s', animationDuration: '6s' },
] as const;
