export type LanguageCode = 'es' | 'en' | 'pt';

export interface LanguageInfo {
  code: LanguageCode;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'es';
const STORAGE_KEY = 'calivia-language';

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === 'es' || value === 'en' || value === 'pt';
}

export function detectLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const raw of candidates) {
    const code = raw?.toLowerCase().slice(0, 2);
    if (code === 'pt' || code === 'en' || code === 'es') return code;
  }
  return DEFAULT_LANGUAGE;
}

export function getStoredLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(stored)) return stored;
  } catch {
    // localStorage no disponible (modo privado, SSR, etc.)
  }
  return detectLanguage();
}

export function persistLanguage(lang: LanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignorar si localStorage no está disponible
  }
}
