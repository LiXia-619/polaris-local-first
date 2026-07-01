import { describe, expect, it } from 'vitest';
import type { SavedSkin } from '../../types/domain';
import {
  buildSavedSkinEditableCss,
  serializeSavedSkinCssFile
} from './themeStudioSupport';

function skin(overrides: Partial<SavedSkin> = {}): SavedSkin {
  return {
    id: 'saved-skin-test',
    name: 'Pumpkin',
    sourcePresetId: 'polaris-default',
    cssVariables: {
      '--bg': '#ffcf8a',
      '--text': '#3c2411'
    },
    presetCSS: '.app-shell.chat { background: var(--bg); }',
    customCSS: '.bubble.user { color: var(--text); }',
    generatedCSS: '.send-btn { background: #f07a22; }',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

describe('themeStudioSupport', () => {
  it('keeps the editable CSS limited to hand-editable layers', () => {
    expect(buildSavedSkinEditableCss(skin())).toBe([
      '.bubble.user { color: var(--text); }',
      '.send-btn { background: #f07a22; }'
    ].join('\n\n'));
  });

  it('serializes copy/export content as scoped editable CSS, not the whole theme base', () => {
    const file = serializeSavedSkinCssFile(skin());

    expect(file).toContain('Polaris theme: Pumpkin');
    expect(file).not.toContain('--text: #3c2411');
    expect(file).not.toContain('.app-shell.chat { background: var(--bg); }');
    expect(file).toContain('.bubble.user { color: var(--text); }');
    expect(file).toContain('.send-btn { background: #f07a22; }');
  });
});
