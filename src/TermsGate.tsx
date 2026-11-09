import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import { useLanguage, useT } from './lib/i18n';
import strings, { NON_SPANISH_NOTE } from './TermsGate.i18n';

// Sube este valor si el texto legal cambia de forma material — todo perfil
// con terms_version distinto (o null) vuelve a ver esta pantalla.
export const CURRENT_TERMS_VERSION = 'v2';

const POLICY_TEXT = `POLÍTICA DE PRIVACIDAD Y TÉRMINOS DE USO – CALIVIA
Última actualización: 8 de noviembre de 2026

1. Quiénes somos
Calivia es una aplicación de acompañamiento emocional operada por Rubén Salguero, en Chile. Contacto: consultoresgaman@gmail.com.

2. Qué es y qué no es Calivia
Calivia es una herramienta digital de acompañamiento, reflexión y desarrollo personal con inteligencia artificial. No es psicoterapia, psiquiatría ni un servicio de urgencias, y no reemplaza el diagnóstico, tratamiento o seguimiento de un profesional de la salud. Consulta siempre a un profesional para recibir consejo médico o psicológico. Si tu vida corre peligro, contacta de inmediato a los servicios de emergencia de tu país.

3. Edad mínima
Calivia es solo para personas de 18 años o más.

4. Datos que recogemos
- Cuenta: nombre, contraseña (guardada como hash, nunca en texto legible), país, y de forma opcional foto, nombre preferido, ocupación y correo de recuperación. Si eres especialista: teléfono, matrícula, biografía y, si activas tu tarjeta en "Agendar", título, enlace de agenda y valor de la sesión. Esa tarjeta (foto, nombre, título, biografía, país y valor; nunca el número de registro) la ven todos los pacientes de Calivia; puedes desactivarla cuando quieras.
- Salud y bienestar: registros de ánimo, mensajes del chat, entradas del diario, tareas y tus respuestas a ellas, y alertas de posible riesgo.
- Contactos de confianza: nombre y teléfono de las personas que tú agregues. Agrégalas solo si cuentas con su permiso.
- Voz: si usas el chat por voz, el servicio de reconocimiento de voz de tu dispositivo convierte el audio en texto. Calivia recibe el texto, no el audio.
- Datos técnicos: identificador del dispositivo para notificaciones y datos de sesión.

Parte de esta información también se guarda en tu dispositivo, como tu sesión, tu perfil, tus contactos de crisis y el borrador de tu diario, para que la ayuda funcione sin conexión. Se borra al cerrar sesión o desinstalar la app.

5. Para qué usamos tus datos
Para darte el servicio: responder en el chat, recordar el contexto de tus conversaciones, guardar tu diario y, si lo pides, generar reflexiones sobre lo que escribiste, enviar recordatorios y notificaciones, y activar el protocolo de crisis. No vendemos tus datos ni los usamos para publicidad.

6. Con quién se comparten
Usamos estos proveedores para operar Calivia:
- Supabase: alojamiento de la base de datos y los archivos.
- OpenAI: procesa tus mensajes del chat y tus registros para generar respuestas y resúmenes. Las entradas del diario solo se envían a OpenAI si pides una reflexión sobre ellas.
- Google Firebase: entrega notificaciones. Los avisos no incluyen tu nombre ni tu contenido.
- Resend: envío de correos de recuperación y avisos.
- Vercel: alojamiento de la versión web.
- Google Fonts: tipografías de la app.
- Calendly y Google Meet: si agendas una sesión o te unes a una videollamada, se aplican las condiciones de esos servicios. La llamada ocurre fuera de Calivia.

Estos proveedores pueden tratar los datos fuera de tu país.

7. Si te vinculas con un profesional
El vínculo es voluntario: lo aceptas con un código y puedes retirarlo cuando quieras desde tu perfil. Mientras exista, tu profesional puede ver:
- Tus datos de perfil: nombre, nombre preferido, foto, país y ocupación.
- Tus registros de ánimo.
- Las fechas en que usaste el chat.
- Resúmenes generados por IA a partir de tus registros y conversaciones.
- Tus respuestas a las tareas que te asignó.
- Las alertas de posible riesgo.

Si detectamos una posible señal de riesgo en el chat, el diario o una respuesta a una tarea, tu profesional recibe una alerta en su panel con un fragmento de hasta 200 caracteres de lo que escribiste, junto con una sugerencia generada por IA. También recibe un aviso por notificación y correo, sin tu nombre ni tu mensaje. Tu profesional no puede leer tus conversaciones completas ni tu diario.

La detección de riesgo es automática, puede fallar y no reemplaza una evaluación profesional.

8. Quién más puede acceder
Tus datos se protegen con control de acceso y cifrado en tránsito. No usamos cifrado de extremo a extremo: las personas que administran el sistema tienen acceso técnico y solo lo usan cuando es necesario para operar, dar soporte o cumplir la ley. Si reportas una respuesta de la IA, guardamos su texto para revisarlo.

9. Cuánto tiempo guardamos tus datos
Mientras tu cuenta exista. Si la eliminas, borramos tu perfil y tus datos asociados de forma definitiva, incluidas las notas que un profesional haya escrito sobre ti en Calivia.

10. Tus derechos y eliminación de cuenta
Puedes acceder a tus datos, corregirlos y pedir su eliminación. Para eliminar tu cuenta, entra en Editar perfil y elige Eliminar mi cuenta, o escribe a consultoresgaman@gmail.com. Más información: https://calivia.vercel.app/eliminar-cuenta.html

11. Uso aceptable
Puedes reportar dentro de la app cualquier respuesta de la IA que te parezca ofensiva, dañina o incorrecta. Las respuestas de la IA pueden contener errores.

12. Cambios
Si esta política cambia de forma importante, te pediremos aceptarla de nuevo en la app.`;

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
