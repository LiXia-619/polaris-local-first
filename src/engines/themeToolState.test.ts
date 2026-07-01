import { describe, expect, it } from 'vitest';
import { buildThemeFrameFromPresetId } from '../config/theme/themePresets';
import { resolveThemeActionFrameChange } from './themeToolState';

describe('resolveThemeActionFrameChange', () => {
  it('applies paper preset as its real preset frame instead of falling back to custom base', () => {
    const beforeTheme = buildThemeFrameFromPresetId('polaris-night');
    const expectedPaperFrame = buildThemeFrameFromPresetId('paper-butter');

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'applyPreset',
      presetId: 'paper-butter'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.nextTheme.activePresetId).toBe('paper-butter');
    expect(result.nextTheme.presetCSS).toBe(expectedPaperFrame.presetCSS);
    expect(result.nextTheme.cssVariables).toEqual(expectedPaperFrame.cssVariables);
    expect(result.nextTheme.customCSS).toBe('');
    expect(result.nextTheme.generatedCSS).toBe('');
  });

  it('edits current theme css through the preview frame path', () => {
    const beforeTheme = {
      ...buildThemeFrameFromPresetId('polaris-default'),
      customCSS: '.bubble.user { color: blue; }',
      generatedCSS: '.bubble.assistant { color: green; }'
    };

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'editThemeCss',
      oldString: 'color: blue;',
      newString: 'color: white;'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.activeSavedSkinId).toBeNull();
    expect(result.nextTheme.activePresetId).toBe('polaris-default');
    expect(result.nextTheme.customCSS).toContain('color: white;');
    expect(result.nextTheme.generatedCSS).toContain('color: green;');
    expect(result.generatedCssPatch).toBe('color: white;');
  });

  it('appends current theme css through the preview frame path', () => {
    const beforeTheme = {
      ...buildThemeFrameFromPresetId('polaris-default'),
      generatedCSS: '.bubble.assistant { color: green; }'
    };

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'appendThemeCss',
      css: '.bubble.user { color: white; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.activeSavedSkinId).toBeNull();
    expect(result.nextTheme.generatedCSS).toContain('.bubble.assistant { color: green; }');
    expect(result.nextTheme.generatedCSS).toContain('.bubble.user { color: white; }');
    expect(result.generatedCssPatch).toBe('.bubble.user { color: white; }');
  });

  it('reports normalized css as the generated preview patch', () => {
    const beforeTheme = {
      ...buildThemeFrameFromPresetId('polaris-default'),
      generatedCSS: ''
    };

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'appendThemeCss',
      css: '--bubble-user-text: #211820;'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.generatedCSS).toBe('.app-shell {\n  --bubble-user-text: #211820;\n}');
    expect(result.generatedCssPatch).toBe(result.nextTheme.generatedCSS);
  });

  it('rejects incomplete theme css before previewing it as success', () => {
    const beforeTheme = {
      ...buildThemeFrameFromPresetId('polaris-default'),
      generatedCSS: ''
    };

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'appendThemeCss',
      css: '.app-shell.chat\n.app-shell.chat .bubble.user'
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('浏览器能直接应用');
    expect(result.unsupported).toBe(false);
  });

  it('inserts current theme css through the preview frame path', () => {
    const beforeTheme = {
      ...buildThemeFrameFromPresetId('polaris-default'),
      generatedCSS: '.bubble.assistant { color: green; }'
    };

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'insertThemeCss',
      anchorString: '.bubble.assistant { color: green; }',
      css: '.bubble.user { color: white; }',
      position: 'before'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.generatedCSS.indexOf('.bubble.user')).toBeLessThan(result.nextTheme.generatedCSS.indexOf('.bubble.assistant'));
    expect(result.generatedCssPatch).toBe('.bubble.user { color: white; }');
  });

  it('deletes current theme css through the preview frame path', () => {
    const beforeTheme = {
      ...buildThemeFrameFromPresetId('polaris-default'),
      generatedCSS: '.bubble.assistant { color: green; }'
    };

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'deleteThemeCss',
      oldString: '.bubble.assistant { color: green; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.generatedCSS).not.toContain('.bubble.assistant');
    expect(result.generatedCssPatch).toBe('');
  });

  it('replaces the whole virtual theme css as an independent custom skin', () => {
    const beforeTheme = buildThemeFrameFromPresetId('polaris-night');

    const result = resolveThemeActionFrameChange(beforeTheme, {
      kind: 'replaceThemeCss',
      css: '.app-shell { color: #f8fafc; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.activePresetId).toBeNull();
    expect(result.nextTheme.presetCSS).toBe('');
    expect(result.nextTheme.customCSS).toBe('.app-shell { color: #f8fafc; }');
    expect(result.generatedCssPatch).toBe('.app-shell { color: #f8fafc; }');
  });
});
