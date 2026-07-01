import { describe, expect, it } from 'vitest';
import { buildThemeFrameFromPresetId } from './themePresets';
import { normalizeThemeVariables } from './themePresetVariables';

describe('normalizeThemeVariables', () => {
  it('mirrors generic palette values into both cool and warm aliases', () => {
    const normalized = normalizeThemeVariables({
      '--bg': 'linear-gradient(180deg, #111111 0%, #222222 100%)',
      '--surface': 'rgba(10, 20, 30, 0.8)',
      '--surface-solid': '#0f1720',
      '--surface-deep': 'rgba(8, 14, 22, 0.92)',
      '--border': 'rgba(1, 2, 3, 0.2)',
      '--border-hover': 'rgba(4, 5, 6, 0.4)',
      '--text': '#eeeeee',
      '--text-soft': '#cccccc',
      '--text-muted': '#aaaaaa',
      '--accent': '#7dd3fc',
      '--accent-soft': 'rgba(125, 211, 252, 0.16)',
      '--accent-glow': 'rgba(125, 211, 252, 0.22)'
    });

    expect(normalized['--chat-bg']).toBe(normalized['--bg']);
    expect(normalized['--cool-bg']).toBe(normalized['--bg']);
    expect(normalized['--warm-bg']).toBe(normalized['--bg']);
    expect(normalized['--cool-surface']).toBe(normalized['--surface']);
    expect(normalized['--warm-surface']).toBe(normalized['--surface']);
    expect(normalized['--cool-accent-soft']).toBe(normalized['--accent-soft']);
    expect(normalized['--warm-accent-soft']).toBe(normalized['--accent-soft']);
  });

  it('keeps explicitly provided aliases instead of overwriting them from generic values', () => {
    const normalized = normalizeThemeVariables({
      '--bg': 'linear-gradient(180deg, #111111 0%, #222222 100%)',
      '--cool-bg': 'linear-gradient(180deg, #333333 0%, #444444 100%)',
      '--warm-bg': 'linear-gradient(180deg, #555555 0%, #666666 100%)'
    });

    expect(normalized['--chat-bg']).toBe(normalized['--bg']);
    expect(normalized['--cool-bg']).toBe('linear-gradient(180deg, #333333 0%, #444444 100%)');
    expect(normalized['--warm-bg']).toBe('linear-gradient(180deg, #555555 0%, #666666 100%)');
  });

  it('lets preset overrides replace inherited base aliases', () => {
    const frame = buildThemeFrameFromPresetId('glass-mint');

    expect(frame.cssVariables['--bg']).toBe('linear-gradient(160deg, #f9fff8 0%, #dff7e7 40%, #b8ead1 100%)');
    expect(frame.cssVariables['--cool-bg']).toBe(frame.cssVariables['--bg']);
    expect(frame.cssVariables['--warm-bg']).toBe(frame.cssVariables['--bg']);
    expect(frame.cssVariables['--cool-surface']).toBe('rgba(238, 244, 241, 0.72)');
    expect(frame.cssVariables['--warm-surface']).toBe('rgba(238, 244, 241, 0.72)');
    expect(frame.cssVariables['--cool-accent-soft']).toBe('rgba(59, 165, 111, 0.18)');
    expect(frame.cssVariables['--warm-accent-soft']).toBe('rgba(59, 165, 111, 0.18)');
  });
});
