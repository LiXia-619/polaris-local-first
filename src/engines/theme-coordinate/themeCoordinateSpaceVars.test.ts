import { describe, expect, it } from 'vitest';
import { buildThemeCoordinateSpaceLayout } from './themeCoordinateSpaceLayout';
import { buildThemeCoordinateStyleVars } from './themeCoordinateSpaceVars';

describe('buildThemeCoordinateStyleVars', () => {
  it('gives chat and collection different world backgrounds from the same theme center', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 24,
      hueCount: 3,
      emotion: 4,
      meaning: 2,
      seed: 17
    });
    const vars = buildThemeCoordinateStyleVars(layout);

    expect(vars['--cool-bg']).not.toBe(vars['--warm-bg']);
    expect(vars['--cool-surface']).not.toBe(vars['--warm-surface']);
    expect(vars['--cool-accent-soft']).not.toBe(vars['--warm-accent-soft']);
  });

  it('keeps world background divergence stable for the same seed', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 210,
      hueCount: 2,
      emotion: -2,
      meaning: -4,
      seed: 9
    });

    expect(buildThemeCoordinateStyleVars(layout)).toEqual(buildThemeCoordinateStyleVars(layout));
  });
});
