/**
 * Localization Context
 * Provides i18n support for the app
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { englocale, ruslocale, Locale } from './translations';

type Language = 'eng' | 'rus';

interface LocaleContextValue {
  locale: Locale;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Locale) => string;
}

const locales: Record<Language, Locale> = {
  eng: englocale,
  rus: ruslocale,
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

export function LocaleProvider({ children, defaultLanguage = 'eng' }: LocaleProviderProps) {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const locale = locales[language];

  const t = (key: keyof Locale): string => {
    return locale[key] || key;
  };

  const value: LocaleContextValue = {
    locale,
    language,
    setLanguage,
    t,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

export { englocale, ruslocale };
export type { Locale, Language };
