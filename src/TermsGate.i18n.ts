import type { Strings } from './lib/i18n';

const strings: Strings = {
  es: {
    title: 'Términos y Privacidad',
    intro: 'Antes de continuar, por favor lee y acepta lo siguiente.',
    checkboxLabel: 'He leído y acepto los Términos de Uso y la Política de Privacidad de Calivia.',
    continue: 'Aceptar y continuar',
    saving: 'Guardando…',
    saveFailed: 'No se pudo guardar tu aceptación. Intenta de nuevo.',
  },
  en: {
    title: 'Terms and Privacy',
    intro: 'Before continuing, please read and accept the following.',
    checkboxLabel: "I have read and accept Calivia's Terms of Use and Privacy Policy.",
    continue: 'Accept and continue',
    saving: 'Saving…',
    saveFailed: "Couldn't save your acceptance. Please try again.",
  },
  pt: {
    title: 'Termos e Privacidade',
    intro: 'Antes de continuar, por favor leia e aceite o seguinte.',
    checkboxLabel: 'Li e aceito os Termos de Uso e a Política de Privacidade da Calivia.',
    continue: 'Aceitar e continuar',
    saving: 'Salvando…',
    saveFailed: 'Não foi possível salvar sua aceitação. Tente novamente.',
  },
};

export default strings;

// El texto legal en sí se mantiene únicamente en español (tal como fue
// redactado y aprobado), independientemente del idioma elegido en la app —
// no se traduce automáticamente un documento legal sin revisión.
export const NON_SPANISH_NOTE: Record<'en' | 'pt', string> = {
  en: 'This policy is currently only available in Spanish.',
  pt: 'Esta política está disponível atualmente apenas em espanhol.',
};
