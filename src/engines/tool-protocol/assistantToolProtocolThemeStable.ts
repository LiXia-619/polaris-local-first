import type { AssistantToolAction } from './assistantToolProtocolTypes';
import { normalizeStableThemeTargets } from './assistantToolProtocolThemeTargets';
import { normalizeThemeCoordinateBaseColor } from '../theme-coordinate/themeCoordinateBaseColor';

export const STABLE_THEME_ACTION_KIND = 'applyThemeCoordinates' as const;

export const STABLE_THEME_KEY_ALIASES = {
  huecount: 'hueCount',
  hue_count: 'hueCount'
} as const;

export const STABLE_THEME_ACTION_KIND_ALIASES = {
  applythemecoordinates: STABLE_THEME_ACTION_KIND,
  themecoordinates: STABLE_THEME_ACTION_KIND,
  setthemecoordinates: STABLE_THEME_ACTION_KIND
} as const;

export const STABLE_THEME_REJECTION_ISSUE = '这次换肤走的是系统编译路径，只接受 applyThemeCoordinates 或 applySurfaceTokens 这两种结构化动作。';
export const STABLE_THEME_RAW_CSS_ISSUE = '这次换肤走的是系统编译路径，AI 不能直接写整页 CSS。要手写样式时，切到创意模式后用 appendThemeCss / editThemeCss / replaceThemeCss。';
export const STABLE_THEME_MISSING_AXES_ISSUE = 'applyThemeCoordinates 需要同时给出 hue、hueCount、emotion、meaning 四个数字。';
export const STABLE_THEME_MISSING_TARGETS_ISSUE = '系统编译路径需要先写 targets。整页写 all；多个编号一起改也先写 targets。';
export const STABLE_THEME_SINGLE_TARGET_ISSUE = 'targets 只有 1 个编号时，改用 applySurfaceTokens，不要继续写 applyThemeCoordinates。';
export const STABLE_THEME_INVALID_BASE_COLOR_ISSUE = 'baseColor 需要写十六进制色值，比如 #f3b7c8。';

type StableThemeAction = Extract<AssistantToolAction, { kind: typeof STABLE_THEME_ACTION_KIND }>;

type StableThemeParseResult =
  | { action: StableThemeAction; issue?: undefined }
  | { action: null; issue: string };

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

export function hasStableThemeCoordinateFields(action: Record<string, unknown>) {
  return (
    typeof action.hue === 'number'
    && Number.isFinite(action.hue)
    && typeof action.hueCount === 'number'
    && Number.isFinite(action.hueCount)
    && typeof action.emotion === 'number'
    && Number.isFinite(action.emotion)
    && typeof action.meaning === 'number'
    && Number.isFinite(action.meaning)
  );
}

export function parseStableThemeToolAction(action: Record<string, unknown>): StableThemeParseResult {
  const rawTargets = action.targets ?? action.target;
  const normalizedTargets = rawTargets == null ? 'all' : normalizeStableThemeTargets(rawTargets);
  const hue = normalizeFiniteNumber(action.hue);
  const hueCount = normalizeFiniteNumber(action.hueCount);
  const emotion = normalizeFiniteNumber(action.emotion);
  const meaning = normalizeFiniteNumber(action.meaning);
  const seed = normalizeFiniteNumber(action.seed);
  const rawBaseColor = action.baseColor;
  const baseColor = normalizeThemeCoordinateBaseColor(rawBaseColor);
  if (rawTargets != null && !normalizedTargets) {
    return { action: null, issue: STABLE_THEME_MISSING_TARGETS_ISSUE };
  }
  if (rawBaseColor != null && !baseColor) {
    return { action: null, issue: STABLE_THEME_INVALID_BASE_COLOR_ISSUE };
  }
  if (Array.isArray(normalizedTargets) && normalizedTargets.length === 1) {
    return { action: null, issue: STABLE_THEME_SINGLE_TARGET_ISSUE };
  }
  if (hue == null || hueCount == null || emotion == null || meaning == null) {
    return { action: null, issue: STABLE_THEME_MISSING_AXES_ISSUE };
  }
  const targets = normalizedTargets ?? 'all';

  return {
    action: {
      kind: STABLE_THEME_ACTION_KIND,
      targets,
      hue,
      hueCount,
      emotion,
      meaning,
      baseColor,
      seed: seed ?? undefined,
      label: normalizeLabel(action)
    }
  };
}
