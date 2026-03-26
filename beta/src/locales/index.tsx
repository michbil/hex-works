/**
 * i18next configuration
 * Provides i18n support for the app via i18next + react-i18next
 */

import i18n from 'i18next';
import { initReactI18next, useTranslation, I18nextProvider } from 'react-i18next';
import en from './en';

const resources = {
  en: { translation: en },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export { i18n, useTranslation, I18nextProvider };
export default i18n;
