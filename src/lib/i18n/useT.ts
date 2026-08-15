import { useLanguage } from './context';
import type { LanguageCode } from './languages';

export type Strings = Record<LanguageCode, Record<string, string>>;

/**
 * Hook de traducción para un diccionario de strings co-ubicado con su componente.
 * Uso: const t = useT(strings); ... {t('title')} / {t('greeting', { name })}
 */
export function useT<S extends Strings>(strings: S) {
  const { lang } = useLanguage();
  const dict = strings[lang] ?? strings.es;

  return function t(key: keyof S['es'] & string, vars?: Record<string, string | number>): string {
    let value = dict[key] ?? strings.es[key] ?? key;
    if (vars) {
      for (const [varKey, varValue] of Object.entries(vars)) {
        value = value.split(`{{${varKey}}}`).join(String(varValue));
      }
    }
    return value;
  };
}
