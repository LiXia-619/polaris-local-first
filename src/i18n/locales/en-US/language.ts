import type { language as zhLanguage } from '../zh-CN/language';

export const language = {
  'language.zhCN': '简体中文',
  'language.enUS': 'English',
  'language.current': 'Current language',
} satisfies Record<keyof typeof zhLanguage, string>;
