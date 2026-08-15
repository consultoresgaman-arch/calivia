import { useState } from 'react';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { useLanguage, useT, localizeBackendError } from './lib/i18n';
import LanguageSelector from './LanguageSelector';
import type { Role } from './lib/types';
import strings from './AuthPage.i18n';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { lang } = useLanguage();
  const t = useT(strings);
  const [mode, setMode] = useState<Mode>('signin');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotName, setForgotName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  function switchMode(m: Mode) {
    setError(null);
    setForgotMessage(null);
    if (m === 'forgot') { setForgotStep('request'); setForgotName(fullName); }
    setMode(m);
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-password-reset`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ name: forgotName, lang }),
      });
      const json = await res.json().catch(() => ({}));
      setForgotMessage(json.message || t('requestSentFallback'));
      setForgotStep('reset');
    } catch {
      setError(t('requestFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetWithCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc('reset_password_with_code', {
        p_name: forgotName,
        p_code: resetCode.trim(),
        p_new_password: newPassword,
      });
      if (rpcError) throw rpcError;
      setFullName(forgotName);
      setPassword('');
      setForgotMessage(t('passwordUpdated'));
      setMode('signin');
    } catch (err) {
      setError(err instanceof Error ? localizeBackendError(err.message, lang) : t('invalidOrExpiredCode'));
    } finally {
      setLoading(false);
    }
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
      const msg = err instanceof Error ? localizeBackendError(err.message, lang) : t('unexpectedError');
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
        <p className="auth-tagline">{t('tagline')}</p>

        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button
              className={`atab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => switchMode('signin')}
              type="button"
            >
              {t('signInTab')}
            </button>
            <button
              className={`atab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
              type="button"
            >
              {t('signUpTab')}
            </button>
          </div>
        )}

        {mode === 'forgot' ? (
          <div className="auth-form">
            <button type="button" className="auth-back" onClick={() => switchMode('signin')}>{t('backToSignIn')}</button>
            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestCode} className="auth-form" style={{ padding: 0 }}>
                <label className="auth-field">
                  <span>{t('accountName')}</span>
                  <input
                    type="text"
                    required
                    value={forgotName}
                    onChange={(e) => setForgotName(e.target.value)}
                    placeholder={t('accountNamePlaceholder')}
                  />
                </label>
                {error && <div className="auth-error">{error}</div>}
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('sending') : t('sendCode')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetWithCode} className="auth-form" style={{ padding: 0 }}>
                {forgotMessage && <p className="auth-hint">{forgotMessage}</p>}
                <label className="auth-field">
                  <span>{t('codeLabel')}</span>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="000000"
                  />
                </label>
                <label className="auth-field">
                  <span>{t('newPasswordLabel')}</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('newPasswordPlaceholder')}
                  />
                </label>
                {error && <div className="auth-error">{error}</div>}
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? t('saving') : t('changePassword')}
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>{t('nameLabel')}</span>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoComplete="name"
              />
            </label>

            {mode === 'signup' && (
              <div className="auth-field">
                <span>{t('roleLabel')}</span>
                <div className="role-row">
                  <button
                    type="button"
                    className={`arole ${role === 'patient' ? 'active' : ''}`}
                    onClick={() => setRole('patient')}
                  >
                    {t('rolePatient')}
                  </button>
                  <button
                    type="button"
                    className={`arole ${role === 'psychologist' ? 'active' : ''}`}
                    onClick={() => setRole('psychologist')}
                  >
                    {t('roleSpecialist')}
                  </button>
                </div>
              </div>
            )}

            <label className="auth-field">
              <span>{t('passwordLabel')}</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
              />
            </label>

            {mode === 'signin' && (
              <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>
                {t('forgotPassword')}
              </button>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? t('loading') : mode === 'signin' ? t('enterShelter') : t('createShelter')}
            </button>
          </form>
        )}

        <div className="auth-lang">
          <LanguageSelector compact />
        </div>
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

        .auth-lang {
          display: flex; justify-content: center;
          padding: 0 24px 22px;
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

        .auth-forgot-link {
          align-self: center; border: none; background: transparent;
          color: var(--text-soft); font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: underline; padding: 2px;
        }
        .auth-forgot-link:hover { color: var(--primary-600); }
        .auth-back {
          align-self: flex-start; border: none; background: transparent;
          color: var(--text-soft); font-size: 13px; font-weight: 600;
          cursor: pointer; padding: 4px 0; margin: 4px 0 0;
        }
        .auth-back:hover { color: var(--primary-600); }
        .auth-hint {
          margin: 0; font-size: 13px; color: var(--text-soft);
          background: var(--surface-2); padding: 10px 14px; border-radius: var(--radius-sm);
          line-height: 1.5;
        }

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
