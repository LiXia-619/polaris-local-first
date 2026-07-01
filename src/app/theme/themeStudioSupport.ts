import { THEME_PRESETS, buildThemeFrameFromPresetId, getThemePresetById } from '../../config/theme/themePresets';
import {
  describeSelectorTarget,
  findSelectorEntryForCssSelector
} from '../../config/theme/themeSelectorCatalog';
import {
  THEME_COORDINATE_SURFACE_LABEL,
  type ThemeCoordinateSurface
} from '../../engines/theme-coordinate/themeCoordinateSurfaceMeta';
import { parseThemeLayers } from '../../engines/themeCssLayerBlocks';
import { summarizeThemeGeneratedLayers } from '../../engines/themeCssLayers';
import { readSimpleCssRules } from '../../engines/themeCssRuleMerge';
import { areThemeVariablesEqual } from '../../stores/spaceStoreTheme';
import type { SavedSkin, SkinSnapshot, ThemePreset, ThemeState } from '../../types/domain';

export { THEME_PRESETS };

export function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp);
}

export function formatSnapshotTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp);
}

export function buildDefaultSkinName(theme: ThemeState) {
  const nowLabel = formatClock(Date.now());
  const preset = getThemePresetById(theme.activePresetId);
  return preset ? `${preset.name} · ${nowLabel}` : `纯自定义 · ${nowLabel}`;
}

function sanitizeCssFileName(name: string) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'polaris-theme';
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

function addLabelsFromCss(labels: Set<string>, css: string) {
  const parsedLayers = parseThemeLayers(css);
  parsedLayers.layers.forEach((layer) => {
    if (layer.id.startsWith('stable:')) {
      const surfaceId = layer.id.slice('stable:'.length) as ThemeCoordinateSurface;
      labels.add(THEME_COORDINATE_SURFACE_LABEL[surfaceId] ?? surfaceId);
      return;
    }
    labels.add(describeSelectorTarget(layer.id) ?? layer.id);
  });

  const rawCss = [parsedLayers.remainder, ...parsedLayers.layers.map((layer) => layer.cssText)].filter(Boolean).join('\n\n');
  const rules = readSimpleCssRules(rawCss) ?? [];
  rules.forEach((rule) => {
    if (rule.selector.trim().startsWith('@')) return;
    splitCssSelectorList(rule.selector).forEach((selector) => {
      const entry = findSelectorEntryForCssSelector(selector);
      if (entry) labels.add(entry.name);
    });
  });
}

export function buildSavedSkinFileName(savedSkin: SavedSkin) {
  return `${sanitizeCssFileName(savedSkin.name)}.polaris-theme.css`;
}

export function buildSavedSkinEditableCss(savedSkin: SavedSkin) {
  return [
    savedSkin.customCSS.trim(),
    savedSkin.generatedCSS.trim()
  ].filter(Boolean).join('\n\n');
}

export function formatSavedSkinTargetSummary(savedSkin: SavedSkin) {
  const labels = new Set<string>();
  addLabelsFromCss(labels, savedSkin.customCSS);
  addLabelsFromCss(labels, savedSkin.generatedCSS);
  if (labels.size === 0 && savedSkin.presetCSS.trim()) {
    labels.add(savedSkin.sourcePresetId ? '预设底座' : '整套主题');
  }
  return Array.from(labels).join('、') || '整套主题';
}

export function serializeSavedSkinCssFile(savedSkin: SavedSkin) {
  const css = buildSavedSkinEditableCss(savedSkin).trim() || savedSkin.presetCSS.trim();
  return [
    '/*',
    `Polaris theme: ${savedSkin.name}`,
    `Targets: ${formatSavedSkinTargetSummary(savedSkin)}`,
    'Paste into the Polaris CSS box. @polaris-part blocks replace the same target and keep other parts.',
    '*/',
    css || '/* empty theme */'
  ].join('\n');
}

