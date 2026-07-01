import { describe, expect, it } from 'vitest';
import {
  buildThemeCoordinateControlStyleVars,
  resolveThemeCoordinateControlColorPlan
} from './themeCoordinateControlVars';

describe('resolveThemeCoordinateControlColorPlan', () => {
  it('lifts controls away from dark backgrounds', () => {
    const plan = resolveThemeCoordinateControlColorPlan({ h: 220, s: 12, l: 8 });

    expect(plan.surfaceTop.l).toBeGreaterThan(18);
    expect(plan.surfaceBottom.l).toBeGreaterThan(12);
    expect(plan.surfaceTop.l).toBeLessThan(40);
    expect(plan.text.l).toBeGreaterThan(80);
  });

  it('keeps colored mid-tone controls tinted without turning them white', () => {
    const plan = resolveThemeCoordinateControlColorPlan({ h: 16, s: 58, l: 58 });

    expect(plan.surfaceTop.h).toBe(16);
    expect(plan.surfaceTop.l).toBeGreaterThan(58);
    expect(plan.surfaceTop.l).toBeLessThan(82);
    expect(plan.surfaceTop.s).toBeLessThan(58);
    expect(plan.text.l).toBeLessThan(24);
  });

  it('darkens controls on very light backgrounds so they stay visible', () => {
    const plan = resolveThemeCoordinateControlColorPlan({ h: 42, s: 18, l: 94 });

    expect(plan.surfaceTop.l).toBeLessThan(94);
    expect(plan.surfaceBottom.l).toBeLessThan(plan.surfaceTop.l);
    expect(plan.text.l).toBeLessThan(32);
  });
});

describe('buildThemeCoordinateControlStyleVars', () => {
  it('returns complete semantic control tokens', () => {
    const vars = buildThemeCoordinateControlStyleVars({ h: 16, s: 58, l: 58 });

    expect(vars['--control-surface']).toContain('linear-gradient');
    expect(vars['--control-border']).toContain('1px solid');
    expect(vars['--control-text']).toContain('hsla(');
    expect(vars['--control-placeholder']).toContain('hsla(');
  });
});
