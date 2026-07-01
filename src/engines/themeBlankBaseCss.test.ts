import { describe, expect, it } from 'vitest';
import { buildThemeBlankBaseCss } from './themeBlankBaseCss';

describe('buildThemeBlankBaseCss', () => {
  it('keeps shared panel safety net surfaces', () => {
    const css = buildThemeBlankBaseCss();

    expect(css).toContain('.preview-banner-trigger');
    expect(css).toContain('.thinking-box');
    expect(css).toContain('.code-workshop');
    expect(css).not.toContain('.card');
    expect(css).not.toContain('.empty-state-card');
  });

  it('does not duplicate chat content surface ownership', () => {
    const css = buildThemeBlankBaseCss();

    expect(css).not.toContain('.bubble.user');
    expect(css).not.toContain('.bubble.assistant');
    expect(css).not.toContain('.chat-box');
    expect(css).not.toContain('.system-inline-note');
    expect(css).not.toContain('.active-preview-strip');
    expect(css).not.toContain('.send-btn.has-content');
  });

  it('does not duplicate sheet family ownership', () => {
    const css = buildThemeBlankBaseCss();

    expect(css).not.toContain('.settings-sheet');
    expect(css).not.toContain('.menu-sheet');
    expect(css).not.toContain('.theme-studio-stage');
    expect(css).not.toContain('.theme-timeline-shell');
    expect(css).not.toContain('.code-workshop-layer');
    expect(css).not.toContain('.code-run-fullscreen');
    expect(css).not.toContain('.code-workshop-editor');
    expect(css).not.toContain('.code-workshop-preview');
    expect(css).not.toContain('.code-card-source-bar');
  });
});
