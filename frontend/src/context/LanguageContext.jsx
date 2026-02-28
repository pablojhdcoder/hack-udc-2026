import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSystemLocale, normalizeLocale, t as translate } from "../i18n/translations";
import { getStoredLanguage, setStoredLanguage } from "../lib/languageStorage";

const SUPPORTED = ["es", "en", "fr", "pt", "it", "de"];
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const stored = getStoredLanguage();
    if (stored && SUPPORTED.includes(stored)) return stored;
    return getSystemLocale();
  });

  useEffect(() => {
    setStoredLanguage(locale);
  }, [locale]);

  const setLocale = useCallback((newLocale) => {
    const next = normalizeLocale(newLocale);
    if (SUPPORTED.includes(next)) setLocaleState(next);
  }, []);

  const t = useCallback(
    (key) => translate(locale, key),
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useAppLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useAppLanguage must be used within LanguageProvider");
  }
  return ctx;
}
