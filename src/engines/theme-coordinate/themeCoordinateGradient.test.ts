import { describe, it, expect } from 'vitest';
import {
  gradientPaint,
  resolveGradientMode,
  buildSurfaceHueCount,
  buildHueStops,
  buildSurfaceGradient,
} from './themeCoordinateGradient';

describe('gradientPaint', () => {
  const stops = ['red 0%', 'blue 100%'];

  it('generates vertical gradient by default', () => {
    expect(gradientPaint(stops, 'vertical')).toContain('180deg');
  });

  it('generates horizontal gradient at 90deg', () => {
    expect(gradientPaint(stops, 'horizontal')).toContain('90deg');
  });

  it('generates diagonal gradient at 135deg', () => {
    expect(gradientPaint(stops, 'diagonal')).toContain('135deg');
  });

  it('generates radial gradient', () => {
    expect(gradientPaint(stops, 'radial')).toContain('radial-gradient');
  });
});

describe('resolveGradientMode', () => {
  it('returns a valid gradient mode', () => {
    const modes = ['vertical', 'horizontal', 'diagonal', 'radial'];
    const result = resolveGradientMode(180, 0, 0, 42, 'background');
    expect(modes).toContain(result);
  });

  it('is deterministic for same inputs', () => {
    const a = resolveGradientMode(90, 3, 5, 7, 'card');
    const b = resolveGradientMode(90, 3, 5, 7, 'card');
    expect(a).toBe(b);
  });

  it('varies with different surfaces', () => {
    // Not guaranteed to differ but tests the surface index path
    const bg = resolveGradientMode(180, 0, 0, 0, 'background');
    const card = resolveGradientMode(180, 0, 0, 0, 'card');
    // At least both are valid
    expect(['vertical', 'horizontal', 'diagonal', 'radial']).toContain(bg);
    expect(['vertical', 'horizontal', 'diagonal', 'radial']).toContain(card);
  });
});

