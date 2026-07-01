import { describe, expect, it } from 'vitest';

import { I18N_MESSAGES } from './messages';

describe('I18N_MESSAGES', () => {
  it('keeps every non-source locale aligned with zh-CN keys', () => {
    const sourceKeys = Object.keys(I18N_MESSAGES['zh-CN']).sort();

    for (const [language, messages] of Object.entries(I18N_MESSAGES)) {
      if (language === 'zh-CN') continue;
      expect(Object.keys(messages).sort()).toEqual(sourceKeys);
    }
  });
});
