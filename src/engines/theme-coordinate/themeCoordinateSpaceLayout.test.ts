import { describe, expect, it } from 'vitest';
import {
  buildThemeCoordinateSpaceLayout,
  emotionToSaturation,
  resolveAiryBubbleSeparationStrength,
  resolveExpressiveAiryProminence,
  resolveSampledSemanticState
} from './themeCoordinateSpaceLayout';

function px(value: string) {
  return Number.parseFloat(value.replace('px', ''));
}

function firstHslNumbers(value: string) {
  const match = value.match(/hsla?\(([-\d.]+)\s+([-\d.]+)%\s+([-\d.]+)%/i);
  if (!match) return null;
  return {
    h: Number(match[1]),
    s: Number(match[2]),
    l: Number(match[3])
  };
}

describe('buildThemeCoordinateSpaceLayout', () => {
  it('samples a stable local semantic variant around the requested center', () => {
    const center = { hue: 28, hueCount: 2, emotion: 3, meaning: -1, seed: 11 } as const;
    const first = resolveSampledSemanticState(center);
    const second = resolveSampledSemanticState(center);
    const shifted = resolveSampledSemanticState({ ...center, seed: 12 });

    expect(first).toEqual(second);
    expect(first.emotion).not.toBe(center.emotion);
    expect(first.meaning).not.toBe(center.meaning);
    expect(Math.abs(first.emotion - center.emotion)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.meaning - center.meaning)).toBeLessThanOrEqual(1);
    expect(shifted.emotion).not.toBe(first.emotion);
  });

  it('keeps extreme semantic centers tighter than middle-range ones', () => {
    const mid = resolveSampledSemanticState({ hue: 28, hueCount: 2, emotion: 0, meaning: 0, seed: 7 });
    const extreme = resolveSampledSemanticState({ hue: 28, hueCount: 2, emotion: 9, meaning: 9, seed: 7 });

    expect(Math.abs(extreme.emotion - 9)).toBeLessThan(Math.abs(mid.emotion - 0));
    expect(Math.abs(extreme.meaning - 9)).toBeLessThan(Math.abs(mid.meaning - 0));
  });

  it('reserves very high saturation for the extreme expressive end', () => {
    expect(emotionToSaturation(4, 0)).toBeLessThan(40);
    expect(emotionToSaturation(7, 0)).toBeLessThan(52);
    expect(emotionToSaturation(10, 0)).toBeGreaterThan(66);
    expect(emotionToSaturation(10, 0) - emotionToSaturation(7, 0)).toBeGreaterThan(14);
  });

  it('keeps crafted fabric backgrounds off the concentric-ring fallback', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 88,
      hueCount: 3,
      emotion: 6,
      meaning: 4,
      seed: 7
    });

    expect(layout.styleFamily).toBe('crafted-fabric');
    expect(layout.specs.background.textureLabel).toBe('fabric');
    expect(layout.specs.background.fill).not.toContain('repeating-radial-gradient');
    expect(layout.specs.background.fill).toContain('repeating-linear-gradient');
  });

  it('uses the dedicated linen weave instead of the ring fallback', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 32,
      hueCount: 2,
      emotion: 0,
      meaning: 4,
      seed: 11
    });

    expect(layout.specs.background.textureLabel).toBe('linen');
    expect(layout.specs.background.fill).toContain('repeating-linear-gradient');
    expect(layout.specs.background.fill).not.toContain('repeating-radial-gradient');
  });

  it('renders pearlescent from its own pattern branch', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 286,
      hueCount: 4,
      emotion: 8,
      meaning: -1,
      seed: 11
    });

    expect(layout.specs.topbar.textureLabel).toBe('pearlescent');
    expect(layout.specs.topbar.fill).toContain('repeating-linear-gradient');
    expect(layout.specs.topbar.fill).not.toContain('repeating-radial-gradient');
  });

  it('gives deep high-meaning backgrounds a dedicated leather material', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 228,
      hueCount: 4,
      emotion: 8,
      meaning: 8,
      seed: 5
    });

    expect(layout.specs.background.textureLabel).toBe('leather');
    expect(layout.specs.background.fill).toContain('repeating-linear-gradient');
    expect(layout.specs.background.fill).toContain('radial-gradient(circle at 18% 16%');
  });

  it('keeps deep leather bubbles off the old glossy fallback', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 228,
      hueCount: 4,
      emotion: 8,
      meaning: 10,
      seed: 13
    });

    expect(layout.specs['chat-ai-bubble'].textureLabel).toBe('leather');
    expect(layout.specs['chat-ai-bubble'].fill).toContain('repeating-linear-gradient');
    expect(layout.specs['chat-ai-bubble'].fill).not.toContain('linear-gradient(115deg, rgba(255,255,255,0.042), transparent 42%)');
  });

  it('keeps linen bubble gradients in the same family as the background', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 210,
      hueCount: 4,
      emotion: 2,
      meaning: 6,
      seed: 7
    });

    expect(layout.specs.background.textureLabel).toBe('linen');
    expect(layout.specs['chat-user-bubble'].textureLabel).toBe('linen');
    expect(layout.specs['chat-ai-bubble'].textureLabel).toBe('linen');
    expect(layout.specs.background.gradientLabel.startsWith('smooth-') || layout.specs.background.gradientLabel.startsWith('wash-')).toBe(true);
    expect(layout.specs['chat-user-bubble'].gradientLabel.startsWith('solid-')).toBe(true);
    expect(layout.specs['chat-ai-bubble'].gradientLabel.startsWith('solid-')).toBe(true);
  });

  it('keeps deep leather surfaces on the same matte gradient family', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 228,
      hueCount: 4,
      emotion: 8,
      meaning: 8,
      seed: 5
    });

    expect(layout.specs.background.gradientLabel).toBe('smooth-radial/1h');
    expect(layout.specs['chat-user-bubble'].gradientLabel).toBe('solid-horizontal/1h');
    expect(layout.specs['chat-ai-bubble'].gradientLabel).toBe('solid-diagonal/1h');
    expect(layout.specs.panel.gradientLabel).toBe('solid-horizontal/1h');
  });

  it('lets tactile themes keep a light custom base color without whitening the whole background', () => {
    const baseline = buildThemeCoordinateSpaceLayout({
      hue: 336,
      hueCount: 2,
      emotion: 2,
      meaning: 7,
      seed: 3
    });
    const withBaseColor = buildThemeCoordinateSpaceLayout({
      hue: 336,
      hueCount: 2,
      emotion: 2,
      meaning: 7,
      seed: 3,
      baseColor: '#f3b7c8'
    });

    expect(withBaseColor.specs.card.textureLabel).toBe(baseline.specs.card.textureLabel);
    expect(withBaseColor.cardColor.l).toBeGreaterThan(baseline.cardColor.l + 12);
    expect(withBaseColor.backgroundColor).toEqual(baseline.backgroundColor);
  });

  it('assigns stronger frame presence to structural surfaces on the tactile side', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 28,
      hueCount: 3,
      emotion: 7,
      meaning: 8,
      seed: 8
    });

    expect(px(layout.specs.panel.borderWidth)).toBeGreaterThan(px(layout.specs['chat-user-bubble'].borderWidth));
    expect(px(layout.specs.card.borderWidth)).toBeGreaterThan(px(layout.specs['chat-ai-bubble'].borderWidth));
    expect(layout.specs.panel.borderStyle === 'double' || layout.specs.panel.borderStyle === 'dashed' || layout.specs.panel.borderStyle === 'dotted').toBe(true);
  });

  it('keeps the abstract side close to frameless even when energetic', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 328,
      hueCount: 4,
      emotion: 8,
      meaning: -7,
      seed: 5
    });

    expect(layout.specs.background.borderStyle).toBe('solid');
    expect(px(layout.specs.background.borderWidth)).toBeLessThanOrEqual(0.2);
    expect(px(layout.specs['chat-ai-bubble'].borderWidth)).toBeLessThan(px(layout.specs.panel.borderWidth));
  });

  it('always boosts the background on the extreme expressive end', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const layout = buildThemeCoordinateSpaceLayout({
        hue: 40,
        hueCount: 9,
        emotion: 10,
        meaning: -2,
        seed
      });

      expect(layout.boostedSurfaces).toContain('background');
    }
  });

  it('pins a supporting chrome surface with the background for expressive airy themes', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const layout = buildThemeCoordinateSpaceLayout({
        hue: 40,
        hueCount: 9,
        emotion: 10,
        meaning: -6,
        seed
      });

      expect(layout.boostedSurfaces).toContain('background');
      expect(
        layout.boostedSurfaces.includes('topbar')
        || layout.boostedSurfaces.includes('panel')
      ).toBe(true);
    }
  });

  it('gives flower-mist surfaces a thinner prismatic metal border', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 326,
      hueCount: 4,
      emotion: 8,
      meaning: -6,
      seed: 1
    });

    expect(layout.specs['chat-user-bubble'].borderPaint).toContain('132deg');
    expect(px(layout.specs['chat-user-bubble'].borderWidth)).toBeLessThan(1.2);
    expect(layout.specs['chat-user-bubble'].textureLabel).toBe('wash-cloud');
    expect(layout.specs['chat-user-bubble'].ornamentLabel).toBe('sheen');
    expect(layout.specs['chat-user-bubble'].gradientLabel.endsWith('/1h')).toBe(true);
    expect(layout.specs['chat-ai-bubble'].gradientLabel.endsWith('/1h')).toBe(true);
    const userFill = firstHslNumbers(layout.specs['chat-user-bubble'].fill);
    const aiFill = firstHslNumbers(layout.specs['chat-ai-bubble'].fill);
    expect(userFill).not.toBeNull();
    expect(aiFill).not.toBeNull();
    expect(userFill!.s).toBeLessThan(32);
    expect(userFill!.l).toBeGreaterThan(78);
    expect(Math.abs(userFill!.s - aiFill!.s)).toBeLessThan(14);
  });

  it('gives tactile structural surfaces quieter fills than the background', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 18,
      hueCount: 4,
      emotion: 6,
      meaning: 7,
      seed: 9
    });

    expect(layout.specs.background.gradientLabel.startsWith('solid-')).toBe(false);
    expect(layout.specs.card.gradientLabel.startsWith('solid-')).toBe(true);
    expect(layout.specs.composer.gradientLabel.startsWith('solid-')).toBe(true);
  });

  it('lets restrained tactile bubbles occasionally become more opaque and dashed', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 42,
      hueCount: 3,
      emotion: 0,
      meaning: 6,
      seed: 5
    });

    expect(layout.specs['chat-user-bubble'].borderStyle).toBe('dashed');
    expect(layout.specs['chat-user-bubble'].fill.startsWith('linear-gradient(180deg')).toBe(true);
  });

  it('tints text tones toward cool or warm ink instead of pure black and white', () => {
    const airy = buildThemeCoordinateSpaceLayout({
      hue: 222,
      hueCount: 3,
      emotion: -4,
      meaning: -6,
      seed: 7
    });
    const tactile = buildThemeCoordinateSpaceLayout({
      hue: 38,
      hueCount: 3,
      emotion: -2,
      meaning: 7,
      seed: 7
    });

    expect(airy.specs['chat-ai-bubble'].text.startsWith('hsla(')).toBe(true);
    expect(tactile.specs.card.text.startsWith('hsla(')).toBe(true);
    expect(airy.specs['chat-ai-bubble'].text).not.toBe(tactile.specs.card.text);
    expect(airy.specs['chat-ai-bubble'].text).not.toBe('rgba(255,255,255,0.92)');
    expect(tactile.specs.card.text).not.toBe('#243142');
  });

  it('adds more bubble separation on gray airy backgrounds than on vivid ones', () => {
    const grayAiry = resolveAiryBubbleSeparationStrength({
      meaning: -6,
      hueCount: 2,
      backgroundTextureLabel: 'wash-cloud',
      backgroundColor: { h: 24, s: 16, l: 76 }
    });
    const vividAiry = resolveAiryBubbleSeparationStrength({
      meaning: -6,
      hueCount: 7,
      backgroundTextureLabel: 'wash-cloud',
      backgroundColor: { h: 24, s: 58, l: 76 }
    });

    expect(grayAiry).toBeGreaterThan(0.45);
    expect(vividAiry).toBeLessThan(0.18);
    expect(grayAiry).toBeGreaterThan(vividAiry);
  });

  it('treats expressive airy style as a relative prominence system instead of global color inflation', () => {
    const background = resolveExpressiveAiryProminence({
      surface: 'background',
      requestedEmotion: 10,
      requestedMeaning: -6,
      boostedSurfaces: ['background', 'panel', 'chat-user-bubble']
    });
    const support = resolveExpressiveAiryProminence({
      surface: 'panel',
      requestedEmotion: 10,
      requestedMeaning: -6,
      boostedSurfaces: ['background', 'panel', 'chat-user-bubble']
    });
    const quiet = resolveExpressiveAiryProminence({
      surface: 'chat-ai-bubble',
      requestedEmotion: 10,
      requestedMeaning: -6,
      boostedSurfaces: ['background', 'panel', 'chat-user-bubble']
    });

    expect(background).toBeGreaterThan(support);
    expect(support).toBeGreaterThan(quiet);
    expect(quiet).toBe(0);
  });

  it('keeps extreme flower-mist family identity even on airy surfaces that were not boosted', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 57,
      hueCount: 9,
      emotion: 10,
      meaning: -10,
      seed: 2
    });

    expect(layout.boostedSurfaces).not.toContain('chat-user-bubble');
    expect(['wash-cloud', 'frosted-glass', 'pearlescent']).toContain(layout.specs['chat-user-bubble'].textureLabel);
    expect(['halo-mist', 'mist-cut']).toContain(layout.specs['chat-user-bubble'].edgeLabel);
    expect(['sheen', 'prism-halo', 'prism']).toContain(layout.specs['chat-user-bubble'].ornamentLabel);
  });

  it('keeps expressive atmosphere colored instead of bleaching it toward white', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 57,
      hueCount: 9,
      emotion: 10,
      meaning: -10,
      seed: 1
    });

    expect(layout.backgroundColor.l).toBeLessThan(90);
    expect(layout.backgroundColor.s).toBeGreaterThan(30);
  });

  it('adds stronger optical lift to the boosted background than to quiet airy surfaces', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 40,
      hueCount: 9,
      emotion: 10,
      meaning: -6,
      seed: 1
    });

    expect(layout.specs.background.fill).toContain('linear-gradient(122deg');
    expect(layout.specs.panel.fill.includes('linear-gradient(115deg') || layout.specs.panel.fill.includes('radial-gradient(circle at 22% 18%')).toBe(true);
    expect(layout.specs.composer.fill).not.toContain('linear-gradient(122deg');
  });

  it('pushes airy chat bubbles farther from the background in gray mist fields', () => {
    const grayAiry = buildThemeCoordinateSpaceLayout({
      hue: 22,
      hueCount: 2,
      emotion: -1,
      meaning: -6,
      seed: 7
    });
    const vividAiry = buildThemeCoordinateSpaceLayout({
      hue: 326,
      hueCount: 8,
      emotion: 5,
      meaning: -6,
      seed: 7
    });

    expect(px(grayAiry.specs['chat-user-bubble'].borderWidth)).toBeGreaterThan(px(vividAiry.specs['chat-user-bubble'].borderWidth));
    expect(grayAiry.specs['chat-user-bubble'].shadow).not.toBe(vividAiry.specs['chat-user-bubble'].shadow);
  });

  it('keeps the requested center while compiling from the sampled semantic state', () => {
    const layout = buildThemeCoordinateSpaceLayout({
      hue: 28,
      hueCount: 2,
      emotion: 3,
      meaning: -1,
      seed: 11
    });

    expect(layout.normalizedState.emotion).toBe(3);
    expect(layout.normalizedState.meaning).toBe(-1);
    expect(layout.resolvedState.emotion).not.toBe(layout.normalizedState.emotion);
    expect(layout.resolvedState.meaning).not.toBe(layout.normalizedState.meaning);
  });

  it('lets nearby seeds produce more distinct within-quadrant outputs without changing material family', () => {
    const base = {
      hue: 28,
      hueCount: 2,
      emotion: 3,
      meaning: -1
    } as const;
    const first = buildThemeCoordinateSpaceLayout({ ...base, seed: 11 });
    const second = buildThemeCoordinateSpaceLayout({ ...base, seed: 12 });

    expect(first.specs.background.textureLabel).toBe(second.specs.background.textureLabel);
    expect(first.specs.panel.textureLabel).toBe(second.specs.panel.textureLabel);
    expect(
      first.specs.background.gradientLabel !== second.specs.background.gradientLabel
      || first.specs['chat-user-bubble'].edgeLabel !== second.specs['chat-user-bubble'].edgeLabel
      || first.specs.panel.fill !== second.specs.panel.fill
    ).toBe(true);
  });

  it('lets airy backgrounds vary inside the same nearby family instead of staying on one fixed face', () => {
    const base = {
      hue: 24,
      hueCount: 4,
      emotion: 7,
      meaning: -2
    } as const;
    const first = buildThemeCoordinateSpaceLayout({ ...base, seed: 3 });
    const second = buildThemeCoordinateSpaceLayout({ ...base, seed: 4 });

    expect(first.styleFamily).toBe('candy-bloom');
    expect(second.styleFamily).toBe('candy-bloom');
    expect(['wash-cloud', 'frosted-glass', 'powder-dust', 'glass', 'candy-film', 'pearlescent']).toContain(first.specs.background.textureLabel);
    expect(['wash-cloud', 'frosted-glass', 'powder-dust', 'glass', 'candy-film', 'pearlescent']).toContain(second.specs.background.textureLabel);
    expect(first.specs.background.fill).not.toBe(second.specs.background.fill);
  });

  it('maps coordinate regions into discrete style families', () => {
    expect(buildThemeCoordinateSpaceLayout({ hue: 210, hueCount: 2, emotion: 1, meaning: -6, seed: 1 }).styleFamily).toBe('mist-glass');
    expect(buildThemeCoordinateSpaceLayout({ hue: 210, hueCount: 2, emotion: -6, meaning: -4, seed: 1 }).styleFamily).toBe('quiet-ink');
    expect(buildThemeCoordinateSpaceLayout({ hue: 28, hueCount: 2, emotion: 0, meaning: 1, seed: 1 }).styleFamily).toBe('paper-room');
    expect(buildThemeCoordinateSpaceLayout({ hue: 88, hueCount: 3, emotion: 6, meaning: 4, seed: 1 }).styleFamily).toBe('crafted-fabric');
    expect(buildThemeCoordinateSpaceLayout({ hue: 326, hueCount: 4, emotion: 8, meaning: -1, seed: 1 }).styleFamily).toBe('candy-bloom');
    expect(buildThemeCoordinateSpaceLayout({ hue: 228, hueCount: 4, emotion: 5, meaning: 8, seed: 1 }).styleFamily).toBe('dark-instrument');
  });

  it('uses family posture to make nearby coordinate regions visibly different', () => {
    const candy = buildThemeCoordinateSpaceLayout({ hue: 326, hueCount: 4, emotion: 8, meaning: -1, seed: 1 });
    const quiet = buildThemeCoordinateSpaceLayout({ hue: 326, hueCount: 2, emotion: -6, meaning: -1, seed: 1 });
    const crafted = buildThemeCoordinateSpaceLayout({ hue: 326, hueCount: 4, emotion: 5, meaning: 6, seed: 1 });

    expect(candy.surfaceTraits.topbar).toBe('topbar-clear');
    expect(candy.surfaceTraits['chat-user-bubble']).toBe('bubble-pill');
    expect(quiet.surfaceTraits['chat-ai-bubble']).toBe('bubble-bare');
    expect(crafted.surfaceTraits.card).toBe('stitched');
    expect(new Set([
      candy.specs.background.textureLabel,
      quiet.specs.background.textureLabel,
      crafted.specs.background.textureLabel
    ]).size).toBe(3);
  });
});
