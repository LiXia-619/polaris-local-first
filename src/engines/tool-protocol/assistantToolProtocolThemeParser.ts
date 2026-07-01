import type {
  ThemeToolMode
} from '../../types/domain';
import { getThemePresetById } from '../../config/theme/themePresets';
import { normalizeStringArray, asObject } from './assistantToolProtocolShared';
import {
  parseStableThemeToolAction,
  STABLE_THEME_RAW_CSS_ISSUE,
  STABLE_THEME_REJECTION_ISSUE
} from './assistantToolProtocolThemeStable';
import { parseSurfaceTokenAction } from './assistantToolProtocolThemeSurfaceTokens';
import type { AssistantToolAction } from './assistantToolProtocolTypes';

export type ThemeParseActionResult =
  | { action: AssistantToolAction; issue?: undefined }
  | { action: null; issue?: string };

const THEME_MODE_OFF_ISSUE = '当前没有“换肤”能力。';

function normalizeCssText(action: Record<string, unknown>) {
  return typeof action.css === 'string'
    ? action.css.trim()
    : typeof action.cssText === 'string'
      ? action.cssText.trim()
      : normalizeStringArray(action.cssLines).join('\n').trim();
}

function normalizeLabel(action: Record<string, unknown>) {
  return typeof action.label === 'string'
    ? action.label.trim() || undefined
    : typeof action.targetLabel === 'string'
      ? action.targetLabel.trim() || undefined
      : undefined;
}


export function parseThemeToolAction(
  value: unknown,
  _contentHint?: string,
  themeToolMode: ThemeToolMode = 'stable'
): ThemeParseActionResult | null {
  const action = asObject(value);
  if (!action || typeof action.kind !== 'string') {
    return null;
  }

  switch (action.kind) {
    case 'applyThemeCoordinates':
    case 'themeCoordinates':
    case 'setThemeCoordinates': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'stable') {
        return { action: null, issue: '当前是创意模式，不接受坐标稳态动作。要自由改界面时请按 theme.css 文件流：新增用 appendThemeCss，替换已有片段用 editThemeCss，整套重做用 replaceThemeCss。' };
      }
      return parseStableThemeToolAction(action);
    }
    case 'applySurfaceTokens':
    case 'surfaceTokens':
    case 'setSurfaceTokens': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'stable') {
        return { action: null, issue: '当前是创意模式，不接受稳定单点 token 动作。要自由改界面时请按 theme.css 文件流：新增用 appendThemeCss，替换已有片段用 editThemeCss，整套重做用 replaceThemeCss。' };
      }
      return parseSurfaceTokenAction(action);
    }
    case 'patchRawCss':
    case 'appendThemeCss':
    case 'patchThemeCss': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: STABLE_THEME_RAW_CSS_ISSUE };
      }
      const css = normalizeCssText(action);
      if (!css) {
        return { action: null, issue: `${action.kind} 缺少完整 CSS。` };
      }
      if (action.kind === 'appendThemeCss') {
        return {
          action: {
            kind: 'appendThemeCss',
            css,
            layer: action.layer === 'custom' || action.layer === 'generated' ? action.layer : undefined,
            label: normalizeLabel(action)
          }
        };
      }
      return {
        action: {
          kind: 'patchRawCss',
          css,
          label: normalizeLabel(action)
        }
      };
    }
    case 'readThemeCss': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: 'readThemeCss 只在创意模式可用。稳定模式请继续用编号和 token。' };
      }
      return {
        action: {
          kind: 'readThemeCss',
          targetLabel: normalizeLabel(action)
        }
      };
    }
    case 'editThemeCss': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: 'editThemeCss 只在创意模式可用。稳定模式请继续用编号和 token。' };
      }
      const oldString = typeof action.oldString === 'string' ? action.oldString : '';
      const newString = typeof action.newString === 'string' ? action.newString : undefined;
      const layer = action.layer === 'custom' || action.layer === 'generated' ? action.layer : undefined;
      if (!oldString) {
        return { action: null, issue: 'editThemeCss 缺少 oldString。' };
      }
      if (newString === undefined) {
        return { action: null, issue: 'editThemeCss 缺少 newString。' };
      }
      return {
        action: {
          kind: 'editThemeCss',
          oldString,
          newString,
          layer,
          label: normalizeLabel(action)
        }
      };
    }
    case 'insertThemeCss': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: 'insertThemeCss 只在创意模式可用。稳定模式请继续用编号和 token。' };
      }
      const anchorString = typeof action.anchorString === 'string' ? action.anchorString : '';
      const css = normalizeCssText(action);
      const layer = action.layer === 'custom' || action.layer === 'generated' ? action.layer : undefined;
      const position = action.position === 'before' || action.position === 'after' ? action.position : undefined;
      if (!anchorString) {
        return { action: null, issue: 'insertThemeCss 缺少 anchorString。' };
      }
      if (!css) {
        return { action: null, issue: 'insertThemeCss 缺少 CSS。' };
      }
      return {
        action: {
          kind: 'insertThemeCss',
          anchorString,
          css,
          position,
          layer,
          label: normalizeLabel(action)
        }
      };
    }
    case 'deleteThemeCss': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: 'deleteThemeCss 只在创意模式可用。稳定模式请继续用编号和 token。' };
      }
      const oldString = typeof action.oldString === 'string' ? action.oldString : '';
      const layer = action.layer === 'custom' || action.layer === 'generated' ? action.layer : undefined;
      if (!oldString) {
        return { action: null, issue: 'deleteThemeCss 缺少 oldString。' };
      }
      return {
        action: {
          kind: 'deleteThemeCss',
          oldString,
          layer,
          label: normalizeLabel(action)
        }
      };
    }
    case 'replaceThemeCss': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: 'replaceThemeCss 只在创意模式可用。稳定模式请继续用编号和 token。' };
      }
      const css = normalizeCssText(action);
      if (!css) {
        return { action: null, issue: 'replaceThemeCss 缺少完整 CSS。' };
      }
      return {
        action: {
          kind: 'replaceThemeCss',
          css,
          label: normalizeLabel(action)
        }
      };
    }
    case 'inspectThemeRender': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode !== 'creative') {
        return { action: null, issue: 'inspectThemeRender 只在创意模式可用。稳定模式请继续用编号和 token。' };
      }
      return {
        action: {
          kind: 'inspectThemeRender',
          targetLabel: normalizeLabel(action)
        }
      };
    }
    case 'applyPreset':
    case 'applyThemePreset': {
      if (themeToolMode === 'off') {
        return { action: null, issue: THEME_MODE_OFF_ISSUE };
      }
      if (themeToolMode === 'stable') {
        return { action: null, issue: STABLE_THEME_REJECTION_ISSUE };
      }
      const presetId = typeof action.presetId === 'string' ? action.presetId.trim() : '';
      if (!presetId) {
        return { action: null, issue: 'applyPreset 缺少 presetId。' };
      }
      if (!getThemePresetById(presetId)) {
        return { action: null, issue: `没有找到名为“${presetId}”的预设。` };
      }
      return { action: { kind: 'applyPreset', presetId } };
    }
    default:
      return null;
  }
}
