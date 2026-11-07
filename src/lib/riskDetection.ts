import { RISK_KEYWORDS } from '../AiChat.i18n';

// Mismo lexicón de riesgo del backend (supabase/functions/_shared/crisis.ts), para
// que el protocolo de crisis responda aunque no haya conexión. Se revisan los tres
// idiomas a la vez, sin importar el idioma de la interfaz.
const ALL_RISK_KEYWORDS = [...RISK_KEYWORDS.es, ...RISK_KEYWORDS.en, ...RISK_KEYWORDS.pt];

export function detectRiskKeyword(text: string): boolean {
  const normalized = text.toLowerCase();
  return ALL_RISK_KEYWORDS.some((kw) => normalized.includes(kw));
}
