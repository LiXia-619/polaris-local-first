import type { AppLanguage } from './appLanguage';
import { enUSMessages } from './locales/en-US';
import { zhCNMessages } from './locales/zh-CN';

export type I18nKey = keyof typeof zhCNMessages;

export const I18N_MESSAGES: Record<AppLanguage, Record<I18nKey, string>> = {
  'zh-CN': zhCNMessages,
  'en-US': enUSMessages
};
