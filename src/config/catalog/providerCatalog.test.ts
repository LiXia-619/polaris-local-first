import { describe, expect, it } from 'vitest';
import { findProviderPreset } from './providerCatalog';

describe('provider catalog', () => {
  it('lists current DeepSeek V4 models on the DeepSeek preset', () => {
    const preset = findProviderPreset('https://api.deepseek.com/v1');

    expect(preset?.models).toEqual(expect.arrayContaining([
      'deepseek-v4-flash',
      'deepseek-v4-pro'
    ]));
  });

  it('keeps Moonshot Kimi K2.6 selectable as a thinking model', () => {
    const preset = findProviderPreset('https://api.moonshot.cn/v1');

    expect(preset?.models).toContain('kimi-k2.6');
    expect(preset?.capabilities.thinking).toBe(true);
  });
});
