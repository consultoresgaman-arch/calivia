import type { LanguageCode, Strings } from './lib/i18n';

// NUDGE_MESSAGES es contenido indexado por turno (no texto de interfaz),
// igual que en DailySpark.i18n.ts.
export const NUDGE_MESSAGES: Record<LanguageCode, string[]> = {
  es: [
    '¿Te tomas 10 segundos para respirar conmigo?',
    'Llevas un rato por aquí. Una pausa corta no está de más.',
    'Si quieres, hacemos una pequeña pausa de consciencia.',
  ],
  en: [
    'Want to take 10 seconds to breathe with me?',
    "You've been here a while. A short pause wouldn't hurt.",
    "If you'd like, let's take a small mindful pause.",
  ],
  pt: [
    'Quer parar por 10 segundos para respirar comigo?',
    'Você já está aqui há um tempo. Uma pausa curta não faz mal.',
    'Se quiser, fazemos uma pequena pausa de consciência.',
  ],
};

const strings: Strings = {
  es: {
    yes: 'Sí, un momento',
    skip: 'Ahora no',
    breathe: 'Inhala… exhala…',
    close: 'Cerrar',
  },
  en: {
    yes: 'Yes, a moment',
    skip: 'Not now',
    breathe: 'Inhale… exhale…',
    close: 'Close',
  },
  pt: {
    yes: 'Sim, um momento',
    skip: 'Agora não',
    breathe: 'Inspire… expire…',
    close: 'Fechar',
  },
};

export default strings;
