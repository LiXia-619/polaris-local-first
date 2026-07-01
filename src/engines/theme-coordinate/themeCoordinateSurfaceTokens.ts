import type { ThemeToolScope } from '../../types/domain';
import { buildThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import {
  INITIAL_THEME_COORDINATE_STATE,
  decodeLatestThemeCoordinateState,
  normalizeThemeCoordinateSurfaceRefs
} from './themeCoordinateStableAction';
import {
  THEME_COORDINATE_SURFACE_CODE,
  THEME_COORDINATE_SURFACE_LABEL,
  THEME_COORDINATE_SURFACE_PREFIX,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';
import { buildScopedVariableRules, buildSurfaceRules } from './themeCoordinateStableSurfaceRules';
import { gradientPaint } from './themeCoordinateGradient';
import type { ThemeCoordinateGeneratedPatch } from './themeCoordinateGeneratedPatch';

export const SURFACE_TOKEN_TEXTURES = [
  'none',
  'glass',
  'frosted-glass',
  'pearlescent',
  'wash-cloud',
  'paper',
  'linen',
  'noise'
] as const;

export const SURFACE_TOKEN_GRADIENT_MODES = ['none', 'linear', 'radial', 'sweep'] as const;

type SurfaceTokenTexture = typeof SURFACE_TOKEN_TEXTURES[number];
type SurfaceTokenGradientMode = typeof SURFACE_TOKEN_GRADIENT_MODES[number];

export type ThemeCoordinateSurfaceTokenSpec = {
  hue: number;
  saturation: number;
  lightness: number;
  opacity: number;
  radius: number;
  borderW: number;
  blur: number;
  shadowDepth: number;
  texture: SurfaceTokenTexture;
  gradientMode: SurfaceTokenGradientMode;
  gradientAngle: number;
  accentHue: number;
};

export type ThemeCoordinateFocusedSurfaceSnapshot = {
  surfaceCode: string;
  surfaceLabel: string;
  currentSpec: ThemeCoordinateSurfaceTokenSpec;
};

export type ThemeCoordinateSurfaceTokenInput = {
  surface: string;
  spell: string;
  hue?: number;
  saturation?: number;
  lightness?: number;
  opacity?: number;
  radius?: number;
  borderW?: number;
  blur?: number;
  shadowDepth?: number;
  texture?: string;
  gradientMode?: string;
  gradientAngle?: number;
  accentHue?: number;
  label?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function surfaceScope(surface: ThemeCoordinateSurface): ThemeToolScope {
  switch (surface) {
    case 'chat-user-bubble':
    case 'chat-ai-bubble':
    case 'composer':
    case 'system-note':
      return 'chat';
    case 'card':
      return 'collection';
    default:
      return 'app';
  }
}

function layerIdForSurface(surface: ThemeCoordinateSurface) {
  return `stable:${surface}`;
}

function formatHsla(hue: number, saturation: number, lightness: number, alpha = 1) {
  return `hsla(${Math.round(hue)} ${clamp(saturation, 0, 100)}% ${clamp(lightness, 0, 100)}% / ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function parseFirstHsl(text: string) {
  const match = text.match(/hsla?\(([-\d.]+)\s+([-\d.]+)%\s+([-\d.]+)%\s*(?:\/\s*([-\d.]+))?\)/i);
  if (!match) return null;
  return {
    hue: Math.round(Number(match[1])),
    saturation: Math.round(Number(match[2])),
    lightness: Math.round(Number(match[3])),
    alpha: match[4] != null ? Number(match[4]) : 1
  };
}

function parseRepresentativeHsl(text: string) {
  const matches = Array.from(
    text.matchAll(/hsla?\(([-\d.]+)\s+([-\d.]+)%\s+([-\d.]+)%\s*(?:\/\s*([-\d.]+))?\)/gi)
  );
  if (matches.length === 0) return null;

  const parsed = matches.map((match, index) => ({
    hue: Math.round(Number(match[1])),
    saturation: Math.round(Number(match[2])),
    lightness: Math.round(Number(match[3])),
    alpha: match[4] != null ? Number(match[4]) : 1,
    index
  }));

  parsed.sort((left, right) => {
    if (right.alpha !== left.alpha) return right.alpha - left.alpha;
    return right.index - left.index;
  });

  const winner = parsed[0]!;
  return {
    hue: winner.hue,
    saturation: winner.saturation,
    lightness: winner.lightness,
    alpha: winner.alpha
  };
}

function parseGradientMode(fill: string): SurfaceTokenGradientMode {
  if (fill.includes('conic-gradient')) return 'sweep';
  if (fill.includes('radial-gradient')) return 'radial';
  if (fill.includes('linear-gradient')) return 'linear';
  return 'none';
}

function parseGradientAngle(fill: string) {
  const match = fill.match(/linear-gradient\(([-\d.]+)deg/i);
  return match ? clamp(Math.round(Number(match[1])), 0, 360) : 135;
}

function mapTextureLabel(textureLabel: string): SurfaceTokenTexture {
  switch (textureLabel) {
    case 'glass':
    case 'frosted-glass':
    case 'pearlescent':
    case 'wash-cloud':
    case 'paper':
    case 'linen':
      return textureLabel;
    case 'paper-fiber':
    case 'washi-paper':
      return 'paper';
    case 'powder-dust':
      return 'noise';
    default:
      return 'none';
  }
}

function normalizeSurfaceTokenTexture(texture?: string): SurfaceTokenTexture | undefined {
  if (!texture) return undefined;
  return SURFACE_TOKEN_TEXTURES.find((value) => value === texture) ?? undefined;
}

function normalizeSurfaceTokenGradientMode(mode?: string): SurfaceTokenGradientMode | undefined {
  if (!mode) return undefined;
  return SURFACE_TOKEN_GRADIENT_MODES.find((value) => value === mode) ?? undefined;
}

function deriveShadowDepth(shadow: string) {
  if (!shadow || shadow === 'none') return 0;
  const match = shadow.match(/0\s+[-\d.]+px\s+([-\d.]+)px/i);
  const blur = match ? Number(match[1]) : 0;
  if (blur >= 34) return 5;
  if (blur >= 24) return 4;
  if (blur >= 12) return 3;
  if (blur >= 6) return 2;
  return 1;
}

function parsePx(value: string, fallback = 0) {
  const match = value.match(/(-?\d+(?:\.\d+)?)px/i);
  return match ? Math.round(Number(match[1])) : fallback;
}

function textureOverlay(args: {
  texture: SurfaceTokenTexture;
  hue: number;
  saturation: number;
  lightness: number;
  opacity: number;
}) {
  const { texture, hue, saturation, lightness, opacity } = args;
  const alpha = clamp(opacity / 100, 0, 1);
  const soft = (a: number) => formatHsla(hue, saturation, clamp(lightness + 14, 0, 100), a * alpha);
  const accent = (a: number) => formatHsla(hue + 24, clamp(saturation + 6, 0, 100), clamp(lightness - 8, 0, 100), a * alpha);
  switch (texture) {
    case 'glass':
      return `linear-gradient(115deg, ${soft(0.22)}, ${soft(0.04)} 32%, transparent 68%)`;
    case 'frosted-glass':
      return `radial-gradient(circle at 16% 18%, ${soft(0.18)} 0 18%, transparent 54%)`;
    case 'pearlescent':
      return `linear-gradient(125deg, ${soft(0.2)}, ${accent(0.08)} 52%, transparent 84%)`;
    case 'wash-cloud':
      return `radial-gradient(circle at 20% 18%, ${soft(0.14)} 0 18%, transparent 56%), radial-gradient(circle at 78% 24%, ${soft(0.1)} 0 16%, transparent 48%)`;
    case 'paper':
      return `repeating-radial-gradient(circle at 18% 24%, ${soft(0.08)} 0 1px, transparent 1px 18px)`;
    case 'linen':
      return `repeating-linear-gradient(90deg, ${soft(0.06)} 0 2px, transparent 2px 12px), repeating-linear-gradient(180deg, ${soft(0.05)} 0 1px, transparent 1px 10px)`;
    case 'noise':
      return `repeating-radial-gradient(circle at 16% 24%, ${accent(0.06)} 0 1px, transparent 1px 12px)`;
    default:
      return '';
  }
}

function buildSurfaceFill(spec: ThemeCoordinateSurfaceTokenSpec) {
  const base = formatHsla(spec.hue, spec.saturation, spec.lightness, spec.opacity / 100);
  const accent = formatHsla(spec.accentHue, clamp(spec.saturation + 8, 0, 100), clamp(spec.lightness - 8, 18, 72), spec.opacity / 100);
  const gradient =
    spec.gradientMode === 'none'
      ? base
      : spec.gradientMode === 'linear'
        ? `linear-gradient(${clamp(spec.gradientAngle, 0, 360)}deg, ${accent}, ${base})`
        : spec.gradientMode === 'radial'
          ? gradientPaint([accent, base], 'radial')
          : `conic-gradient(from ${spec.gradientAngle}deg, ${accent}, ${base})`;
  const overlay = textureOverlay(spec);
  return overlay ? `${overlay}, ${gradient}` : gradient;
}

function shadowDepthValue(depth: number) {
  switch (depth) {
    case 1: return '0 1px 3px rgba(0,0,0,0.06)';
    case 2: return '0 2px 6px rgba(0,0,0,0.10)';
    case 3: return '0 4px 12px rgba(0,0,0,0.12)';
    case 4: return '0 8px 24px rgba(0,0,0,0.14)';
    case 5: return '0 12px 36px rgba(0,0,0,0.18)';
    default: return 'none';
  }
}

function resolveSurfaceTokenDefaults(surface: ThemeCoordinateSurface, beforeGeneratedCss?: string) {
  const state = decodeLatestThemeCoordinateState(beforeGeneratedCss) ?? INITIAL_THEME_COORDINATE_STATE;
  const preview = buildThemeCoordinatePreview(state);
  const surfaceSpec = preview.surfaceSpecs[surface];
  const fillColor = parseRepresentativeHsl(surfaceSpec.fill) ?? parseFirstHsl(surfaceSpec.fill) ?? {
    hue: state.hue,
    saturation: 36,
    lightness: 56,
    alpha: 1
  };
  const accentColor = parseFirstHsl(surfaceSpec.accent) ?? {
    hue: (state.hue + 30) % 360,
    saturation: fillColor.saturation,
    lightness: clamp(fillColor.lightness - 10, 20, 60),
    alpha: 1
  };

  return {
    preview,
    surfaceSpec,
    defaults: {
      hue: clamp(fillColor.hue, 0, 360),
      saturation: clamp(fillColor.saturation, 0, 100),
      lightness: clamp(fillColor.lightness, 0, 100),
      opacity: clamp(Math.round(fillColor.alpha * 100), 0, 100),
      radius: clamp(parsePx(surfaceSpec.radius, 18), 0, 48),
      borderW: clamp(parsePx(surfaceSpec.borderWidth, 0), 0, 8),
      blur: clamp(parsePx(surfaceSpec.blur, 0), 0, 40),
      shadowDepth: clamp(deriveShadowDepth(surfaceSpec.shadow), 0, 5),
      texture: mapTextureLabel(surfaceSpec.textureLabel),
      gradientMode: parseGradientMode(surfaceSpec.fill),
      gradientAngle: parseGradientAngle(surfaceSpec.fill),
      accentHue: clamp(accentColor.hue, 0, 360)
    } satisfies ThemeCoordinateSurfaceTokenSpec
  };
}

function overridePreviewForSurface(args: {
  preview: ReturnType<typeof buildThemeCoordinatePreview>;
  surface: ThemeCoordinateSurface;
  tokens: ThemeCoordinateSurfaceTokenSpec;
}) {
  const { preview, surface, tokens } = args;
  const currentSpec = preview.surfaceSpecs[surface];
  const fill = buildSurfaceFill(tokens);
  const accent = formatHsla(
    tokens.accentHue,
    clamp(tokens.saturation + 8, 0, 100),
    clamp(tokens.lightness - 10, 20, 60),
    0.96
  );
  const text = tokens.lightness >= 72
    ? '#243142'
    : tokens.lightness >= 56
      ? '#223247'
      : 'rgba(255,255,255,0.92)';
  const muted = tokens.lightness >= 56 ? 'rgba(41,57,74,0.66)' : 'rgba(255,255,255,0.72)';
  const shadow = shadowDepthValue(tokens.shadowDepth);
  const borderPaint =
    tokens.borderW > 0
      ? gradientPaint(
          [
            formatHsla(tokens.accentHue, clamp(tokens.saturation + 8, 0, 100), clamp(tokens.lightness + 8, 0, 100), 0.86),
            formatHsla(tokens.hue, clamp(tokens.saturation - 8, 0, 100), clamp(tokens.lightness - 12, 0, 100), 0.32)
          ],
          'diagonal'
        )
      : 'linear-gradient(180deg, transparent, transparent)';

  const surfaceSpec = {
    ...currentSpec,
    fill,
    borderPaint,
    borderWidth: `${tokens.borderW}px`,
    borderStyle: 'solid',
    radius: `${tokens.radius}px`,
    shadow,
    text,
    muted,
    accent,
    blur: `${tokens.blur}px`,
    textureLabel: tokens.texture,
    gradientLabel: tokens.gradientMode === 'none' ? currentSpec.gradientLabel : tokens.gradientMode
  };

  const styleVars = {
    ...preview.styleVars,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-fill`]: surfaceSpec.fill,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-border-paint`]: surfaceSpec.borderPaint,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-border-width`]: surfaceSpec.borderWidth,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-border-style`]: surfaceSpec.borderStyle,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-radius`]: surfaceSpec.radius,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-shadow`]: surfaceSpec.shadow,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-text`]: surfaceSpec.text,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-muted`]: surfaceSpec.muted,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-accent`]: surfaceSpec.accent,
    [`--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-blur`]: surfaceSpec.blur
  };

  if (surface === 'background') {
    styleVars['--bg'] = surfaceSpec.fill;
    styleVars['--text'] = surfaceSpec.text;
  }
  if (surface === 'chat-user-bubble') {
    styleVars['--bubble-user'] = surfaceSpec.fill;
    styleVars['--shadow-bubble'] = surfaceSpec.shadow;
  }
  if (surface === 'panel') {
    styleVars['--shadow-panel'] = surfaceSpec.shadow;
    styleVars['--radius-panel'] = surfaceSpec.radius;
  }
  if (surface === 'card') {
    styleVars['--collection-card-shadow'] = surfaceSpec.shadow;
    styleVars['--collection-card-text-soft'] = surfaceSpec.text;
    styleVars['--collection-card-border'] = surfaceSpec.accent;
    styleVars['--collection-card-border-hover'] = surfaceSpec.accent;
    styleVars['--collection-card-surface'] = surfaceSpec.fill;
    styleVars['--collection-card-background'] = surfaceSpec.fill;
  }

  return {
    ...preview,
    styleVars,
    surfaceSpecs: {
      ...preview.surfaceSpecs,
      [surface]: surfaceSpec
    }
  };
}

