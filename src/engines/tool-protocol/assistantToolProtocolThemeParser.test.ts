import { describe, expect, it } from 'vitest';
import { parseThemeToolAction } from './assistantToolProtocolThemeParser';

describe('assistantToolProtocolThemeParser', () => {
  it('keeps direct creative css actions untouched', () => {
    const result = parseThemeToolAction({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.user { background: pink; }'
    }, undefined, 'creative');

    expect(result).toEqual({
      action: {
        kind: 'patchRawCss',
        css: '.app-shell.chat .bubble.user { background: pink; }',
        label: undefined
      }
    });
  });

  it('parses stable coordinate actions with an optional base color override', () => {
    const result = parseThemeToolAction({
      kind: 'applyThemeCoordinates',
      targets: 'all',
      hue: 336,
      hueCount: 2,
      emotion: 2,
      meaning: 7,
      baseColor: '#F3B7C8'
    }, undefined, 'stable');

    expect(result).toEqual({
      action: {
        kind: 'applyThemeCoordinates',
        targets: 'all',
        hue: 336,
        hueCount: 2,
        emotion: 2,
        meaning: 7,
        baseColor: '#f3b7c8',
        seed: undefined,
        label: undefined
      }
    });
  });

  it('rejects theme actions while theme mode is closed', () => {
    const result = parseThemeToolAction({
      kind: 'patchRawCss',
      css: '.app-shell.chat .bubble.user { background: pink; }'
    }, undefined, 'off');

    expect(result).toEqual({
      action: null,
      issue: '当前没有“换肤”能力。'
    });
  });
});
