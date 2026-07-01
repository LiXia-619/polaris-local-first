import { findThemeSurfaceEntryByRef } from '../../config/theme/themeSurfaceRegistry';
import type { ThemeToolScope } from '../../types/domain';
import {
  THEME_COORDINATE_SURFACES,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';
import type { ThemeCoordinateState } from './themeCoordinateSpaceLayout';
import type { ThemeCoordinateTraitKey } from './themeCoordinateTraits';
import { normalizeThemeCoordinateTargetRefs } from './themeCoordinateTargetRef';
import { normalizeThemeCoordinateBaseColor } from './themeCoordinateBaseColor';

export const INITIAL_THEME_COORDINATE_STATE: ThemeCoordinateState = {
  hue: 28,
  hueCount: 2,
  emotion: 2,
  meaning: -1,
  seed: 1
};

const STATE_MARKER = 'polaris-stable-theme-state:';
const META_MARKER = 'polaris-stable-theme-meta:';

export type ThemeCoordinateStableRequestedState = Partial<Pick<ThemeCoordinateState, 'hue' | 'hueCount' | 'emotion' | 'meaning' | 'baseColor'>>;

export type ThemeCoordinateStableTraitBinding = {
  target: string;
  key: ThemeCoordinateTraitKey;
};

export type ThemeCoordinateStableMeta = {
  version: 1 | 2;
  scope: ThemeToolScope;
  targets: ThemeCoordinateSurface[];
  targetRefs?: string[];
  preserve: ThemeCoordinateSurface[];
  requestedState?: ThemeCoordinateStableRequestedState;
  traitBindings?: ThemeCoordinateStableTraitBinding[];
  forcedTraits: Partial<Record<ThemeCoordinateSurface, string>>;
  state: ThemeCoordinateState;
  label?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildMarkerPattern(marker: string) {
  return new RegExp(`\\/\\*\\s*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\{[\\s\\S]*?\\})\\s*\\*\\/`, 'g');
}

function normalizeSurfaceRef(value: string): ThemeCoordinateSurface | null {
  const entry = findThemeSurfaceEntryByRef(value);
  return entry?.surface ?? null;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function normalizeThemeCoordinateSurfaceRefs(values?: string[]) {
  return unique((values ?? []).map(normalizeSurfaceRef).filter((value): value is ThemeCoordinateSurface => Boolean(value)));
}

export function buildStableThemeFallbackTargets(scope: ThemeToolScope): ThemeCoordinateSurface[] {
  switch (scope) {
    case 'collection':
      return ['background', 'topbar', 'panel', 'card'];
    case 'chat':
      return ['background', 'topbar', 'chat-user-bubble', 'chat-ai-bubble', 'composer', 'system-note', 'panel'];
    default:
      return [...THEME_COORDINATE_SURFACES];
  }
}

export function normalizeStableThemeRequestedState(
  input?: Partial<Record<'hue' | 'hueCount' | 'emotion' | 'meaning' | 'baseColor', unknown>>
): ThemeCoordinateStableRequestedState {
  const state: ThemeCoordinateStableRequestedState = {};
  if (typeof input?.hue === 'number' && Number.isFinite(input.hue)) {
    state.hue = Math.round(input.hue);
  }
  if (typeof input?.hueCount === 'number' && Number.isFinite(input.hueCount)) {
    state.hueCount = clamp(Math.round(input.hueCount), 1, 9);
  }
  if (typeof input?.emotion === 'number' && Number.isFinite(input.emotion)) {
    state.emotion = clamp(input.emotion, -10, 10);
  }
  if (typeof input?.meaning === 'number' && Number.isFinite(input.meaning)) {
    state.meaning = clamp(input.meaning, -10, 10);
  }
  const baseColor = normalizeThemeCoordinateBaseColor(input?.baseColor);
  if (baseColor) {
    state.baseColor = baseColor;
  }
  return state;
}

export function normalizeStableThemeTraitBindings(
  traits?: Array<{ target: string; key: ThemeCoordinateTraitKey }>
) {
  const bindings: ThemeCoordinateStableTraitBinding[] = [];
  const seen = new Set<string>();
  for (const trait of traits ?? []) {
    const target = trait.target.trim();
    if (!target) continue;
    const refs = normalizeThemeCoordinateTargetRefs([target]);
    for (const ref of refs) {
      const key = `${ref.surface}:${trait.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bindings.push({ target: ref.part ? `${ref.surface}.${ref.part}` : ref.surface, key: trait.key });
    }
  }
  return bindings;
}

export function nextStableThemeSeed(args: {
  beforeGeneratedCss?: string;
}) {
  return decodeLatestThemeCoordinateState(args.beforeGeneratedCss)?.seed ?? INITIAL_THEME_COORDINATE_STATE.seed;
}

export function encodeThemeCoordinateStateComment(state: ThemeCoordinateState) {
  const baseColor = normalizeThemeCoordinateBaseColor(state.baseColor);
  const normalizedState = {
    hue: Math.round(((state.hue % 360) + 360) % 360),
    hueCount: clamp(Math.round(state.hueCount), 1, 9),
    emotion: clamp(Math.round(state.emotion), -10, 10),
    meaning: clamp(Math.round(state.meaning), -10, 10),
    seed: Math.max(1, Math.round(state.seed || 1)),
    ...(baseColor ? { baseColor } : {})
  } satisfies ThemeCoordinateState;
  return `/* ${STATE_MARKER}${JSON.stringify(normalizedState)} */`;
}

export function encodeThemeCoordinateMetaComment(meta: ThemeCoordinateStableMeta) {
  return `/* ${META_MARKER}${JSON.stringify(meta)} */`;
}

export function decodeLatestThemeCoordinateMeta(cssText?: string): ThemeCoordinateStableMeta | null {
  if (!cssText?.trim()) return null;
  const pattern = buildMarkerPattern(META_MARKER);
  let match: RegExpExecArray | null = null;
  let parsed: ThemeCoordinateStableMeta | null = null;
  while ((match = pattern.exec(cssText))) {
    try {
      const payload = JSON.parse(match[1]) as Partial<ThemeCoordinateStableMeta>;
      if (
        (payload.version === 1 || payload.version === 2)
        && typeof payload.scope === 'string'
        && Array.isArray(payload.targets)
        && Array.isArray(payload.preserve)
        && payload.state != null
      ) {
        parsed = payload as ThemeCoordinateStableMeta;
      }
    } catch {
      // ignore malformed embedded metadata
    }
  }
  return parsed;
}

export function decodeLatestThemeCoordinateState(cssText?: string): ThemeCoordinateState | null {
  const metaState = decodeLatestThemeCoordinateMeta(cssText)?.state;
  if (metaState) return metaState;
  if (!cssText?.trim()) return null;
  const pattern = buildMarkerPattern(STATE_MARKER);
  let match: RegExpExecArray | null = null;
  let parsed: ThemeCoordinateState | null = null;
  while ((match = pattern.exec(cssText))) {
    try {
      const payload = JSON.parse(match[1]) as Partial<ThemeCoordinateState>;
      if (
        typeof payload.hue === 'number'
        && typeof payload.hueCount === 'number'
        && typeof payload.emotion === 'number'
        && typeof payload.meaning === 'number'
        && typeof payload.seed === 'number'
      ) {
        const baseColor = normalizeThemeCoordinateBaseColor(payload.baseColor);
        parsed = {
          hue: payload.hue,
          hueCount: payload.hueCount,
          emotion: payload.emotion,
          meaning: payload.meaning,
          seed: payload.seed,
          ...(baseColor ? { baseColor } : {})
        };
      }
    } catch {
      // ignore malformed embedded metadata
    }
  }
  return parsed;
}