function surfaceFromCodeOrAlias(input: string) {
  return normalizeThemeCoordinateSurfaceRefs([input])[0] ?? null;
}

export function normalizeThemeCoordinateSurfaceCode(input: string) {
  const surface = surfaceFromCodeOrAlias(input);
  return surface ? THEME_COORDINATE_SURFACE_CODE[surface] : null;
}

export function themeCoordinateSurfaceFromCode(input: string) {
  return surfaceFromCodeOrAlias(input);
}

export function buildThemeCoordinateFocusedSurfaceSnapshot(args: {
  surfaceCode: string;
  beforeGeneratedCss?: string;
}): ThemeCoordinateFocusedSurfaceSnapshot | null {
  const surface = themeCoordinateSurfaceFromCode(args.surfaceCode);
  if (!surface) return null;
  const { defaults } = resolveSurfaceTokenDefaults(surface, args.beforeGeneratedCss);
  return {
    surfaceCode: THEME_COORDINATE_SURFACE_CODE[surface],
    surfaceLabel: THEME_COORDINATE_SURFACE_LABEL[surface],
    currentSpec: defaults
  };
}

export function buildThemeCoordinateSurfaceTokenPatch(args: {
  action: ThemeCoordinateSurfaceTokenInput;
  beforeGeneratedCss?: string;
}) {
  const surface = themeCoordinateSurfaceFromCode(args.action.surface);
  if (!surface) {
    throw new Error(`Unknown surface: ${args.action.surface}`);
  }

  const { preview, defaults } = resolveSurfaceTokenDefaults(surface, args.beforeGeneratedCss);
  const tokens: ThemeCoordinateSurfaceTokenSpec = {
    ...defaults,
    hue: args.action.hue ?? defaults.hue,
    saturation: args.action.saturation ?? defaults.saturation,
    lightness: args.action.lightness ?? defaults.lightness,
    opacity: args.action.opacity ?? defaults.opacity,
    radius: args.action.radius ?? defaults.radius,
    borderW: args.action.borderW ?? defaults.borderW,
    blur: args.action.blur ?? defaults.blur,
    shadowDepth: args.action.shadowDepth ?? defaults.shadowDepth,
    texture: normalizeSurfaceTokenTexture(args.action.texture) ?? defaults.texture,
    gradientMode: normalizeSurfaceTokenGradientMode(args.action.gradientMode) ?? defaults.gradientMode,
    gradientAngle: args.action.gradientAngle ?? defaults.gradientAngle,
    accentHue: args.action.accentHue ?? defaults.accentHue
  };
  const nextPreview = overridePreviewForSurface({
    preview,
    surface,
    tokens
  });
  const scope = surfaceScope(surface);
  const cssText = [
    buildScopedVariableRules(scope, nextPreview, [surface]).join('\n'),
    buildSurfaceRules(scope, nextPreview, [surface])
  ].filter(Boolean).join('\n');
  const generatedPatch: ThemeCoordinateGeneratedPatch = {
    layers: [{
      layerId: layerIdForSurface(surface),
      cssText
    }]
  };

  return {
    surface,
    surfaceCode: THEME_COORDINATE_SURFACE_CODE[surface],
    surfaceLabel: THEME_COORDINATE_SURFACE_LABEL[surface],
    currentSpec: defaults,
    generatedPatch,
    label: args.action.label?.trim() || `${THEME_COORDINATE_SURFACE_LABEL[surface]} · ${args.action.spell}`
  };
}
