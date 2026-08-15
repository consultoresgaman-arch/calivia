import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type LanguageCode, getStoredLanguage, persistLanguage } from './languages';

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(() => getStoredLanguage());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next: LanguageCode) {
    setLangState(next);
    persistLanguage(next);
  }

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  return ctx;
}
