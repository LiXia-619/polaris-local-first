import { describe, expect, it } from 'vitest';
import { wrapThemeCssLayer } from '../engines/themeCssLayerBlocks';
import { hasCreativeBackgroundOverride } from './themeBackgroundOverride';

describe('hasCreativeBackgroundOverride', () => {
  it('does not treat stable background layers as creative overrides', () => {
    expect(hasCreativeBackgroundOverride({
      generatedCSS: wrapThemeCssLayer('stable:background', '.app-shell.chat { background: var(--bg); }'),
      customCSS: ''
    })).toBe(false);
  });

  it('detects selector-based creative background layers', () => {
    expect(hasCreativeBackgroundOverride({
      generatedCSS: wrapThemeCssLayer('chat-background', '.app-shell.chat { background: linear-gradient(180deg, pink, white); }'),
      customCSS: ''
    })).toBe(true);
  });

  it('detects raw creative css that targets app background paint layers', () => {
    expect(hasCreativeBackgroundOverride({
      generatedCSS: wrapThemeCssLayer('creative-raw-css', '.app-shell.collection .app-stage::before { background: none; }'),
      customCSS: ''
    })).toBe(true);
  });

  it('ignores raw creative css that only styles bubbles', () => {
    expect(hasCreativeBackgroundOverride({
      generatedCSS: wrapThemeCssLayer('creative-raw-css', '.app-shell.chat .bubble.user { background: pink; }'),
      customCSS: ''
    })).toBe(false);
  });

  it('detects manual custom css that rewrites app shell background variables', () => {
    expect(hasCreativeBackgroundOverride({
      generatedCSS: '',
      customCSS: '.app-shell.chat { --bg: #111827; }'
    })).toBe(true);
  });
});
