export const APP_LANGUAGES = ['zh-CN', 'en-US'] as const;

export type AppLanguage = typeof APP_LANGUAGES[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'zh-CN';

export const APP_LANGUAGE_LABELS: Record<AppLanguage, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English'
};

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return value === 'en-US' ? 'en-US' : DEFAULT_APP_LANGUAGE;
}
