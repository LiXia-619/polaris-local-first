import { describe, expect, it } from 'vitest';
import { displayTitleClassName, displayTitleUsesSystemFont } from './titleTypography';

describe('displayTitleUsesSystemFont', () => {
  it('uses the system font for CJK titles', () => {
    expect(displayTitleUsesSystemFont('主语')).toBe(true);
    expect(displayTitleUsesSystemFont('猫♡')).toBe(true);
  });

  it('keeps ornamental display font for latin names and symbols', () => {
    expect(displayTitleUsesSystemFont('Pharos')).toBe(false);
    expect(displayTitleUsesSystemFont('✦')).toBe(false);
  });

  it('can treat empty editable names as system-font placeholders', () => {
    expect(displayTitleUsesSystemFont('', { systemWhenEmpty: true })).toBe(true);
    expect(displayTitleClassName('', 'name-input', { systemWhenEmpty: true })).toBe(
      'name-input display-title display-title--system'
    );
  });
});
