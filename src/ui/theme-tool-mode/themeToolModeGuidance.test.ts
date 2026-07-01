import { describe, expect, it } from 'vitest';
import { resolveEffectiveThemeToolMode } from './themeToolModeGuidance';

describe('resolveEffectiveThemeToolMode', () => {
  it('keeps the visible theme mode closed when theme tools are disabled', () => {
    expect(resolveEffectiveThemeToolMode('creative', false)).toBe('off');
    expect(resolveEffectiveThemeToolMode('stable', false)).toBe('off');
  });

  it('keeps the selected mode when theme tools are enabled', () => {
    expect(resolveEffectiveThemeToolMode('creative', true)).toBe('creative');
    expect(resolveEffectiveThemeToolMode('stable', true)).toBe('stable');
  });
});
