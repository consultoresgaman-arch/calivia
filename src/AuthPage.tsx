import { useState } from 'react';
import { useAuth } from './lib/auth';
import type { Role } from './lib/types';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(m: 'signin' | 'signup') {
    setError(null);
    setMode(m);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(fullName, password);
      } else {
        await signUp(fullName, password, role);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-glow" />
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo-calivia.png" alt="Calivia" className="auth-logo-img" />
        </div>
        <p className="auth-tagline">Un refugio para acompañarte</p>

        <div className="auth-tabs">
          <button
            className={`atab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
            type="button"
          >
            Iniciar sesión
          </button>
          <button
            className={`atab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
            type="button"
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span>Nombre</span>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Cómo te llaman"
              autoComplete="name"
            />
          </label>

          {mode === 'signup' && (
            <div className="auth-field">
              <span>Rol</span>
              <div className="role-row">
                <button
                  type="button"
                  className={`arole ${role === 'patient' ? 'active' : ''}`}
                  onClick={() => setRole('patient')}
                >
                  Acompañado
                </button>
                <button
                  type="button"
                  className={`arole ${role === 'psychologist' ? 'active' : ''}`}
                  onClick={() => setRole('psychologist')}
                >
                  Especialista
                </button>
              </div>
            </div>
          )}

          <label className="auth-field">
            <span>Contraseña</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Cargando…' : mode === 'signin' ? 'Entrar al refugio' : 'Crear mi refugio'}
          </button>
        </form>
      </div>

      <style>{`
        .auth-wrap {
          min-height: 100vh; min-height: 100dvh;
          display: grid; place-items: center;
          padding: 24px;
          background:
            radial-gradient(ellipse at 30% 20%, rgba(112,130,56,0.10) 0%, transparent 55%),
            radial-gradient(ellipse at 75% 75%, rgba(229,217,182,0.10) 0%, transparent 50%),
            linear-gradient(165deg, #F5F3EE 0%, #EDE9E0 40%, #E0DCD2 100%);
          position: relative; overflow: hidden;
        }
        .auth-glow {
          position: absolute; top: 20%; left: 50%;
          width: 300px; height: 300px;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(168,184,126,0.25) 0%, transparent 70%);
          filter: blur(40px); pointer-events: none;
        }
        .auth-card {
          width: 100%; max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          position: relative; z-index: 1;
          animation: pop 0.3s ease;
        }
        .auth-brand { display: flex; justify-content: center; padding: 32px 24px 4px; }
        .auth-logo-img { display: block; height: 52px; width: auto; object-fit: contain; }
        .auth-tagline { margin: 10px 24px 0; text-align: center; font-size: 14px; color: var(--text-soft); }

        .auth-tabs {
          display: grid; grid-template-columns: 1fr 1fr;
          padding: 0; gap: 0;
        }
        .atab {
          padding: 14px;
          border: none; background: transparent;
          color: var(--text-soft);
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .atab.active {
          color: var(--primary-600);
          border-bottom-color: var(--primary);
          background: var(--surface-2);
        }

        .auth-form {
          padding: 24px 28px 28px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .auth-field { display: flex; flex-direction: column; gap: 6px; }
        .auth-field > span { font-size: 13px; font-weight: 600; color: var(--text-soft); }
        .auth-field input {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--surface-2);
          transition: border-color 0.15s, background 0.15s;
        }
        .auth-field input:focus { border-color: var(--primary); background: var(--surface); outline: none; }

        .role-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .arole {
          padding: 11px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: var(--radius-sm);
          color: var(--text-soft);
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .arole.active {
          border-color: var(--primary);
          color: var(--primary-600);
          background: rgba(176,125,92,0.08);
        }

        .auth-btn {
          margin-top: 4px;
          padding: 14px;
          border: none; border-radius: 14px;
          background: var(--primary);
          color: #fff;
          font-size: 15px; font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.15s;
          box-shadow: 0 4px 16px rgba(112,130,56,0.25);
        }
        .auth-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(112,130,56,0.3); }
        .auth-btn:active { transform: scale(0.99); }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }

        .auth-error {
          background: var(--danger-bg);
          color: var(--danger);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          border: 1px solid rgba(196,91,74,0.15);
        }
      `}</style>
    </div>
  );
}
