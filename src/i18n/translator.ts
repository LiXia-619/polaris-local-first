import type { AppLanguage } from './appLanguage';
import { I18N_MESSAGES, type I18nKey } from './messages';

type I18nValues = Record<string, string | number>;

export type I18nTranslator = {
  language: AppLanguage;
  t: (key: I18nKey, values?: I18nValues) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

function interpolate(message: string, values: I18nValues | undefined) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(language: AppLanguage): I18nTranslator {
  const messages = I18N_MESSAGES[language];

  return {
    language,
    t: (key, values) => interpolate(messages[key], values),
    formatNumber: (value, options) => value.toLocaleString(language, options)
  };
}
