import { describe, expect, it } from 'vitest';
import { normalizeThemeCssForRuntime } from './themeCssRuntime';
import { wrapThemeCssLayer } from './themeCssLayerBlocks';

describe('normalizeThemeCssForRuntime', () => {
  it('hydrates adaptive control variables for legacy shell theme backgrounds', () => {
    const css = normalizeThemeCssForRuntime(`
.app-shell.chat {
  --bg: #080b10;
  --text: rgba(255, 255, 255, .9);
}
    `);

    expect(css).toContain('--control-surface: linear-gradient');
    expect(css).toContain('--control-border: 1px solid');
    expect(css).toContain('--control-text: hsla(');
    expect(css).toContain('--control-placeholder: hsla(');
  });

  it('hydrates collection shell controls from direct background colors', () => {
    const css = normalizeThemeCssForRuntime(`
.app-shell.collection {
  background: #cc7755;
}
    `);

    expect(css).toContain('--control-surface: linear-gradient');
    expect(css).toContain('--control-surface-solid: hsla(');
    expect(css).toContain('--control-focus-shadow: 0 0 0');
  });

  it('does not override explicit control variables from newer themes', () => {
    const css = normalizeThemeCssForRuntime(`
.app-shell.chat {
  --bg: #080b10;
  --control-surface: pink;
}
    `);

    expect(css).toContain('--control-surface: pink;');
    expect(css.match(/--control-surface\s*:/g)).toHaveLength(1);
  });

  it('does not turn local descendant backgrounds into global control variables', () => {
    const css = normalizeThemeCssForRuntime(`
.app-shell.chat .bubble.assistant {
  background: #080b10;
}
    `);

    expect(css).toContain('background: #080b10;');
    expect(css).not.toContain('--control-surface');
  });

  it('strips shell-level blur filters from theme css', () => {
    const css = normalizeThemeCssForRuntime(`
.app-shell.chat .app-stage {
  backdrop-filter: blur(24px) saturate(1.2);
  filter: blur(12px);
  background: linear-gradient(180deg, pink, white);
}
    `);

    expect(css).toContain('.app-shell.chat .app-stage');
    expect(css).toContain('background: linear-gradient(180deg, pink, white);');
    expect(css).not.toContain('backdrop-filter: blur(24px) saturate(1.2);');
    expect(css).not.toContain('filter: blur(12px);');
  });

  it('keeps blur-capable content surfaces intact', () => {
    const css = normalizeThemeCssForRuntime(`
.app-shell.chat .bubble.assistant {
  backdrop-filter: blur(12px);
  filter: saturate(1.02);
}
    `);

    expect(css).toContain('backdrop-filter: blur(12px);');
    expect(css).toContain('filter: saturate(1.02);');
  });

  it('strips creative raw css geometry from protected composer surfaces while keeping look rules', () => {
    const css = normalizeThemeCssForRuntime(wrapThemeCssLayer('creative-raw-css', `
.app-shell.chat .chat-box .send-btn {
  transform: translateX(24px);
  position: absolute;
  margin-left: 12px;
  background: linear-gradient(180deg, pink, plum);
  border-radius: 18px;
}
    `));

    expect(css).toContain('background: linear-gradient(180deg, pink, plum);');
    expect(css).toContain('border-radius: 18px;');
    expect(css).not.toContain('transform: translateX(24px);');
    expect(css).not.toContain('position: absolute;');
    expect(css).not.toContain('margin-left: 12px;');
  });

  it('lets creative raw css hide composer controls without letting them drift away', () => {
    const css = normalizeThemeCssForRuntime(wrapThemeCssLayer('creative-raw-css', `
.chat-box .send-btn {
  display: none;
  opacity: 0;
  padding: 0;
  transform: translateX(24px);
  position: absolute;
}
    `));

    expect(css).toContain('display: none;');
    expect(css).toContain('opacity: 0;');
    expect(css).toContain('padding: 0;');
    expect(css).not.toContain('transform: translateX(24px);');
    expect(css).not.toContain('position: absolute;');
  });

  it('keeps stable compiled composer geometry intact', () => {
    const css = normalizeThemeCssForRuntime(wrapThemeCssLayer('stable:composer', `
.chat-box .send-btn {
  width: 40px;
  height: 40px;
  transform: none;
}
    `));

    expect(css).toContain('width: 40px;');
    expect(css).toContain('height: 40px;');
    expect(css).toContain('transform: none;');
  });

  it('keeps collection bottom navigation from accumulating inner chrome layers', () => {
    const css = normalizeThemeCssForRuntime(wrapThemeCssLayer('creative-raw-css', `
.app-shell.collection .collection-shelf-tabs {
  background: linear-gradient(180deg, pink, white);
  box-shadow: 0 -12px 30px rgba(0, 0, 0, .1);
}
.app-shell.collection .collection-shelf-tab-row,
.app-shell.collection .shelf-tab,
.app-shell.collection .shelf-tab.active,
.app-shell.collection .shelf-tab-icon {
  background: rgba(255, 255, 255, .34);
  border: 1px solid rgba(255, 255, 255, .5);
  box-shadow: 0 12px 30px rgba(255, 0, 128, .22);
  backdrop-filter: blur(18px);
  color: #5f3b4f;
}
.app-shell.collection .shelf-tab-label {
  color: #5f3b4f;
  text-shadow: 0 0 10px rgba(255, 0, 128, .16);
}
    `));

    expect(css).toContain('.app-shell.collection .collection-shelf-tabs');
    expect(css).toContain('background: linear-gradient(180deg, pink, white);');
    expect(css).toContain('box-shadow: 0 -12px 30px rgba(0, 0, 0, .1);');
    expect(css).toContain('color: #5f3b4f;');
    expect(css).toContain('text-shadow: 0 0 10px rgba(255, 0, 128, .16);');
    expect(css).not.toContain('background: rgba(255, 255, 255, .34);');
    expect(css).not.toContain('border: 1px solid rgba(255, 255, 255, .5);');
    expect(css).not.toContain('box-shadow: 0 12px 30px rgba(255, 0, 128, .22);');
    expect(css).not.toContain('backdrop-filter: blur(18px);');
  });

  it('keeps outer shelf chrome when it is grouped with protected inner tabs', () => {
    const css = normalizeThemeCssForRuntime(wrapThemeCssLayer('creative-raw-css', `
.app-shell.collection .collection-shelf-tabs,
.app-shell.collection .shelf-tab {
  border: 2px dashed rgba(255, 182, 86, .72);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.2);
  color: #5f3b4f;
}
    `));

    expect(css).toContain('.app-shell.collection .collection-shelf-tabs{border: 2px dashed rgba(255, 182, 86, .72);');
    expect(css).toContain('box-shadow: inset 0 0 0 1px rgba(255,255,255,.2);');
    expect(css).toContain('.app-shell.collection .shelf-tab{color: #5f3b4f;');
    expect(css).not.toContain('.app-shell.collection .shelf-tab{border: 2px dashed');
    expect(css).not.toContain('.app-shell.collection .shelf-tab{box-shadow:');
  });
});