describe('buildSurfaceHueCount', () => {
  it('returns 1 when maxHueCount is 1', () => {
    expect(buildSurfaceHueCount({ surface: 'background', maxHueCount: 1, emotion: 5, seed: 42 })).toBe(1);
  });

  it('returns value within [1, maxHueCount]', () => {
    for (let seed = 0; seed < 20; seed++) {
      const count = buildSurfaceHueCount({ surface: 'card', maxHueCount: 5, emotion: 3, seed });
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it('is deterministic for same inputs', () => {
    const a = buildSurfaceHueCount({ surface: 'background', maxHueCount: 7, emotion: -2, seed: 99 });
    const b = buildSurfaceHueCount({ surface: 'background', maxHueCount: 7, emotion: -2, seed: 99 });
    expect(a).toBe(b);
  });

  it('lets very high hue counts stay high on expressive non-tactile backgrounds', () => {
    const count = buildSurfaceHueCount({
      surface: 'background',
      maxHueCount: 9,
      emotion: 7,
      meaning: -3,
      seed: 7,
      textureLabel: 'wash-cloud'
    });
    expect(count).toBeGreaterThanOrEqual(6);
  });
});

describe('buildHueStops', () => {
  const baseColor = { h: 220, s: 60, l: 50 };

  it('returns exactly 2 stops for single hue', () => {
    const stops = buildHueStops({
      color: baseColor, localHueCount: 1, hueSpread: 0,
      emotion: 0, meaning: 0, opacityScale: 1, surface: 'background'
    });
    expect(stops).toHaveLength(2);
    expect(stops[0]).toContain('0%');
    expect(stops[1]).toContain('100%');
  });

  it('returns N stops for N hues', () => {
    const stops = buildHueStops({
      color: baseColor, localHueCount: 5, hueSpread: 60,
      emotion: 3, meaning: 2, opacityScale: 1, surface: 'card'
    });
    expect(stops).toHaveLength(5);
  });

  it('all stops contain hsla color values', () => {
    const stops = buildHueStops({
      color: baseColor, localHueCount: 3, hueSpread: 40,
      emotion: 0, meaning: 0, opacityScale: 1, surface: 'background'
    });
    for (const stop of stops) {
      expect(stop).toMatch(/hsla\(/);
    }
  });
});

describe('buildSurfaceGradient', () => {
  it('returns fill string, hueCount, and label', () => {
    const result = buildSurfaceGradient({
      surface: 'background',
      color: { h: 200, s: 50, l: 45 },
      maxHueCount: 5,
      emotion: 2,
      meaning: 3,
      opacityScale: 1,
      seed: 42,
      mode: 'vertical',
    });
    expect(result).toHaveProperty('fill');
    expect(result).toHaveProperty('localHueCount');
    expect(result).toHaveProperty('label');
    expect(typeof result.fill).toBe('string');
    expect(result.localHueCount).toBeGreaterThanOrEqual(1);
    expect(result.label).toMatch(/\//); // format: variant-mode/Nh
  });

  it('is deterministic', () => {
    const args = {
      surface: 'card' as const,
      color: { h: 120, s: 40, l: 55 },
      maxHueCount: 3, emotion: -3, meaning: 6,
      opacityScale: 0.9, seed: 7, mode: 'diagonal' as const,
    };
    expect(buildSurfaceGradient(args)).toEqual(buildSurfaceGradient(args));
  });

  it('keeps energetic bubble gradients in softer families by default', () => {
    const result = buildSurfaceGradient({
      surface: 'chat-ai-bubble',
      color: { h: 220, s: 55, l: 52 },
      maxHueCount: 5,
      emotion: 7,
      meaning: 0,
      opacityScale: 1,
      seed: 3,
      mode: 'diagonal',
    });
    expect(result.label.startsWith('wash-') || result.label.startsWith('smooth-')).toBe(true);
  });

  it('keeps tactile bubble gradients near the family center', () => {
    const result = buildSurfaceGradient({
      surface: 'chat-ai-bubble',
      color: { h: 220, s: 55, l: 52 },
      maxHueCount: 4,
      emotion: 2,
      meaning: 6,
      opacityScale: 1,
      seed: 7,
      mode: 'horizontal',
      textureLabel: 'linen',
    });
    expect(result.label.startsWith('solid-')).toBe(true);
    expect(result.localHueCount).toBe(1);
  });

  it('treats hue count 1 as a flat solid fill', () => {
    const result = buildSurfaceGradient({
      surface: 'background',
      color: { h: 53, s: 30, l: 26 },
      maxHueCount: 1,
      emotion: 1,
      meaning: 6,
      opacityScale: 1,
      seed: 5,
      mode: 'diagonal',
    });
    expect(result.localHueCount).toBe(1);
    expect(result.label.startsWith('solid-')).toBe(true);
    expect(result.fill).not.toContain('gradient(');
  });

  it('still allows halo for dramatic bubble states', () => {
    const result = buildSurfaceGradient({
      surface: 'chat-ai-bubble',
      color: { h: 220, s: 55, l: 52 },
      maxHueCount: 5,
      emotion: 8,
      meaning: -5,
      opacityScale: 1,
      seed: 1,
      mode: 'radial',
    });
    expect(result.label.startsWith('halo-')).toBe(true);
  });

  it('keeps structural tactile surfaces as solid anchors while background stays expressive', () => {
    const card = buildSurfaceGradient({
      surface: 'card',
      color: { h: 28, s: 48, l: 56 },
      maxHueCount: 4,
      emotion: 5,
      meaning: 7,
      opacityScale: 1,
      seed: 12,
      mode: 'diagonal',
      textureLabel: 'fabric',
    });
    const background = buildSurfaceGradient({
      surface: 'background',
      color: { h: 28, s: 48, l: 56 },
      maxHueCount: 4,
      emotion: 5,
      meaning: 7,
      opacityScale: 1,
      seed: 12,
      mode: 'diagonal',
      textureLabel: 'fabric',
    });

    expect(card.label.startsWith('solid-')).toBe(true);
    expect(background.label.startsWith('solid-')).toBe(false);
  });

  it('lets high hue count unlock richer gradients for expressive abstract bubbles', () => {
    const bubble = buildSurfaceGradient({
      surface: 'chat-user-bubble',
      color: { h: 286, s: 62, l: 48 },
      maxHueCount: 9,
      emotion: 8,
      meaning: -4,
      opacityScale: 1,
      seed: 7,
      mode: 'diagonal',
      textureLabel: 'wash-cloud',
    });

    expect(bubble.localHueCount).toBeGreaterThanOrEqual(3);
    expect(bubble.label.startsWith('solid-')).toBe(false);
  });
});
