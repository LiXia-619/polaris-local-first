import { describe, expect, it } from 'vitest';
import type { ThemeFrame } from '../types/domain';
import {
  appendThemeCssFile,
  deleteThemeCssFile,
  editThemeCssFile,
  insertThemeCssFile,
  replaceThemeCssFile,
  serializeThemeCssFile
} from './themeCssFile';

function createThemeFrame(overrides: Partial<ThemeFrame> = {}): ThemeFrame {
  return {
    activePresetId: 'polaris-default',
    activeSavedSkinId: null,
    cssVariables: {},
    presetCSS: '.readonly-bubble { color: red; }',
    customCSS: '.bubble.user { color: blue; }',
    generatedCSS: '.bubble.assistant { color: green; }',
    ...overrides
  };
}

describe('serializeThemeCssFile', () => {
  it('exposes the real cascade as readable and writable layers', () => {
    const cssFile = serializeThemeCssFile(createThemeFrame());

    expect(cssFile).toContain('Cascade order: blank-base -> preset -> custom -> generated.');
    expect(cssFile).toContain('/* @polaris-layer blank-base readonly */');
    expect(cssFile).toContain('/* @polaris-layer preset id=polaris-default readonly */');
    expect(cssFile).toContain('/* @polaris-layer custom writable */');
    expect(cssFile).toContain('/* @polaris-layer generated writable */');
    expect(cssFile).toContain('editThemeCss / appendThemeCss / insertThemeCss / deleteThemeCss');
    expect(cssFile.indexOf('blank-base readonly')).toBeLessThan(cssFile.indexOf('preset id=polaris-default readonly'));
    expect(cssFile.indexOf('preset id=polaris-default readonly')).toBeLessThan(cssFile.indexOf('custom writable'));
    expect(cssFile.indexOf('custom writable')).toBeLessThan(cssFile.indexOf('generated writable'));
  });
});

describe('editThemeCssFile', () => {
  it('edits the unique writable layer match with oldString/newString precision', () => {
    const result = editThemeCssFile({
      theme: createThemeFrame(),
      oldString: 'color: blue;',
      newString: 'color: white;'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer).toBe('custom');
    expect(result.nextTheme.customCSS).toContain('color: white;');
    expect(result.nextTheme.generatedCSS).toContain('color: green;');
  });

  it('rejects direct edits to the read-only preset layer', () => {
    const result = editThemeCssFile({
      theme: createThemeFrame(),
      oldString: 'color: red;',
      newString: 'color: white;'
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('只读底座');
  });
});

describe('appendThemeCssFile', () => {
  it('appends new css to the generated layer by default', () => {
    const result = appendThemeCssFile({
      theme: createThemeFrame(),
      css: '.new-rule { color: white; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer).toBe('generated');
    expect(result.nextTheme.generatedCSS).toContain('.bubble.assistant { color: green; }');
    expect(result.nextTheme.generatedCSS).toContain('.new-rule { color: white; }');
  });

  it('wraps top-level variable declarations into an app-shell rule before writing', () => {
    const result = appendThemeCssFile({
      theme: createThemeFrame({ generatedCSS: '' }),
      css: '--bubble-user-bg: #ffe8f3;\n--bubble-user-text: #211820'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.generatedCSS).toBe([
      '.app-shell {',
      '  --bubble-user-bg: #ffe8f3;',
      '  --bubble-user-text: #211820;',
      '}'
    ].join('\n'));
    expect(result.writtenCss).toBe(result.nextTheme.generatedCSS);
  });

  it('rejects selector lists that are not complete css rules', () => {
    const result = appendThemeCssFile({
      theme: createThemeFrame(),
      css: [
        '.app-shell.chat',
        '.app-shell.chat .bubble.user',
        '.app-shell.chat .bubble.assistant'
      ].join('\n')
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('浏览器能直接应用');
  });
});

describe('insertThemeCssFile', () => {
  it('inserts css before a unique writable anchor', () => {
    const result = insertThemeCssFile({
      theme: createThemeFrame(),
      anchorString: '.bubble.assistant { color: green; }',
      css: '.inserted { color: white; }',
      position: 'before'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer).toBe('generated');
    expect(result.nextTheme.generatedCSS.indexOf('.inserted')).toBeLessThan(result.nextTheme.generatedCSS.indexOf('.bubble.assistant'));
  });

  it('writes the normalized css when inserting variable declarations', () => {
    const result = insertThemeCssFile({
      theme: createThemeFrame(),
      anchorString: '.bubble.assistant { color: green; }',
      css: '--accent: #f5a6c8;',
      position: 'after'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.generatedCSS).toContain('.app-shell {\n  --accent: #f5a6c8;\n}');
    expect(result.writtenCss).toBe('.app-shell {\n  --accent: #f5a6c8;\n}');
  });
});

describe('deleteThemeCssFile', () => {
  it('deletes a unique writable css fragment', () => {
    const result = deleteThemeCssFile({
      theme: createThemeFrame(),
      oldString: '.bubble.user { color: blue; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.layer).toBe('custom');
    expect(result.nextTheme.customCSS).not.toContain('.bubble.user');
  });
});

describe('replaceThemeCssFile', () => {
  it('clears preset identity and writes a complete custom theme css file', () => {
    const result = replaceThemeCssFile('.app-shell { color: #f8fafc; }');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextTheme.activePresetId).toBeNull();
    expect(result.nextTheme.presetCSS).toBe('');
    expect(result.nextTheme.generatedCSS).toBe('');
    expect(result.nextTheme.customCSS).toBe('.app-shell { color: #f8fafc; }');
  });

  it('rejects incomplete css instead of reporting a successful skin change', () => {
    const result = replaceThemeCssFile('.app-shell.chat\n.app-shell.chat .bubble.user');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('selector 列表');
  });
});
