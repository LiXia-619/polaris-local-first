import type { AssistantToolAction } from './assistantToolProtocolTypes';
import {
  SURFACE_TOKEN_GRADIENT_MODES,
  SURFACE_TOKEN_TEXTURES,
  normalizeThemeCoordinateSurfaceCode
} from '../theme-coordinate/themeCoordinateSurfaceTokens';
import { normalizeStableThemeTargets } from './assistantToolProtocolThemeTargets';

export const SURFACE_TOKEN_ACTION_KIND = 'applySurfaceTokens' as const;

export const SURFACE_TOKEN_KEY_ALIASES = {
  borderwidth: 'borderW',
  border_width: 'borderW',
  borderw: 'borderW',
  shadowdepth: 'shadowDepth',
  shadow_depth: 'shadowDepth',
  gradientmode: 'gradientMode',
  gradient_mode: 'gradientMode',
  gradientangle: 'gradientAngle',
  gradient_angle: 'gradientAngle',
  accenthue: 'accentHue',
  accent_hue: 'accentHue'
} as const;

export const SURFACE_TOKEN_ACTION_KIND_ALIASES = {
  applysurfacetokens: SURFACE_TOKEN_ACTION_KIND,
  surfacetokens: SURFACE_TOKEN_ACTION_KIND,
  setsurfacetokens: SURFACE_TOKEN_ACTION_KIND
} as const;

export const SURFACE_TOKEN_MISSING_SURFACE_ISSUE = 'applySurfaceTokens 需要给出目标区域编号或别名。';
export const SURFACE_TOKEN_MULTI_TARGET_ISSUE = 'applySurfaceTokens 只接受 1 个目标编号。多个编号或 all 都应该改用 applyThemeCoordinates。';
export const SURFACE_TOKEN_MISSING_SPELL_ISSUE = 'applySurfaceTokens 至少需要给出 spell。';

type SurfaceTokenAction = Extract<AssistantToolAction, { kind: typeof SURFACE_TOKEN_ACTION_KIND }>;

type SurfaceTokenParseResult =
  | { action: SurfaceTokenAction; issue?: undefined }
  | { action: null; issue: string };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeLabel(action: Record<string, unknown>) {
  return typeof action.label === 'string'
    ? action.label.trim() || undefined
    : typeof action.targetLabel === 'string'
      ? action.targetLabel.trim() || undefined
      : undefined;
}

function normalizeSpell(action: Record<string, unknown>) {
  if (typeof action.spell !== 'string') return '';
  return action.spell
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

function normalizeEnumValue<T extends readonly string[]>(value: unknown, options: T) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === normalized);
}

export function hasSurfaceTokenFields(action: Record<string, unknown>) {
  return (
    typeof action.spell === 'string'
    && (
      typeof action.surface === 'string'
      || action.targets != null
      || action.target != null
    )
  );
}

export function parseSurfaceTokenAction(action: Record<string, unknown>): SurfaceTokenParseResult {
  const normalizedTargets = normalizeStableThemeTargets(action.targets ?? action.target);
  if (normalizedTargets === 'all' || (Array.isArray(normalizedTargets) && normalizedTargets.length > 1)) {
    return { action: null, issue: SURFACE_TOKEN_MULTI_TARGET_ISSUE };
  }

  const surface = Array.isArray(normalizedTargets) && normalizedTargets.length === 1
    ? normalizedTargets[0]
    : typeof action.surface === 'string'
      ? normalizeThemeCoordinateSurfaceCode(action.surface)
      : null;
  if (!surface) {
    return { action: null, issue: SURFACE_TOKEN_MISSING_SURFACE_ISSUE };
  }

  const spell = normalizeSpell(action);
  if (!spell) {
    return { action: null, issue: SURFACE_TOKEN_MISSING_SPELL_ISSUE };
  }

  const hue = normalizeFiniteNumber(action.hue);
  const saturation = normalizeFiniteNumber(action.saturation);
  const lightness = normalizeFiniteNumber(action.lightness);
  const opacity = normalizeFiniteNumber(action.opacity);
  const radius = normalizeFiniteNumber(action.radius);
  const borderW = normalizeFiniteNumber(action.borderW);
  const blur = normalizeFiniteNumber(action.blur);
  const shadowDepth = normalizeFiniteNumber(action.shadowDepth);
  const gradientAngle = normalizeFiniteNumber(action.gradientAngle);
  const accentHue = normalizeFiniteNumber(action.accentHue);
  const texture = normalizeEnumValue(action.texture, SURFACE_TOKEN_TEXTURES);
  const gradientMode = normalizeEnumValue(action.gradientMode, SURFACE_TOKEN_GRADIENT_MODES);

  return {
    action: {
      kind: SURFACE_TOKEN_ACTION_KIND,
      targets: [surface],
      surface,
      spell,
      hue: hue == null ? undefined : clamp(Math.round(hue), 0, 360),
      saturation: saturation == null ? undefined : clamp(Math.round(saturation), 0, 100),
      lightness: lightness == null ? undefined : clamp(Math.round(lightness), 0, 100),
      opacity: opacity == null ? undefined : clamp(Math.round(opacity), 0, 100),
      radius: radius == null ? undefined : clamp(Math.round(radius), 0, 48),
      borderW: borderW == null ? undefined : clamp(Math.round(borderW), 0, 8),
      blur: blur == null ? undefined : clamp(Math.round(blur), 0, 40),
      shadowDepth: shadowDepth == null ? undefined : clamp(Math.round(shadowDepth), 0, 5),
      texture,
      gradientMode,
      gradientAngle: gradientAngle == null ? undefined : clamp(Math.round(gradientAngle), 0, 360),
      accentHue: accentHue == null ? undefined : clamp(Math.round(accentHue), 0, 360),
      label: normalizeLabel(action)
    }
  };
}
