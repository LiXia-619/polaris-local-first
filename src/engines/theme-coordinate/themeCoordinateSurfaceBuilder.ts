import {
  buildSurfaceGradient,
  gradientPaint,
  resolveGradientMode,
  type ThemeGradientMode
} from './themeCoordinateGradient';
import { clamp, lerp, wrapHue } from './themeCoordinateMath';
import { buildTexturePatternOverlay } from './themeCoordinatePattern';
import {
  normalizeSigned,
  restraintStrength,
  buildThemeCoordinateBaseColor,
  resolveExpressiveAiryProminence
} from './themeCoordinateSemantics';
import {
  isTactileTextureLabel,
  resolveSurfaceEdgeLabel,
  resolveSurfaceOrnamentLabel,
  resolveSurfaceTextureLabel
} from './themeCoordinateTextureProfile';
import {
  resolveThemeCoordinateFamilyColorDelta,
  resolveThemeCoordinateFamilyTextureLabel,
  type ThemeCoordinateStyleFamily
} from './themeCoordinateStyleFamily';
import {
  THEME_COORDINATE_SURFACES,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';
import type {
  BaseColor,
  ThemeCoordinateState,
  ThemeCoordinateSurfaceMap,
  ThemeCoordinateSurfaceSpec
} from './themeCoordinateTypes';

type SurfaceOffset = { litShift: number; satShift: number };

const SURFACE_OFFSETS: ThemeCoordinateSurfaceMap<SurfaceOffset> = {
  background: { litShift: 0, satShift: 0 },
  topbar: { litShift: -5, satShift: 2 },
  'chat-user-bubble': { litShift: -12, satShift: 6 },
  'chat-ai-bubble': { litShift: 8, satShift: -4 },
  composer: { litShift: 5, satShift: -1 },
  'system-note': { litShift: 14, satShift: -10 },
  panel: { litShift: -3, satShift: 2 },
  card: { litShift: -5, satShift: 4 }
};

export function hsl(color: BaseColor, alpha = 1) {
  return `hsla(${Math.round(color.h)} ${clamp(color.s, 0, 100).toFixed(1)}% ${clamp(color.l, 0, 100).toFixed(1)}% / ${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function adjustColor(color: BaseColor, delta: Partial<BaseColor>) {
  return {
    h: wrapHue(color.h + (delta.h ?? 0)),
    s: clamp(color.s + (delta.s ?? 0), 0, 100),
    l: clamp(color.l + (delta.l ?? 0), 0, 100)
  } satisfies BaseColor;
}

function resolveMaterialRecessedMorphology(args: {
  meaning: number;
  emotion: number;
  hueCount: number;
  seed: number;
  textureLabel: string;
}) {
  if (args.meaning < 4 || !isTactileTextureLabel(args.textureLabel)) return false;
  const roll = Math.abs(
    args.seed * 17
    + Math.round(args.meaning) * 13
    + Math.round(args.emotion) * 7
    + args.hueCount * 19
    + args.textureLabel.length * 11
  ) % 5;

  if (args.meaning >= 8) return roll <= 2;
  if (args.meaning >= 6) return roll <= 1;
  return roll === 0;
}

function transparencyStrength(surface: ThemeCoordinateSurface, meaning: number, emotion: number, textureLabel: string) {
  const abstractness = clamp((-meaning + 10) / 20, 0, 1);
  const calmness = clamp((3 - emotion) / 10, 0, 1);
  const tactile = isTactileTextureLabel(textureLabel);
  const materialBias = tactile ? 0.16 : textureLabel === 'glass' || textureLabel === 'frosted-glass' ? 1 : textureLabel === 'wash-cloud' ? 0.84 : textureLabel === 'pearlescent' ? 0.58 : 0.28;
  const surfaceBias = tactile
    ? surface === 'topbar'
      ? 0.56
      : surface === 'panel'
        ? 0.44
        : surface === 'system-note'
          ? 0.42
          : surface === 'composer'
            ? 0.34
            : surface === 'chat-ai-bubble'
              ? 0.22
              : 0.12
    : surface === 'topbar'
      ? 1.08
      : surface === 'panel'
        ? 0.9
        : surface === 'system-note'
          ? 0.86
          : surface === 'composer'
            ? 0.68
            : surface === 'chat-ai-bubble'
              ? 0.46
              : 0.16;
  return clamp(abstractness * 0.58 + calmness * 0.26 + materialBias * surfaceBias * 0.48, 0, 0.88);
}

function pickEmotionSurfaces(seed: number, emotion: number, meaning: number) {
  const expressiveWorld = emotion >= 8 && meaning <= 4;
  const pinnedSurfaces: ThemeCoordinateSurface[] = expressiveWorld ? ['background'] : [];
  const surfaces = THEME_COORDINATE_SURFACES.filter((surface) => !pinnedSurfaces.includes(surface));
  let next = (seed || 1) >>> 0;
  const random = () => {
    next += 0x6D2B79F5;
    let t = next;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = surfaces.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [surfaces[index], surfaces[swapIndex]] = [surfaces[swapIndex], surfaces[index]];
  }
  const remainingCount = Math.max(0, 3 - pinnedSurfaces.length);
  const selected = surfaces.slice(0, remainingCount);

  if (expressiveWorld && meaning <= -3 && !selected.includes('topbar') && !selected.includes('panel')) {
    selected[remainingCount - 1] = seed % 2 === 0 ? 'topbar' : 'panel';
  }

  return [...pinnedSurfaces, ...selected];
}

export function buildThemeCoordinateBoostedSurfaces(state: Pick<ThemeCoordinateState, 'seed' | 'emotion' | 'meaning'>) {
  return pickEmotionSurfaces(state.seed, state.emotion, state.meaning);
}

export function resolveThemeCoordinateSurfaceBaseColorOverride(args: {
  surface: ThemeCoordinateSurface;
  meaning: number;
  textureLabel: string;
  baseColorOverride: BaseColor | null;
}) {
  if (!args.baseColorOverride) return null;
  if (args.surface === 'background') return null;
  if (args.meaning < 4) return null;
  return isTactileTextureLabel(args.textureLabel) ? args.baseColorOverride : null;
}

export function resolveThemeCoordinateEffectiveEmotion(
  surface: ThemeCoordinateSurface,
  emotion: number,
  boostedSurfaces: ThemeCoordinateSurface[]
) {
  return boostedSurfaces.includes(surface) ? emotion : emotion * (surface === 'card' ? 0.72 : 0.15);
}

export function buildThemeCoordinateSurfaceColor(
  hue: number,
  effectiveEmotion: number,
  meaning: number,
  surface: ThemeCoordinateSurface,
  textureLabel: string,
  baseColorOverride?: BaseColor | null
) {
  const base = baseColorOverride ?? buildThemeCoordinateBaseColor(hue, effectiveEmotion, meaning);
  const offset = SURFACE_OFFSETS[surface];
  const restraint = restraintStrength(effectiveEmotion, meaning);
  const tactile = isTactileTextureLabel(textureLabel);
  const litScale = tactile
    ? surface === 'chat-ai-bubble'
      ? 0.38
      : surface === 'chat-user-bubble'
        ? 0.64
        : surface === 'composer'
          ? 0.62
          : surface === 'panel'
            ? 0.7
            : 0.82
    : 1;
  const satScale = tactile
    ? surface === 'chat-ai-bubble'
      ? 0.24
      : surface === 'chat-user-bubble'
        ? 0.62
        : 0.72
    : 1;
  const toneBias =
    meaning >= 5
      ? surface === 'background'
        ? -10
        : surface === 'panel' || surface === 'card' || surface === 'chat-user-bubble'
          ? -6
          : surface === 'topbar'
            ? -4
            : surface === 'chat-ai-bubble'
              ? -2
              : 3
      : meaning <= -5
        ? surface === 'background'
          ? 0
          : surface === 'system-note' || surface === 'composer' || surface === 'chat-ai-bubble'
            ? 9
            : surface === 'topbar'
              ? 3
              : 5
        : 0;
  const resolvedToneBias =
    baseColorOverride && meaning >= 5
      ? surface === 'panel' || surface === 'card' || surface === 'chat-user-bubble'
        ? -1.5
        : surface === 'topbar' || surface === 'chat-ai-bubble'
          ? -0.8
          : 2
      : toneBias;
  return {
    color: {
      h: base.h,
      s: clamp(base.s + offset.satShift * lerp(1, 0.38, restraint) * satScale, 5, 90),
      l: clamp(base.l + offset.litShift * litScale + resolvedToneBias + lerp(0, meaning <= 4 ? 5 : 1.5, restraint), 4, 97)
    } satisfies BaseColor
  };
}

function resolveFrameRoleStrength(surface: ThemeCoordinateSurface) {
  switch (surface) {
    case 'background':
      return 0.08;
    case 'topbar':
      return 0.18;
    case 'chat-user-bubble':
      return 0.42;
    case 'chat-ai-bubble':
      return 0.26;
    case 'composer':
      return 0.62;
    case 'system-note':
      return 0.74;
    case 'panel':
      return 0.96;
    case 'card':
      return 0.88;
    default:
      return 0.5;
  }
}

function resolveBorderStyle(args: {
  surface: ThemeCoordinateSurface;
  meaning: number;
  emotion: number;
  seed: number;
}) {
  const { surface, meaning, emotion, seed } = args;
  if (meaning <= -3) return 'solid';
  if (surface.includes('bubble') && meaning >= 4 && emotion <= 1) {
    if (seed % 5 === 0) return 'dashed';
    if (seed % 5 === 2) return 'dotted';
    return 'solid';
  }
  if (meaning < 4) {
    if (emotion >= 7 && (surface === 'composer' || surface === 'system-note')) {
      return seed % 2 === 0 ? 'dashed' : 'dotted';
    }
    return 'solid';
  }
  const frameSurfaces = surface === 'panel' || surface === 'card' || surface === 'system-note' || surface === 'composer';
  if (!frameSurfaces) {
    return emotion >= 7 && surface === 'chat-user-bubble' ? 'dashed' : 'solid';
  }
  if (emotion >= 8) return seed % 2 === 0 ? 'double' : 'dashed';
  if (emotion >= 5) return seed % 3 === 0 ? 'dotted' : 'dashed';
  return 'solid';
}

function pickOrnamentVariant(seed: number, surface: ThemeCoordinateSurface, ornamentLabel: string) {
  return (seed * 7 + surface.length * 5 + ornamentLabel.length * 3) % 4;
}

function buildOrnamentOverlay(args: {
  ornamentLabel: string;
  surface: ThemeCoordinateSurface;
  color: BaseColor;
  seed: number;
  opacityScale: number;
}) {
  const { ornamentLabel, surface, color, seed, opacityScale } = args;
  if (ornamentLabel === 'quiet') return '';

  const variant = pickOrnamentVariant(seed, surface, ornamentLabel);
  const strength =
    surface === 'background'
      ? 1
      : surface === 'topbar'
        ? 0.42
        : surface.includes('bubble')
          ? 0.3
          : 0.24;
  const glow = (alpha: number, delta: Partial<BaseColor>) =>
    hsl(adjustColor(color, delta), alpha * strength * opacityScale);

  if (ornamentLabel === 'sheen') {
    return `linear-gradient(${variant % 2 === 0 ? '115deg' : '65deg'}, ${glow(0.12, { l: 16, s: 4, h: 10 })}, transparent 34%, ${glow(0.06, { l: 8, s: -2, h: -8 })} 58%, transparent 76%)`;
  }
  if (ornamentLabel === 'grain') {
    return `repeating-linear-gradient(${variant <= 1 ? '0deg' : '90deg'}, ${glow(0.06, { l: 12, s: 2 })} 0 1px, transparent 1px ${18 + variant * 3}px)`;
  }
  if (ornamentLabel === 'prism') {
    return `conic-gradient(from ${28 + variant * 21}deg at ${28 + variant * 8}% ${22 + variant * 6}%, ${glow(0.12, { l: 18, s: 10, h: -18 })}, transparent 26%, ${glow(0.08, { l: 10, s: 6, h: 22 })} 48%, transparent 74%)`;
  }
  if (ornamentLabel === 'prism-halo') {
    return `radial-gradient(circle at ${24 + variant * 10}% ${18 + variant * 7}%, ${glow(0.14, { l: 20, s: 12, h: -20 })} 0 12%, transparent 42%), conic-gradient(from ${40 + variant * 18}deg at ${32 + variant * 8}% ${26 + variant * 6}%, ${glow(0.1, { l: 18, s: 10, h: 24 })}, transparent 28%, ${glow(0.08, { l: 10, s: 4, h: -12 })} 54%, transparent 78%)`;
  }
  if (ornamentLabel === 'dot-grid') {
    return `repeating-linear-gradient(0deg, ${glow(0.05, { l: 10, s: 4 })} 0 1px, transparent 1px ${16 + variant * 3}px), repeating-linear-gradient(90deg, ${glow(0.04, { l: 8, s: 2 })} 0 1px, transparent 1px ${20 + variant * 4}px)`;
  }
  if (ornamentLabel === 'confetti') {
    return `repeating-linear-gradient(${variant % 2 === 0 ? '135deg' : '45deg'}, ${glow(0.1, { l: 14, s: 8, h: variant % 2 === 0 ? -14 : 18 })} 0 2px, transparent 2px ${22 + variant * 4}px), radial-gradient(circle at ${68 + variant * 5}% ${24 + variant * 9}%, ${glow(0.07, { l: 18, s: 10, h: 24 })} 0 10%, transparent 34%)`;
  }
  if (ornamentLabel === 'stitched') {
    return `repeating-linear-gradient(${variant <= 1 ? '90deg' : '0deg'}, ${glow(0.09, { l: 8, s: -2 })} 0 2px, transparent 2px ${20 + variant * 4}px)`;
  }
  if (ornamentLabel === 'banded') {
    return `linear-gradient(${variant <= 1 ? '90deg' : '180deg'}, transparent 0%, ${glow(0.12, { l: 10, s: 2, h: variant <= 1 ? 8 : -8 })} ${26 + variant * 6}%, transparent ${52 + variant * 6}%, ${glow(0.08, { l: -4, s: -6 })} ${74 + variant * 4}%, transparent 100%)`;
  }

  return '';
}

function buildTextureFill(args: {
  surface: ThemeCoordinateSurface;
  color: BaseColor;
  meaning: number;
  textureLabel: string;
  ornamentLabel: string;
  gradientMode: ThemeGradientMode;
  effectiveEmotion: number;
  hueCount: number;
  seed: number;
  expressiveProminence: number;
}) {
  const { color, surface, textureLabel, ornamentLabel, gradientMode, effectiveEmotion, hueCount, seed, expressiveProminence } = args;
  const intensity = normalizeSigned(effectiveEmotion) * 0.85 + 0.15;
  const textureWeight =
    surface === 'background' ? 1 : surface === 'topbar' ? 0.14 : surface.includes('bubble') ? 0.38 : surface === 'card' ? 0.34 : 0.3;
  const textureSpan =
    surface === 'background' ? lerp(16, 26, intensity) : surface.includes('bubble') ? lerp(24, 38, intensity) : lerp(30, 48, intensity);
  const lineGap = surface === 'background' ? 12 : surface.includes('bubble') ? 18 : 24;
  const textureSoft = (alpha: number) => `rgba(255,255,255,${(alpha * textureWeight).toFixed(3)})`;
  const textureDark = (alpha: number) => `rgba(0,0,0,${(alpha * textureWeight * 0.72).toFixed(3)})`;
  const textureRestraint = restraintStrength(effectiveEmotion, args.meaning);
  const transparency = transparencyStrength(surface, args.meaning, effectiveEmotion, textureLabel);
  const tactilePaperBubble =
    surface.includes('bubble')
    && isTactileTextureLabel(textureLabel)
    && args.meaning >= 4
    && effectiveEmotion <= 1;
  const paperBubbleOpaque = tactilePaperBubble && (seed + surface.length) % 3 === 0;
  const opacityScale = clamp(
    lerp(1, surface === 'background' ? 0.94 : 0.52, transparency) + (paperBubbleOpaque ? 0.16 : 0),
    0.42,
    1
  );
  const textureTint = (alpha: number) =>
    hsl(adjustColor(color, { h: 22, s: lerp(18, 6, textureRestraint), l: 10 }), alpha * textureWeight * 0.86 * opacityScale);
  const textureAccent = (alpha: number) =>
    hsl(adjustColor(color, { h: -28, s: lerp(24, 8, textureRestraint), l: -4 }), alpha * textureWeight * 0.92 * opacityScale);
  const sheen = `linear-gradient(115deg, rgba(255,255,255,${(0.18 * opacityScale).toFixed(3)}), rgba(255,255,255,${(0.015 * opacityScale).toFixed(3)}) 34%, transparent 68%)`;
  const patternOverlay = buildTexturePatternOverlay({
    textureLabel,
    surface,
    seed,
    textureSoft,
    textureDark,
    textureTint,
    textureAccent,
    textureSpan,
    lineGap
  });
  const gradient = buildSurfaceGradient({
    surface,
    color,
    maxHueCount: hueCount,
    emotion: effectiveEmotion,
    meaning: args.meaning,
    opacityScale,
    seed,
    mode: gradientMode,
    textureLabel
  });
  const baseGradient = gradient.fill;
  const vividGradientBackground = surface === 'background' && gradient.localHueCount >= 5 && hueCount >= 7;
  const pureColorOnly = hueCount <= 1;
  const ornamentOverlay = pureColorOnly
    ? ''
    : buildOrnamentOverlay({
        ornamentLabel,
        surface,
        color,
        seed,
        opacityScale
      });
  const composeFill = (...layers: string[]) => layers.filter(Boolean).join(', ');
  const tactileBubbleVeil = paperBubbleOpaque
    ? `linear-gradient(180deg, ${hsl(adjustColor(color, { l: 10, s: -12, h: 4 }), 0.52)}, ${hsl(adjustColor(color, { l: 3, s: -16, h: -4 }), 0.36)})`
    : '';
  const expressiveHighlight =
    expressiveProminence > 0
      ? composeFill(
          `radial-gradient(circle at ${surface === 'background' ? '24% 20%' : surface === 'topbar' ? '18% 18%' : '22% 18%'}, ${hsl(adjustColor(color, { l: 26, s: -8, h: -10 }), 0.16 * expressiveProminence * opacityScale)} 0 0%, transparent 42%)`,
          `linear-gradient(${surface === 'background' ? '122deg' : '115deg'}, ${hsl(adjustColor(color, { l: 22, s: -6, h: -8 }), 0.14 * expressiveProminence * opacityScale)}, transparent 34%, ${hsl(adjustColor(color, { l: 10, s: 4, h: 18 }), 0.07 * expressiveProminence * opacityScale)} 62%, transparent 84%)`
        )
      : '';
  const resolveTextureBlur = () => {
    if (textureLabel === 'glass') return `${Math.round(lerp(18, 34, intensity))}px`;
    if (textureLabel === 'frosted-glass') return `${Math.round(lerp(10, 22, intensity))}px`;
    if (textureLabel === 'wash-cloud') return `${Math.round(lerp(4, 10, intensity * 0.8 + 0.1))}px`;
    if (textureLabel === 'candy-film') return `${Math.round(lerp(2, 8, intensity))}px`;
    return '0px';
  };
  if (pureColorOnly) {
    return {
      fill: composeFill(expressiveHighlight, baseGradient),
      blur: resolveTextureBlur(),
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  const bloomWash = gradientPaint(
    [
      hsl(adjustColor(color, { h: 22, s: lerp(18, 6, textureRestraint) + (vividGradientBackground ? 10 : 0), l: 10 }), (vividGradientBackground ? 0.34 : 0.26) * opacityScale),
      hsl(adjustColor(color, { h: -28, s: lerp(24, 8, textureRestraint) + (vividGradientBackground ? 12 : 0), l: -4 }), (vividGradientBackground ? 0.22 : 0.14) * opacityScale),
      hsl(adjustColor(color, { l: 4, s: 2, h: 42 }), 0)
    ],
    'radial'
  );
  const matteVeil = gradientPaint(
    [
      hsl(adjustColor(color, { l: -12, s: -10, h: 4 }), 0.18 * opacityScale),
      hsl(adjustColor(color, { l: -28, s: -18, h: -6 }), 0.34 * opacityScale)
    ],
    surface === 'background' ? 'diagonal' : 'vertical'
  );
  const mattePool = `radial-gradient(circle at ${surface === 'background' ? '18% 16%' : '24% 20%'}, ${hsl(adjustColor(color, { l: -18, s: -10, h: 6 }), 0.22 * opacityScale)} 0 0%, transparent 54%)`;
  if (textureLabel === 'glass') {
    return {
      fill: composeFill(vividGradientBackground ? '' : sheen, expressiveHighlight, ornamentOverlay, baseGradient),
      blur: `${Math.round(lerp(18, 34, intensity))}px`,
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'frosted-glass') {
    return {
      fill: composeFill(
        vividGradientBackground ? '' : sheen,
        expressiveHighlight,
        ornamentOverlay,
        `radial-gradient(circle at 14% 18%, rgba(255,255,255,${((vividGradientBackground ? 0.1 : 0.22) * opacityScale).toFixed(3)}), transparent 26%)`,
        baseGradient
      ),
      blur: `${Math.round(lerp(10, 22, intensity))}px`,
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'wash-cloud') {
    return {
      fill: composeFill(
        expressiveHighlight,
        `radial-gradient(circle at 18% 16%, ${textureSoft((vividGradientBackground ? 0.12 : 0.2) * opacityScale)} 0 18%, transparent 54%)`,
        `radial-gradient(circle at 74% 22%, ${textureSoft((vividGradientBackground ? 0.1 : 0.16) * opacityScale)} 0 16%, transparent 52%)`,
        `radial-gradient(circle at 52% 78%, ${textureSoft((vividGradientBackground ? 0.08 : 0.12) * opacityScale)} 0 14%, transparent 48%)`,
        ornamentOverlay,
        bloomWash,
        baseGradient
      ),
      blur: `${Math.round(lerp(4, 10, intensity * 0.8 + 0.1))}px`,
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'candy-film') {
    return {
      fill: composeFill(
        expressiveHighlight,
        `linear-gradient(115deg, ${textureSoft(0.24 * opacityScale)}, rgba(255,255,255,${(0.015 * opacityScale).toFixed(3)}) 26%, transparent 48%)`,
        ornamentOverlay,
        patternOverlay,
        baseGradient
      ),
      blur: `${Math.round(lerp(2, 8, intensity))}px`,
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'paper') {
    return {
      fill: composeFill(tactileBubbleVeil, ornamentOverlay, patternOverlay, baseGradient),
      blur: '0px',
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'paper-fiber') {
    return {
      fill: composeFill(
        tactileBubbleVeil,
        expressiveHighlight,
        ornamentOverlay,
        patternOverlay,
        `repeating-radial-gradient(circle at 18% 22%, ${textureSoft(0.05 * opacityScale)} 0 1px, transparent 1px ${Math.round(textureSpan * 1.2)}px)`,
        baseGradient
      ),
      blur: '0px',
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'fabric') {
    return {
      fill: composeFill(tactileBubbleVeil, ornamentOverlay, patternOverlay, baseGradient),
      blur: '0px',
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }
  if (textureLabel === 'leather') {
    return {
      fill: composeFill(
        mattePool,
        matteVeil,
        expressiveHighlight,
        ornamentOverlay,
        patternOverlay || `linear-gradient(180deg, ${textureDark(0.1)}, transparent 58%)`,
        baseGradient
      ),
      blur: '0px',
      localHueCount: gradient.localHueCount,
      gradientLabel: gradient.label
    };
  }

  const quietSheen = `linear-gradient(115deg, ${textureSoft(0.08 * opacityScale)}, transparent 34%)`;
  const defaultOverlay =
    patternOverlay
      ? patternOverlay
      : surface === 'background'
        ? quietSheen
        : surface === 'topbar'
          ? `linear-gradient(115deg, ${textureSoft(0.05 * opacityScale)}, transparent 28%)`
          : '';

  return {
    fill: composeFill(tactileBubbleVeil, expressiveHighlight, defaultOverlay, ornamentOverlay, baseGradient),
    blur: '0px',
    localHueCount: gradient.localHueCount,
    gradientLabel: gradient.label
  };
}

export function buildThemeCoordinateSurfaceSpec(args: {
  surface: ThemeCoordinateSurface;
  styleFamily: ThemeCoordinateStyleFamily;
  hue: number;
  hueCount: number;
  emotion: number;
  meaning: number;
  requestedEmotion: number;
  requestedMeaning: number;
  seed: number;
  boostedSurfaces: ThemeCoordinateSurface[];
  airyBubbleSeparation: number;
  baseColorOverride: BaseColor | null;
}): ThemeCoordinateSurfaceSpec {
  const { surface, styleFamily, hue, meaning, seed, boostedSurfaces } = args;
  const effectiveEmotion = resolveThemeCoordinateEffectiveEmotion(surface, args.emotion, boostedSurfaces);
  const semanticMeaning = args.requestedMeaning;
  const semanticEmotion =
    semanticMeaning < 0
      ? args.requestedEmotion
      : resolveThemeCoordinateEffectiveEmotion(surface, args.requestedEmotion, boostedSurfaces);
  const resolvedTextureLabel = resolveSurfaceTextureLabel({
    surface,
    meaning: semanticMeaning,
    emotion: semanticEmotion,
    seed
  });
  const flowerMistMetal =
    args.requestedMeaning <= -4
    && args.requestedEmotion >= 5
    && surface !== 'background';
  const baseTextureLabel =
    flowerMistMetal && (resolvedTextureLabel === 'pearlescent' || resolvedTextureLabel === 'candy-film')
      ? (surface === 'topbar' || surface === 'panel' || surface === 'card' ? 'frosted-glass' : 'wash-cloud')
      : resolvedTextureLabel;
  const textureLabel = resolveThemeCoordinateFamilyTextureLabel({
    family: styleFamily,
    surface,
    baseTextureLabel,
    seed
  });
  const airyBubble = surface === 'chat-user-bubble' || surface === 'chat-ai-bubble';
  const airySeparation = airyBubble ? args.airyBubbleSeparation : 0;
  const expressiveProminence = resolveExpressiveAiryProminence({
    surface,
    requestedEmotion: args.requestedEmotion,
    requestedMeaning: args.requestedMeaning,
    boostedSurfaces
  });
  const surfaceBaseColorOverride = resolveThemeCoordinateSurfaceBaseColorOverride({
    surface,
    meaning: args.requestedMeaning,
    textureLabel,
    baseColorOverride: args.baseColorOverride
  });
  const baseSurfaceColor = adjustColor(
    buildThemeCoordinateSurfaceColor(
    hue,
    effectiveEmotion,
    meaning,
    surface,
    textureLabel,
    surfaceBaseColorOverride
    ).color,
    resolveThemeCoordinateFamilyColorDelta({
      family: styleFamily,
      surface
    })
  );
  const color = airySeparation > 0
    ? adjustColor(
        baseSurfaceColor,
        surface === 'chat-user-bubble'
          ? {
              l: lerp(-1.5, -10, airySeparation),
              s: lerp(0.5, 5, airySeparation),
              h: lerp(-2, -8, airySeparation)
            }
          : {
              l: lerp(1.5, 9, airySeparation),
              s: lerp(-1, -6, airySeparation),
              h: lerp(1, 8, airySeparation)
            }
      )
    : baseSurfaceColor;
  const softenedFlowerMistBubbleColor =
    flowerMistMetal && airyBubble
      ? adjustColor(
          color,
          surface === 'chat-user-bubble'
            ? { l: 16, s: -40, h: -2 }
            : { l: 6, s: -16, h: 1 }
        )
      : color;
  const gradientMode = resolveGradientMode(hue, args.emotion, meaning, seed, surface);
  const edgeLabel = resolveSurfaceEdgeLabel({
    surface,
    meaning: semanticMeaning,
    emotion: semanticEmotion,
    seed
  });
  const resolvedOrnamentLabel = resolveSurfaceOrnamentLabel({
    surface,
    meaning: semanticMeaning,
    emotion: semanticEmotion,
    seed
  });
  const ornamentLabel =
    flowerMistMetal && (resolvedOrnamentLabel === 'prism-halo' || resolvedOrnamentLabel === 'prism' || resolvedOrnamentLabel === 'confetti')
      ? 'sheen'
      : resolvedOrnamentLabel;
  const texture = buildTextureFill({
    surface,
    color: softenedFlowerMistBubbleColor,
    meaning,
    textureLabel,
    ornamentLabel,
    gradientMode,
    effectiveEmotion,
    hueCount: flowerMistMetal && (surface === 'chat-user-bubble' || surface === 'chat-ai-bubble') ? 1 : args.hueCount,
    seed,
    expressiveProminence
  });
  const emphasis = normalizeSigned(effectiveEmotion);
  const restraint = restraintStrength(effectiveEmotion, meaning);
  const framePresence = normalizeSigned(meaning);
  const abstractness = normalizeSigned(-meaning);
  const frameRole = resolveFrameRoleStrength(surface);
  const borderWidthBase = lerp(0.12, meaning > 4 ? 3.6 : 3.15, emphasis);
  const abstractFrameDamping =
    meaning <= -3
      ? surface === 'background'
        ? 0.38
        : surface === 'topbar'
          ? 0.54
          : surface === 'chat-ai-bubble'
            ? 0.68
            : 0.82
      : 1;
  const borderWidth =
    borderWidthBase
    * lerp(0.18, 1.14, framePresence * lerp(0.42, 1, frameRole))
    * lerp(0.72, 1.24, frameRole)
    * abstractFrameDamping
    * (flowerMistMetal ? lerp(0.36, 0.68, frameRole) : 1)
    * (airyBubble ? lerp(1, 1.48, airySeparation) : 1)
    * (surface === 'topbar' ? lerp(0.22, 0.42, framePresence) : 1);
  const borderStyle = resolveBorderStyle({ surface, meaning, emotion: effectiveEmotion, seed });
  const borderPaint =
    flowerMistMetal
      ? `linear-gradient(132deg, ${hsl(adjustColor(color, { l: 24, s: 22, h: -26 }), 0.94)}, ${hsl(adjustColor(color, { l: 10, s: 10, h: 14 }), 0.88)} 34%, ${hsl(adjustColor(color, { l: -2, s: 18, h: 42 }), 0.9)} 68%, ${hsl(adjustColor(color, { l: -12, s: -2, h: -10 }), 0.82)})`
      : meaning <= -3
        ? `linear-gradient(180deg, ${hsl(adjustColor(color, { l: 18, s: -6, h: -8 }), lerp(0.12, 0.28, abstractness))}, ${hsl(adjustColor(color, { l: 4, s: -10, h: 8 }), lerp(0.08, 0.22, abstractness))})`
        : effectiveEmotion >= 4
          ? gradientPaint(
              [
                hsl(adjustColor(color, { l: edgeLabel.includes('mist') ? 22 : 18, s: 12, h: -10 }), 0.88),
                ...(texture.localHueCount >= 3
                  ? [hsl(adjustColor(color, { l: 4, s: lerp(18, 6, restraint), h: lerp(18, 112, (texture.localHueCount - 1) / 6) * lerp(1, 0.5, restraint) }), 0.9)]
                  : []),
                hsl(adjustColor(color, { l: edgeLabel.includes('solid') ? -14 : -8, s: lerp(12, 4, restraint), h: texture.localHueCount >= 2 ? lerp(24, 132, (texture.localHueCount - 1) / 6) * lerp(1, 0.52, restraint) : 18 }), 0.94)
              ],
              gradientMode
            )
          : `linear-gradient(180deg, ${hsl(adjustColor(color, { l: 12, s: -6 }), 0.42)}, ${hsl(adjustColor(color, { l: -6, s: -2 }), 0.28)})`;
  const tactileTextSurface = isTactileTextureLabel(textureLabel);
  const lightTextField = softenedFlowerMistBubbleColor.l > 52;
  const inkHue = wrapHue(softenedFlowerMistBubbleColor.h + (lightTextField
    ? (meaning <= 0 ? -6 : 8)
    : (meaning <= 0 ? -8 : 10)));
  const textTone = hsl(
    {
      h: inkHue,
      s: tactileTextSurface ? (lightTextField ? 7 : 9) : (lightTextField ? 9 : 11),
      l: lightTextField
        ? (softenedFlowerMistBubbleColor.l > 72 ? 15 : 19)
        : (tactileTextSurface ? 90 : 92)
    },
    lightTextField ? 0.96 : 0.95
  );
  const mutedTone = hsl(
    {
      h: inkHue,
      s: tactileTextSurface ? (lightTextField ? 9 : 12) : (lightTextField ? 11 : 14),
      l: lightTextField
        ? (softenedFlowerMistBubbleColor.l > 72 ? 31 : 37)
        : (tactileTextSurface ? 78 : 82)
    },
    lightTextField ? 0.74 : 0.78
  );
  const accentTone = hsl(adjustColor(color, { l: color.l > 70 ? -26 : 18, s: 16, h: 18 }), 0.96);
  const materialRecessedPlane =
    resolveMaterialRecessedMorphology({
      meaning,
      emotion: effectiveEmotion,
      hueCount: args.hueCount,
      seed,
      textureLabel
    })
    && (surface === 'card' || surface.includes('bubble'));
  const radiusBase =
    surface === 'background'
      ? 0
      : surface === 'topbar'
        ? 28
        : surface === 'chat-user-bubble'
          ? 24
          : surface === 'chat-ai-bubble'
            ? 20
            : surface === 'composer'
              ? 26
              : surface === 'system-note'
                ? 18
                : surface === 'panel'
                  ? 26
                  : 28;
  const radiusDelta =
    edgeLabel.includes('mist')
      ? lerp(8, 22, normalizeSigned(-meaning))
      : edgeLabel.includes('solid')
        ? lerp(-10, 4, normalizeSigned(-meaning))
        : lerp(-2, 12, normalizeSigned(-meaning));
  const radius = `${Math.max(surface === 'background' ? 0 : 8, Math.round(radiusBase + radiusDelta - (materialRecessedPlane ? 3 : 0)))}px`;
  const shadowBlur = surface === 'topbar'
    ? lerp(8, 20, emphasis * 0.76)
    : meaning < -2
      ? lerp(22, 54, emphasis)
      : lerp(8, 24, emphasis) * lerp(0.94, 0.76, framePresence);
  const liftedShadowBlur = shadowBlur * lerp(1, surface === 'background' ? 1.12 : 1.08, expressiveProminence);
  const shadowLift = surface === 'topbar'
    ? lerp(0, 7, emphasis * 0.72)
    : meaning < 2
      ? lerp(6, 22, emphasis)
      : lerp(3, 10, emphasis) * lerp(1.1, 0.72, framePresence);
  const liftedShadowLift = shadowLift * lerp(1, surface === 'background' ? 1.16 : 1.1, expressiveProminence);
  const shadowColor = hsl(
    adjustColor(softenedFlowerMistBubbleColor, { l: ornamentLabel.includes('prism') ? -20 : -26, s: ornamentLabel.includes('prism') ? 10 : 2 }),
    surface === 'topbar'
      ? lerp(meaning < 0 ? 0.1 : 0.12, 0.16, expressiveProminence)
      : meaning < 0
        ? lerp(lerp(0.18, 0.28, airySeparation), 0.3, expressiveProminence)
        : lerp(0.2, 0.24, expressiveProminence)
  );
  const insetColor = hsl(adjustColor(softenedFlowerMistBubbleColor, { l: 18, s: 4 }), lerp(0.08, 0.22, framePresence));
  const padding = `${Math.round(lerp(10, 18, emphasis) + borderWidth * lerp(0.9, 1.6, frameRole))}px`;
  const letterSpacing = `${lerp(0, 0.04, emphasis).toFixed(3)}em`;
  const lineHeight = lerp(1.45, 1.7, emphasis).toFixed(2);
  const shadow = materialRecessedPlane
    ? [
        `inset 0 1px 0 ${hsl(adjustColor(softenedFlowerMistBubbleColor, { l: 10, s: -4, h: 4 }), 0.1)}`,
        `inset 0 -1px 0 ${hsl(adjustColor(softenedFlowerMistBubbleColor, { l: -10, s: -8, h: -2 }), 0.08)}`,
        `inset -7px -7px 14px -12px ${hsl(adjustColor(softenedFlowerMistBubbleColor, { l: 14, s: -6, h: 6 }), 0.08)}`,
        `inset 8px 8px 16px -12px ${hsl(adjustColor(softenedFlowerMistBubbleColor, { l: -14, s: -10, h: -4 }), 0.08)}`,
        `0 1px 2px ${hsl(adjustColor(softenedFlowerMistBubbleColor, { l: -16, s: -8, h: -4 }), 0.04)}`
      ].join(', ')
    : `0 ${liftedShadowLift.toFixed(1)}px ${liftedShadowBlur.toFixed(1)}px ${shadowColor}, inset 0 1px 0 ${insetColor}`;
  return {
    styleFamily,
    fill: texture.fill,
    borderPaint,
    borderWidth: `${borderWidth.toFixed(2)}px`,
    borderStyle,
    radius,
    shadow,
    text: textTone,
    muted: mutedTone,
    accent: accentTone,
    blur: texture.blur,
    padding,
    lineHeight,
    letterSpacing,
    textureLabel,
    edgeLabel,
    ornamentLabel,
    gradientLabel: texture.gradientLabel
  };
}
