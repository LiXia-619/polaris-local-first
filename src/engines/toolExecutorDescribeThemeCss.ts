import { getThemePresetById } from '../config/theme/themePresets';
import { findThemeSurfaceEntryBySurface } from '../config/theme/themeSurfaceRegistry';
import { findSelectorEntryForCssSelector, resolveSelectorScope } from '../config/theme/themeSelectorCatalog';
import {
  THEME_COORDINATE_SURFACE_LABEL,
  THEME_COORDINATE_SURFACE_CODE,
  THEME_COORDINATE_SURFACES
} from './theme-coordinate/themeCoordinateSurfaceMeta';
import { buildThemeCoordinateFocusedSurfaceSnapshot, themeCoordinateSurfaceFromCode } from './theme-coordinate/themeCoordinateSurfaceTokens';
import { readSimpleCssRules } from './themeCssRuleMerge';
import type { ThemeToolScope } from '../types/domain';
import type { ToolAction } from './toolExecutorTypes';
import type { ToolActionDescription } from './toolExecutorDescribe';

export type ThemeCssToolAction = Extract<
  ToolAction,
  {
    kind:
      | 'applyThemeCoordinates'
      | 'applySurfaceTokens'
      | 'patchRawCss'
      | 'readThemeCss'
      | 'editThemeCss'
      | 'appendThemeCss'
      | 'insertThemeCss'
      | 'deleteThemeCss'
      | 'replaceThemeCss'
      | 'inspectThemeRender'
      | 'applyPreset';
  }
>;

/**
 * Natural-language descriptions for the theme / CSS tool actions (coordinate skinning, surface
 * tokens, raw-CSS patches, theme.css edits, preset apply, render inspection). This is the highest
 * slice because the returned object carries the theme PREVIEW metadata (themeScope, surfaceIds,
 * surfaceLabels, patchMode, transactionReason, intentLabel) that the skin-preview consumes — so it
 * is moved verbatim. It is still **description only**: the real CSS files, themeCssFile, themeToolState,
 * preview/apply/rollback, the tool parser and the selector registry are untouched. The central
 * `describeToolAction` dispatcher delegates these kinds here.
 */
function inferStableThemeScope(targetSurfaces: Array<(typeof THEME_COORDINATE_SURFACES)[number]>): ThemeToolScope {
  if (targetSurfaces.length === 0) return 'app';
  const chatOnly = new Set(['chat-user-bubble', 'chat-ai-bubble', 'composer', 'system-note']);
  if (targetSurfaces.every((surface) => chatOnly.has(surface))) {
    return 'chat';
  }
  return 'app';
}

