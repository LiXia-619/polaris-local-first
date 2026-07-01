import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_PRESET_ID, listStudioThemePresets } from './themePresets';

describe('themePresets', () => {
  it('keeps theme studio limited to the single default preset', () => {
    const presets = listStudioThemePresets();
    expect(presets).toHaveLength(1);
    expect(presets[0]?.id).toBe(DEFAULT_THEME_PRESET_ID);
  });
});
