import { describe, expect, it } from 'vitest';
import {
  resolveThemeToolModeForToolboxToggle,
  shouldRefreshMenuPersonalDataStatus
} from './useMenuToolboxController';

describe('menu toolbox controller model', () => {
  it('refreshes personal data status only while the toolbox page is open', () => {
    expect(shouldRefreshMenuPersonalDataStatus(true, 'toolbox')).toBe(true);
    expect(shouldRefreshMenuPersonalDataStatus(false, 'toolbox')).toBe(false);
    expect(shouldRefreshMenuPersonalDataStatus(true, 'root')).toBe(false);
  });

  it('turns the theme tool off when its toolbox group is disabled', () => {
    expect(resolveThemeToolModeForToolboxToggle('theme', false, 'creative')).toBe('off');
  });

  it('restores stable theme tool mode only when enabling from off', () => {
    expect(resolveThemeToolModeForToolboxToggle('theme', true, 'off')).toBe('stable');
    expect(resolveThemeToolModeForToolboxToggle('theme', true, 'creative')).toBeNull();
  });

  it('leaves non-theme toolbox groups out of theme mode ownership', () => {
    expect(resolveThemeToolModeForToolboxToggle('personalData', true, 'off')).toBeNull();
  });
});
