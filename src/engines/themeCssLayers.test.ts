import { describe, expect, it } from 'vitest';
import {
  resolveCreativeCssPatch,
  formatThemeGeneratedLayerLabel,
  mergeThemeCssLayers,
  readThemeGeneratedSurfaceLayers,
  summarizeThemeGeneratedLayers,
  wrapThemeCssLayer
} from './themeCssLayers';

describe('themeCssLayers', () => {
  it('reads selector-based layer labels back from generated css', () => {
    const generatedCss = wrapThemeCssLayer(
      'chat-bubble-assistant',
      '.app-shell.chat .bubble.assistant { background: pink; }'
    );

    expect(readThemeGeneratedSurfaceLayers(generatedCss)).toMatchObject([{
      label: '助手正文',
      scope: 'chat',
      operations: ['replace']
    }]);
  });

  it('keeps raw css overlays readable in exported layer summaries', () => {
    const generatedCss = wrapThemeCssLayer(
      'creative-raw-css',
      '.app-shell { background: black; }'
    );

    expect(readThemeGeneratedSurfaceLayers(generatedCss)).toMatchObject([{
      label: '整页 CSS',
      scope: 'app',
      operations: ['merge']
    }]);
  });

  it('formats current layer labels directly', () => {
    const generatedCss = wrapThemeCssLayer(
      'chat-bubble-assistant',
      '.app-shell.chat .bubble.assistant { background: pink; }'
    );

    const [layer] = readThemeGeneratedSurfaceLayers(generatedCss);
    expect(formatThemeGeneratedLayerLabel(layer)).toBe('助手正文');
  });

  it('summarizes selector and raw overlays without creative mount metadata', () => {
    const generatedCss = [
      wrapThemeCssLayer(
        'chat-bubble-assistant',
        '.app-shell.chat .bubble.assistant { background: pink; }'
      ),
      wrapThemeCssLayer(
        'creative-raw-css',
        '.app-shell { background: white; }'
      )
    ].join('\n\n');

    expect(summarizeThemeGeneratedLayers(generatedCss)).toMatchObject({
      overlayLabels: ['助手正文', '整页 CSS'],
      replaceLabels: ['助手正文'],
      mergeLabels: ['整页 CSS']
    });
  });

  it('keeps previous unclassified raw css overlays when a new unclassified raw patch arrives', () => {
    const baseCss = wrapThemeCssLayer(
      'creative-raw-css',
      '.floating-custom-shell { background: black; color: white; }'
    );
    const nextCss = wrapThemeCssLayer(
      'creative-raw-css',
      '.floating-custom-shell { background: pink; }'
    );

    const merged = mergeThemeCssLayers(baseCss, nextCss);
    expect(merged).toContain('background: pink;');
    expect(merged).toContain('color: white;');
    expect(readThemeGeneratedSurfaceLayers(merged)).toMatchObject([{
      operations: ['merge']
    }]);
  });

  it('replaces the previous patch for the same catalog area', () => {
    const firstResult = resolveCreativeCssPatch({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.assistant .message-rich-text { color: #a8d8a8; }'
    });
    const nextResult = resolveCreativeCssPatch({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.assistant { color: #111111; }'
    });

    expect(firstResult.ok).toBe(true);
    expect(nextResult.ok).toBe(true);
    if (!firstResult.ok || !nextResult.ok) return;

    const merged = mergeThemeCssLayers(firstResult.generatedCssPatch, nextResult.generatedCssPatch);
    expect(merged).toContain('polaris-layer:start chat-bubble-assistant');
    expect(merged).toContain('color: #111111;');
    expect(merged).not.toContain('#a8d8a8');
    expect(merged).not.toContain('.message-rich-text');
    expect(readThemeGeneratedSurfaceLayers(merged)).toMatchObject([{
      label: '助手正文',
      operations: ['replace']
    }]);
  });

  it('keeps different catalog areas independent when raw patches target separate regions', () => {
    const assistantResult = resolveCreativeCssPatch({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.assistant { color: #a8d8a8; }'
    });
    const userResult = resolveCreativeCssPatch({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.user { color: #111111; }'
    });

    expect(assistantResult.ok).toBe(true);
    expect(userResult.ok).toBe(true);
    if (!assistantResult.ok || !userResult.ok) return;

    const merged = mergeThemeCssLayers(assistantResult.generatedCssPatch, userResult.generatedCssPatch);
    expect(merged).toContain('polaris-layer:start chat-bubble-assistant');
    expect(merged).toContain('polaris-layer:start chat-bubble-user');
    expect(merged).toContain('#a8d8a8');
    expect(merged).toContain('#111111');
  });

  it('appends non-mergeable raw css blocks instead of dropping the earlier one', () => {
    const baseCss = wrapThemeCssLayer(
      'creative-raw-css',
      '@keyframes glow { from { opacity: 0.1; } to { opacity: 0.3; } }'
    );
    const nextCss = wrapThemeCssLayer(
      'creative-raw-css',
      '.app-shell.chat { background: radial-gradient(circle at top, pink, white); }'
    );

    const merged = mergeThemeCssLayers(baseCss, nextCss);
    expect(merged).toContain('@keyframes glow');
    expect(merged).toContain('.app-shell.chat {');
  });

  it('stores direct creative css in the matching catalog area layer', () => {
    const result = resolveCreativeCssPatch({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.assistant { background: pink; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generatedCssPatch).toContain('chat-bubble-assistant');
    expect(result.generatedCssPatch).toContain('.app-shell.chat .bubble.assistant');
  });

  it('compiles unclassified patchRawCss into the shared raw css layer', () => {
    const result = resolveCreativeCssPatch({
      kind: 'patchRawCss',
      css: '.floating-custom-shell { background: pink; }'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generatedCssPatch).toContain('creative-raw-css');
    expect(result.generatedCssPatch).toContain('.floating-custom-shell');
    expect(result.generatedCssPatch).toContain('background: pink;');
  });
});
