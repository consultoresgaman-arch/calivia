import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import { useLanguage, useT } from './lib/i18n';
import strings, { NON_SPANISH_NOTE } from './TermsGate.i18n';

// Sube este valor si el texto legal cambia de forma material — todo perfil
// con terms_version distinto (o null) vuelve a ver esta pantalla.
export const CURRENT_TERMS_VERSION = 'v1';

const POLICY_TEXT = `POLÍTICA DE PRIVACIDAD Y TÉRMINOS DE ACOMPAÑAMIENTO – CALIVIA

1. Naturaleza del Servicio: Calivia es una herramienta digital de acompañamiento, reflexión y desarrollo personal impulsada por inteligencia artificial. Calivia NO es un servicio de psicoterapia clínica, psiquiatría, ni un centro de atención de urgencias médicas o psicológicas. El uso de la aplicación no reemplaza ni sustituye el diagnóstico, tratamiento o seguimiento de un profesional de la salud mental en un entorno clínico.

2. Privacidad y Confidencialidad Absoluta de las Conversaciones: La privacidad de tus espacios internos es sagrada. Ninguna persona física —incluyendo al equipo desarrollador, administradores y al psicólogo responsable de la plataforma— tiene acceso al contenido de las conversaciones, chats o reflexiones íntimas que mantienes con Calivia. Los datos de tus mensajes se almacenan de forma cifrada y segura exclusivamente para que la inteligencia artificial pueda mantener la memoria de tu proceso de crecimiento personal.

3. Vínculo Profesional y Alertas de Crisis: Si decides voluntariamente vincular/enrolar tu cuenta con un profesional de la salud mental dentro de la plataforma:
- El profesional NUNCA tendrá acceso a la transcripción, detalles ni contenido de tus conversaciones privadas.
- El sistema únicamente emitirá y enviará al profesional vinculado una alerta automatizada de riesgo o crisis en caso de que detecte patrones que requieran atención urgente, con el único fin de salvaguardar tu seguridad e integridad física.

4. Aceptación del Usuario: Al registrarte y utilizar Calivia, confirmas que has leído y comprendido la naturaleza de esta aplicación, aceptando sus términos de uso y el tratamiento seguro de tus datos bajo los estándares descritos en esta política.`;

export default function TermsGate() {
  const { profile, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const t = useT(strings);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!checked || !profile) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString(), terms_version: CURRENT_TERMS_VERSION })
        .eq('id', profile.id);
      if (updErr) throw updErr;
      await refreshProfile();
    } catch {
      setError(t('saveFailed'));
      setSaving(false);
    }
  }

  return (
    <div className="terms-gate">
      <div className="terms-gate-head">
        <div className="terms-gate-icon"><ShieldCheck size={20} strokeWidth={2} /></div>
        <div>
          <h1>{t('title')}</h1>
          <p>{t('intro')}</p>
        </div>
      </div>

      <div className="terms-gate-body">
        {lang !== 'es' && <p className="terms-gate-note">{NON_SPANISH_NOTE[lang]}</p>}
        <pre className="terms-gate-text">{POLICY_TEXT}</pre>
      </div>

      <div className="terms-gate-footer">
        <label className="terms-gate-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t('checkboxLabel')}</span>
        </label>
        {error && <p className="terms-gate-error">{error}</p>}
        <button type="button" className="terms-gate-continue" disabled={!checked || saving} onClick={handleAccept}>
          {saving ? t('saving') : t('continue')}
        </button>
      </div>

      <style>{`
        .terms-gate {
          position: fixed; inset: 0; z-index: 300;
          background: var(--bg);
          display: flex; flex-direction: column;
          animation: fadeIn 0.3s ease;
        }
        .terms-gate-head {
          display: flex; align-items: flex-start; gap: 12px;
          padding: max(20px, env(safe-area-inset-top)) 20px 12px;
        }
        .terms-gate-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          background: rgba(112,130,56,0.12); color: var(--primary);
          display: grid; place-items: center;
        }
        .terms-gate-head h1 { margin: 0 0 4px; font-size: 18px; color: var(--text); }
        .terms-gate-head p { margin: 0; font-size: 13px; color: var(--text-soft); }

        .terms-gate-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px; }
        .terms-gate-note {
          margin: 0 0 10px; padding: 8px 12px;
          background: rgba(196,154,90,0.1); color: var(--warn);
          border-radius: var(--radius-xs); font-size: 12.5px;
        }
        .terms-gate-text {
          margin: 0 0 20px; padding: 16px;
          background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius-sm);
          font-family: inherit; font-size: 13.5px; line-height: 1.7; color: var(--text);
          white-space: pre-wrap; word-wrap: break-word;
        }

        .terms-gate-footer {
          padding: 14px 20px max(14px, env(safe-area-inset-bottom));
          border-top: 1px solid var(--border-soft);
          display: flex; flex-direction: column; gap: 10px;
        }
        .terms-gate-checkbox {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: var(--text); cursor: pointer;
        }
        .terms-gate-checkbox input { margin-top: 2px; width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--primary); }
        .terms-gate-error { margin: 0; font-size: 12.5px; color: var(--danger); }
        .terms-gate-continue {
          padding: 13px; border: none; border-radius: 999px;
          background: var(--primary); color: #fff;
          font-size: 15px; font-weight: 700; cursor: pointer;
        }
        .terms-gate-continue:hover:not(:disabled) { background: var(--primary-600); }
        .terms-gate-continue:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
