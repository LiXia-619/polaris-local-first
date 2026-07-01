import { describe, expect, it, vi } from 'vitest';
import { themeToolExecutorPlugin } from './toolExecutorThemePlugin';
import type { ToolContext } from './toolExecutorTypes';

function createContext(overrides: Partial<ToolContext> = {}) {
  return {
    applyThemePatch: vi.fn(),
    applyThemePreset: vi.fn(),
    ...overrides
  } as ToolContext;
}

describe('themeToolExecutorPlugin', () => {
  it('applies creative raw css through the generated theme layer', async () => {
    const ctx = createContext();

    const result = await themeToolExecutorPlugin.execute({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.user { color: #fff; }'
    }, ctx);

    expect(result).toEqual({
      ok: true,
      detailText: '.app-shell.chat .bubble.user { color: #fff; }'
    });
    expect(ctx.applyThemePatch).toHaveBeenCalledWith(expect.stringContaining('.app-shell.chat .bubble.user'));
  });

  it('keeps stable coordinate actions on the preview path', async () => {
    const ctx = createContext();

    const result = await themeToolExecutorPlugin.execute({
      kind: 'applyThemeCoordinates',
      targets: 'all',
      hue: 28,
      hueCount: 2,
      emotion: 3,
      meaning: 6
    }, ctx);

    expect(result).toEqual({
      ok: false,
      error: '稳定整体换肤需要走试穿链，不能直接执行。'
    });
    expect(ctx.applyThemePatch).not.toHaveBeenCalled();
  });

  it('reads the current virtual theme css from runtime context', async () => {
    const ctx = createContext({
      readCurrentThemeFrame: () => ({
        activePresetId: 'polaris-default',
        activeSavedSkinId: null,
        cssVariables: {},
        presetCSS: '.preset { color: red; }',
        customCSS: '.custom { color: blue; }',
        generatedCSS: '.generated { color: green; }'
      })
    });

    const result = await themeToolExecutorPlugin.execute({ kind: 'readThemeCss' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toBe('已读取当前 theme.css');
    expect(result.detailText).toContain('Polaris virtual theme.css');
    expect(result.detailText).toContain('/* @polaris-layer custom writable */');
    expect(result.detailText).toContain('.generated { color: green; }');
  });

  it('routes render inspection to the runtime inspector', async () => {
    const ctx = createContext({
      inspectThemeRender: vi.fn(() => ({
        ok: true as const,
        summary: '已检查主题渲染',
        detailText: 'chat bubble contrast 8.2:1'
      }))
    });

    const result = await themeToolExecutorPlugin.execute({ kind: 'inspectThemeRender' }, ctx);

    expect(result).toEqual({
      ok: true,
      summary: '已检查主题渲染',
      detailText: 'chat bubble contrast 8.2:1'
    });
    expect(ctx.inspectThemeRender).toHaveBeenCalledOnce();
  });
});