export function isPresetPure(theme: ThemeState, preset: ThemePreset) {
  const presetFrame = buildThemeFrameFromPresetId(preset.id);
  return (
    !theme.activeSavedSkinId &&
    theme.activePresetId === preset.id &&
    !theme.customCSS.trim() &&
    !theme.generatedCSS.trim() &&
    theme.presetCSS === presetFrame.presetCSS &&
    theme.recipe?.name === presetFrame.recipe?.name &&
    theme.recipe?.note === presetFrame.recipe?.note &&
    areThemeVariablesEqual(theme.cssVariables, presetFrame.cssVariables)
  );
}

export function snapshotSourceLabel(snapshot: SkinSnapshot, savedSkins: SavedSkin[]) {
  if (snapshot.sourceSavedSkinId && savedSkins.some((savedSkin) => savedSkin.id === snapshot.sourceSavedSkinId)) {
    return '快捷皮肤';
  }
  if (snapshot.sourcePresetId) {
    return '预设底稿';
  }
  return '手调版本';
}

export function themeRecipeLabel(recipe: SavedSkin['recipe'] | SkinSnapshot['recipe'] | ThemeState['recipe']) {
  return recipe?.name?.trim() || null;
}

export function isCustomBaseTheme(theme: ThemeState) {
  return theme.activePresetId === null;
}

export function themeBaseModeLabel(theme: ThemeState) {
  return isCustomBaseTheme(theme) ? '纯自定义底座' : '默认预设底座';
}

export function savedSkinBaseLabel(savedSkin: SavedSkin) {
  return savedSkin.sourcePresetId ? '默认预设底座' : '纯自定义底座';
}

export function snapshotBaseLabel(snapshot: SkinSnapshot) {
  return snapshot.sourcePresetId ? '默认预设底座' : '纯自定义底座';
}

export function summarizeTheme(theme: ThemeState) {
  const preset = getThemePresetById(theme.activePresetId);
  const activeSavedSkin = theme.activeSavedSkinId
    ? theme.savedSkins.find((savedSkin) => savedSkin.id === theme.activeSavedSkinId) ?? null
    : null;

  const { layers: surfaceOverlays, replaceLabels, mergeLabels } = summarizeThemeGeneratedLayers(theme.generatedCSS);
  const surfaceOverlayCount = surfaceOverlays.length;
  const surfaceOverlaySummary =
    surfaceOverlayCount === 0
      ? ''
      : surfaceOverlayCount === 1
        ? `加了 1 处局部 CSS${replaceLabels.length ? ' · 整体替换' : mergeLabels.length ? ' · 局部叠加' : ''}`
        : `加了 ${surfaceOverlayCount} 处局部 CSS${replaceLabels.length && mergeLabels.length ? ' · 混合改动' : replaceLabels.length ? ' · 整体替换' : mergeLabels.length ? ' · 局部叠加' : ''}`;

  if (activeSavedSkin) {
    return {
      title: activeSavedSkin.name,
      subtitle: [
        activeSavedSkin.sourcePresetId ? `基于 ${getThemePresetById(activeSavedSkin.sourcePresetId)?.name ?? '预设'}` : '独立保存',
        themeRecipeLabel(activeSavedSkin.recipe)
      ].filter(Boolean).join(' · '),
      status: '已保存'
    };
  }
  if (preset && isPresetPure(theme, preset)) {
    return {
      title: preset.name,
      subtitle: [preset.mood, themeRecipeLabel(preset.recipe)].filter(Boolean).join(' · '),
      status: '预设'
    };
  }
  if (preset) {
    return {
      title: `${preset.name} · 调整中`,
      subtitle: [
        theme.customCSS.trim()
          ? '加了自定义 CSS'
          : surfaceOverlayCount > 0
            ? surfaceOverlaySummary
            : '调整了预设变量',
        themeRecipeLabel(theme.recipe)
      ].filter(Boolean).join(' · '),
      status: '调整中'
    };
  }
  return {
    title: theme.customCSS.trim() || theme.generatedCSS.trim() ? '纯自定义皮肤' : '纯自定义底座',
    subtitle: [
      theme.customCSS.trim()
        ? '由自定义 CSS 接管'
        : surfaceOverlayCount > 0
          ? surfaceOverlaySummary
          : '等你继续写 CSS',
      themeRecipeLabel(theme.recipe)
    ].filter(Boolean).join(' · '),
    status: '自定义'
  };
}