function splitCssSelectorList(selectorText: string) {
  const selectors: string[] = [];
  let current = '';
  let parenDepth = 0;
  let cursor = 0;

  while (cursor < selectorText.length) {
    const char = selectorText[cursor];
    if (char === '"' || char === '\'') {
      const quote = char;
      current += char;
      cursor += 1;
      while (cursor < selectorText.length) {
        current += selectorText[cursor];
        if (selectorText[cursor] === '\\') {
          cursor += 1;
          if (cursor < selectorText.length) current += selectorText[cursor];
        } else if (selectorText[cursor] === quote) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === ',' && parenDepth === 0) {
      if (current.trim()) selectors.push(current.trim());
      current = '';
      cursor += 1;
      continue;
    }
    current += char;
    cursor += 1;
  }

  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

function summarizeRawCssThemeTargets(css: string): {
  scope: ThemeToolScope;
  surfaceIds: string[];
  surfaceLabels: string[];
} {
  const rules = readSimpleCssRules(css) ?? [];
  const entries = rules
    .flatMap((rule) => rule.selector.trim().startsWith('@') ? [] : splitCssSelectorList(rule.selector))
    .map((selector) => findSelectorEntryForCssSelector(selector))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const surfaceIds = Array.from(new Set(entries.map((entry) => entry.alias)));
  const surfaceLabels = Array.from(new Set(entries.map((entry) => entry.name)));
  const scopes = Array.from(new Set(entries.map((entry) => resolveSelectorScope(entry.alias))));
  const scope =
    scopes.length === 1 && (scopes[0] === 'chat' || scopes[0] === 'collection')
      ? scopes[0]
      : 'app';

  return {
    scope,
    surfaceIds,
    surfaceLabels
  };
}

export function describeThemeCssToolAction(action: ThemeCssToolAction): ToolActionDescription {
  switch (action.kind) {
    case 'applyThemeCoordinates': {
      const targetSurfaces =
        action.targets === 'all'
          ? [...THEME_COORDINATE_SURFACES]
          : action.targets
              .map((code) => themeCoordinateSurfaceFromCode(code))
              .filter((surface): surface is NonNullable<typeof surface> => Boolean(surface));
      const targetSummary =
        action.targets === 'all'
          ? '整页'
          : targetSurfaces
              .map((surface) => THEME_COORDINATE_SURFACE_LABEL[surface])
              .join('、');
      return {
        kind: action.kind,
        title: '整体坐标换肤试穿',
        summary: `${action.label?.trim() || targetSummary || '整体方向'} · hue ${Math.round(action.hue)} · 色数 ${Math.round(action.hueCount)} · 情绪 ${action.emotion} · 材质 ${action.meaning}${action.baseColor ? ` · 底色 ${action.baseColor}` : ''}`,
        themeScope: action.targets === 'all' ? 'app' : inferStableThemeScope(targetSurfaces),
        themeSurfaceIds: targetSurfaces.map((surface) => findThemeSurfaceEntryBySurface(surface)?.id ?? surface),
        themeSurfaceLabels: targetSurfaces.map((surface) => THEME_COORDINATE_SURFACE_LABEL[surface]),
        themePatchMode: 'replace',
        themeTransactionReason:
          action.targets === 'all'
            ? '按四轴坐标生成整页预览，再编译成真实壳子 CSS。'
            : '按四轴坐标围绕当前聚焦区域生成一版试穿，再只改这些表面的稳定层。',
        themeIntentLabel: action.label?.trim() || '整体坐标换肤',
        targetLabel: action.label?.trim() || targetSummary || '整页整体'
      };
    }
    case 'applySurfaceTokens': {
      const surface = themeCoordinateSurfaceFromCode(action.surface);
      const snapshot = buildThemeCoordinateFocusedSurfaceSnapshot({ surfaceCode: action.surface });
      const label = action.label?.trim()
        || (surface ? `${THEME_COORDINATE_SURFACE_LABEL[surface]} · ${action.spell}` : action.spell);
      return {
        kind: action.kind,
        title: '单区域精修试穿',
        summary: `${label} · ${action.surface}${snapshot ? ` · hue ${snapshot.currentSpec.hue}` : ''}`,
        themeScope:
          surface === 'card'
            ? 'collection'
            : surface === 'chat-user-bubble' || surface === 'chat-ai-bubble' || surface === 'composer' || surface === 'system-note'
              ? 'chat'
              : 'app',
        themeSurfaceIds: surface ? [findThemeSurfaceEntryBySurface(surface)?.id ?? surface] : [`surface:${action.surface}`],
        themeSurfaceLabels: surface ? [THEME_COORDINATE_SURFACE_LABEL[surface]] : [action.surface],
        themePatchMode: 'merge',
        themeTransactionReason: `按结构化 token 精修 ${surface ? THEME_COORDINATE_SURFACE_CODE[surface] : action.surface} 区域，并进入试穿。`,
        themeIntentLabel: action.spell,
        targetLabel: surface ? THEME_COORDINATE_SURFACE_LABEL[surface] : action.surface
      };
    }
    case 'patchRawCss': {
      const targetLabel = action.label?.trim() || '整页重做';
      const rawCssTargets = summarizeRawCssThemeTargets(action.css);
      const targetSummary = rawCssTargets.surfaceLabels.length > 0
        ? rawCssTargets.surfaceLabels.slice(0, 4).join('、')
        : '直接 CSS';
      return {
        kind: action.kind,
        title: '创意 CSS 试穿',
        summary: `${targetLabel} · ${targetSummary} · ${action.css.trim().slice(0, 120).replace(/\s+/g, ' ')}`,
        themeScope: rawCssTargets.scope,
        themeSurfaceIds: rawCssTargets.surfaceIds,
        themeSurfaceLabels: rawCssTargets.surfaceLabels,
        themePatchMode: 'merge',
        themeTransactionReason: '直接写一层真实 CSS，并进入试穿。',
        targetLabel
      };
    }
    case 'readThemeCss':
      return {
        kind: action.kind,
        title: '已读取 theme.css',
        summary: '读取当前虚拟主题文件',
        targetLabel: action.targetLabel
      };
    case 'editThemeCss':
      return {
        kind: action.kind,
        title: '主题 CSS 精修试穿',
        summary: `${action.label?.trim() || action.layer || 'theme.css'} · 替换 ${action.oldString.length} 字为 ${action.newString.length} 字`,
        themeScope: 'app',
        themePatchMode: 'merge',
        themeTransactionReason: '按 oldString/newString 精确修改当前虚拟 theme.css，并进入试穿。',
        themeIntentLabel: action.label?.trim() || '主题 CSS 精修',
        targetLabel: action.label?.trim() || action.layer || 'theme.css'
      };
    case 'appendThemeCss': {
      const rawCssTargets = summarizeRawCssThemeTargets(action.css);
      return {
        kind: action.kind,
        title: '主题 CSS 追加试穿',
        summary: `${action.label?.trim() || action.layer || 'generated'} · 追加 ${action.css.trim().length} 字 CSS`,
        themeScope: rawCssTargets.scope,
        themeSurfaceIds: rawCssTargets.surfaceIds,
        themeSurfaceLabels: rawCssTargets.surfaceLabels,
        themePatchMode: 'merge',
        themeTransactionReason: '向当前虚拟 theme.css 的可写层追加新 CSS，并进入试穿。',
        themeIntentLabel: action.label?.trim() || '主题 CSS 追加',
        targetLabel: action.label?.trim() || action.layer || 'theme.css'
      };
    }
    case 'insertThemeCss': {
      const rawCssTargets = summarizeRawCssThemeTargets(action.css);
      return {
        kind: action.kind,
        title: '主题 CSS 插入试穿',
        summary: `${action.label?.trim() || action.layer || 'theme.css'} · ${action.position ?? 'after'} 锚点插入 ${action.css.trim().length} 字 CSS`,
        themeScope: rawCssTargets.scope,
        themeSurfaceIds: rawCssTargets.surfaceIds,
        themeSurfaceLabels: rawCssTargets.surfaceLabels,
        themePatchMode: 'merge',
        themeTransactionReason: '按 anchorString 在当前虚拟 theme.css 的可写层插入新 CSS，并进入试穿。',
        themeIntentLabel: action.label?.trim() || '主题 CSS 插入',
        targetLabel: action.label?.trim() || action.layer || 'theme.css'
      };
    }
    case 'deleteThemeCss':
      return {
        kind: action.kind,
        title: '主题 CSS 删除试穿',
        summary: `${action.label?.trim() || action.layer || 'theme.css'} · 删除 ${action.oldString.length} 字 CSS`,
        themeScope: 'app',
        themePatchMode: 'merge',
        themeTransactionReason: '从当前虚拟 theme.css 的可写层删除指定 CSS，并进入试穿。',
        themeIntentLabel: action.label?.trim() || '主题 CSS 删除',
        targetLabel: action.label?.trim() || action.layer || 'theme.css'
      };
    case 'replaceThemeCss':
      return {
        kind: action.kind,
        title: '完整主题 CSS 试穿',
        summary: `${action.label?.trim() || '纯自定义皮肤'} · 清底后写入 ${action.css.trim().length} 字 CSS`,
        themeScope: 'app',
        themePatchMode: 'replace',
        themeTransactionReason: '清掉 preset 底座，从纯自定义底座写入完整 CSS，并进入试穿。',
        themeIntentLabel: action.label?.trim() || '完整主题 CSS',
        targetLabel: action.label?.trim() || '纯自定义皮肤'
      };
    case 'inspectThemeRender':
      return {
        kind: action.kind,
        title: '主题渲染检查',
        summary: '读取当前界面关键区域 computed style',
        targetLabel: action.targetLabel
      };
    case 'applyPreset': {
      const preset = getThemePresetById(action.presetId);
      const targetLabel = preset?.name ?? action.presetId;
      return {
        kind: action.kind,
        title: preset ? `试穿 ${preset.name}` : '试穿主题预设',
        summary: preset ? `整页 · ${preset.mood} · ${preset.description}` : `整页 · 套用主题预设 ${action.presetId}`,
        themeScope: 'app',
        themePatchMode: 'replace',
        themeTransactionReason: '切换预设底座，并进入试穿。',
        targetLabel
      };
    }
  }
}
