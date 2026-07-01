import type { ThemeToolScope } from '../../types/domain';
import type { ThemeCoordinateGeneratedPatch } from './themeCoordinateGeneratedPatch';
import { buildThemeCoordinatePreview, THEME_COORDINATE_SURFACES, type ThemeCoordinateState } from './themeCoordinateSpaceMapping';
import { mergeThemeCoordinatePreview } from './themeCoordinateSelection';
import {
  buildStableThemeFallbackTargets,
  decodeLatestThemeCoordinateState,
  encodeThemeCoordinateMetaComment,
  encodeThemeCoordinateStateComment,
  INITIAL_THEME_COORDINATE_STATE,
  nextStableThemeSeed,
  normalizeStableThemeRequestedState,
  normalizeThemeCoordinateSurfaceRefs
} from './themeCoordinateStableAction';
import { buildScopedVariableRules, buildSurfaceRules } from './themeCoordinateStableSurfaceRules';

const GLOBAL_SCOPE: ThemeToolScope = 'app';
const GLOBAL_LAYER_IDS = {
  background: 'stable:background',
  topbar: 'stable:topbar',
  'chat-user-bubble': 'stable:chat-user-bubble',
  'chat-ai-bubble': 'stable:chat-ai-bubble',
  composer: 'stable:composer',
  'system-note': 'stable:system-note',
  panel: 'stable:panel',
  card: 'stable:card'
} as const;

function clampHue(value: number) {
  return Math.round(((value % 360) + 360) % 360);
}

function clampHueCount(value: number) {
  return Math.min(9, Math.max(1, Math.round(value)));
}

function clampAxis(value: number) {
  return Math.min(10, Math.max(-10, value));
}

function normalizeState(args: {
  requestedState: Partial<Record<'hue' | 'hueCount' | 'emotion' | 'meaning' | 'baseColor', unknown>>;
  beforeGeneratedCss?: string;
  seed?: number;
}) {
  const requestedState = normalizeStableThemeRequestedState(args.requestedState);
  const seed =
    typeof args.seed === 'number' && Number.isFinite(args.seed)
      ? Math.max(1, Math.round(args.seed))
      : nextStableThemeSeed({
          beforeGeneratedCss: args.beforeGeneratedCss
        });

  return {
    ...INITIAL_THEME_COORDINATE_STATE,
    hue: clampHue(requestedState.hue ?? INITIAL_THEME_COORDINATE_STATE.hue),
    hueCount: clampHueCount(requestedState.hueCount ?? INITIAL_THEME_COORDINATE_STATE.hueCount),
    emotion: clampAxis(requestedState.emotion ?? INITIAL_THEME_COORDINATE_STATE.emotion),
    meaning: clampAxis(requestedState.meaning ?? INITIAL_THEME_COORDINATE_STATE.meaning),
    seed,
    baseColor: requestedState.baseColor
  } satisfies ThemeCoordinateState;
}

export function buildThemeCoordinateGlobalTheme(args: {
  targets?: string[] | 'all';
  hue: number;
  hueCount: number;
  emotion: number;
  meaning: number;
  beforeGeneratedCss?: string;
  seed?: number;
  label?: string;
  baseColor?: string;
}) {
  const state = normalizeState({
    requestedState: {
      hue: args.hue,
      hueCount: args.hueCount,
      emotion: args.emotion,
      meaning: args.meaning,
      baseColor: args.baseColor
    },
    beforeGeneratedCss: args.beforeGeneratedCss,
    seed: args.seed
  });
  const requestedTargets =
    args.targets === 'all'
      ? buildStableThemeFallbackTargets(GLOBAL_SCOPE)
      : normalizeThemeCoordinateSurfaceRefs(args.targets);
  const targets = requestedTargets.length > 0 ? requestedTargets : [...THEME_COORDINATE_SURFACES];
  const activePreview = buildThemeCoordinatePreview(state);
  const baselineState = decodeLatestThemeCoordinateState(args.beforeGeneratedCss) ?? INITIAL_THEME_COORDINATE_STATE;
  const baselinePreview = buildThemeCoordinatePreview(baselineState);
  const preview =
    targets.length === THEME_COORDINATE_SURFACES.length
      ? activePreview
      : mergeThemeCoordinatePreview({
          baselinePreview,
          activePreview,
          selectedSurfaces: targets
        });
  const variableRules = buildScopedVariableRules(GLOBAL_SCOPE, preview, targets).join('\n');
  const generatedPatch: ThemeCoordinateGeneratedPatch = {
    comments: [
      encodeThemeCoordinateStateComment(state),
      encodeThemeCoordinateMetaComment({
        version: 2,
        scope: GLOBAL_SCOPE,
        targets,
        preserve: [],
        requestedState: {
          hue: state.hue,
          hueCount: state.hueCount,
          emotion: state.emotion,
          meaning: state.meaning,
          ...(state.baseColor ? { baseColor: state.baseColor } : {})
        },
        forcedTraits: {},
        state,
        label: args.label?.trim() || undefined
      })
    ],
    layers: targets.map((surface) => {
      const cssText = [
        surface === 'background' ? variableRules : '',
        buildSurfaceRules(GLOBAL_SCOPE, preview, [surface])
      ].filter(Boolean).join('\n');
      return {
        layerId: GLOBAL_LAYER_IDS[surface],
        cssText
      };
    })
  };
  return {
    state,
    preview,
    generatedPatch
  };
}
