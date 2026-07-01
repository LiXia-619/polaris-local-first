import {
  describeSelectorTarget,
  findSelectorEntryForCssSelector,
  resolveSelectorScope
} from '../config/theme/themeSelectorCatalog';
import { THEME_COORDINATE_SURFACE_LABEL, type ThemeCoordinateSurface } from './theme-coordinate/themeCoordinateSurfaceMeta';
import type { ThemeCoordinateGeneratedPatch } from './theme-coordinate/themeCoordinateGeneratedPatch';
import { analyzeThemeCustomCss } from './themeCssGuard';
import type {
  ThemeGeneratedSurfaceLayerSummary,
  ThemeToolPatchMode,
  ThemeToolScope
} from '../types/domain';
import { parseThemeLayers, wrapThemeCssLayer } from './themeCssLayerBlocks';
import { mergeSimpleCssRules, readSimpleCssRules } from './themeCssRuleMerge';

export { wrapThemeCssLayer } from './themeCssLayerBlocks';

const CREATIVE_RAW_CSS_LAYER_ID = 'creative-raw-css';

export function serializeThemeCoordinateGeneratedPatch(patch: ThemeCoordinateGeneratedPatch): string {
  return [
    ...(patch.comments ?? []),
    ...patch.layers.map((layer) => wrapThemeCssLayer(layer.layerId, layer.cssText))
  ].filter(Boolean).join('\n\n');
}

function isCreativeRawCssLayer(layerId: string) {
  return layerId === CREATIVE_RAW_CSS_LAYER_ID;
}

function isReplaceStyleLayer(layerId: string) {
  return !isCreativeRawCssLayer(layerId);
}

function mergeThemeLayerCss(layerId: string, previousCssText: string, nextCssText: string) {
  if (isReplaceStyleLayer(layerId)) {
    return nextCssText;
  }
  const mergedCssText = mergeSimpleCssRules(previousCssText, nextCssText);
  if (mergedCssText) return mergedCssText;
  if (isCreativeRawCssLayer(layerId)) {
    return `${previousCssText.trim()}\n\n${nextCssText.trim()}`.trim();
  }
  return nextCssText;
}

function skipQuotedSelectorText(source: string, index: number) {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (source[cursor] === quote) return cursor + 1;
    cursor += 1;
  }
  return source.length;
}

function splitSelectorList(selectorText: string) {
  const selectors: string[] = [];
  let current = '';
  let parenDepth = 0;
  let cursor = 0;

  while (cursor < selectorText.length) {
    const char = selectorText[cursor];
    if (char === '"' || char === '\'') {
      const nextCursor = skipQuotedSelectorText(selectorText, cursor);
      current += selectorText.slice(cursor, nextCursor);
      cursor = nextCursor;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      current += char;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += char;
      cursor += 1;
      continue;
    }
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

function buildCssRule(selector: string, bodyText: string) {
  return `${selector} {\n${bodyText.trim()}\n}`;
}

function appendLayerCss(layers: Map<string, string[]>, layerId: string, cssText: string) {
  const entries = layers.get(layerId) ?? [];
  entries.push(cssText);
  layers.set(layerId, entries);
}

function buildCreativeCssPatch(rawCss: string) {
  const rules = readSimpleCssRules(rawCss);
  if (!rules) return wrapThemeCssLayer(CREATIVE_RAW_CSS_LAYER_ID, rawCss);

  const layers = new Map<string, string[]>();
  const fallbackRules: string[] = [];

  rules.forEach((rule) => {
    if (rule.selector.trim().startsWith('@')) {
      fallbackRules.push(rule.rawText);
      return;
    }

    const selectors = splitSelectorList(rule.selector);
    if (selectors.length === 0) {
      fallbackRules.push(rule.rawText);
      return;
    }

    const selectorLayers = new Map<string, string[]>();
    for (const selector of selectors) {
      const entry = findSelectorEntryForCssSelector(selector);
      if (!entry) {
        fallbackRules.push(rule.rawText);
        return;
      }
      const layerSelectors = selectorLayers.get(entry.alias) ?? [];
      layerSelectors.push(selector);
      selectorLayers.set(entry.alias, layerSelectors);
    }

    selectorLayers.forEach((layerSelectors, layerId) => {
      appendLayerCss(layers, layerId, buildCssRule(layerSelectors.join(', '), rule.bodyText));
    });
  });

  if (fallbackRules.length > 0) {
    appendLayerCss(layers, CREATIVE_RAW_CSS_LAYER_ID, fallbackRules.join('\n\n'));
  }

  return Array.from(layers.entries())
    .map(([layerId, cssParts]) => wrapThemeCssLayer(layerId, cssParts.join('\n\n')))
    .filter(Boolean)
    .join('\n\n');
}

function describeThemeLayer(layerId: string) {
  if (layerId.startsWith('stable:')) {
    const surfaceId = layerId.slice('stable:'.length) as ThemeCoordinateSurface;
    return {
      surfaceId,
      label: THEME_COORDINATE_SURFACE_LABEL[surfaceId] ?? surfaceId,
      scope: 'app' as const
    };
  }

  if (layerId === CREATIVE_RAW_CSS_LAYER_ID) {
    return {
      surfaceId: layerId,
      label: '整页 CSS',
      scope: 'app' as const
    };
  }

  return {
    surfaceId: layerId,
    label: describeSelectorTarget(layerId) ?? layerId,
    scope: resolveSelectorScope(layerId)
  };
}

export function mergeThemeCssLayers(baseCss: string, nextCss: string): string {
  const normalizedBase = baseCss.trim();
  const normalizedNext = nextCss.trim();
  if (!normalizedNext) return normalizedBase;
  if (!normalizedBase) return normalizedNext;

  const base = parseThemeLayers(normalizedBase);
  const next = parseThemeLayers(normalizedNext);
  if (next.layers.length === 0) {
    return `${normalizedBase}\n\n${normalizedNext}`.trim();
  }

  const merged = new Map(base.layers.map((layer) => [layer.id, layer]));
  const order = base.layers.map((layer) => layer.id);

  next.layers.forEach((layer) => {
    if (!merged.has(layer.id)) {
      order.push(layer.id);
      merged.set(layer.id, layer);
      return;
    }

    const previousLayer = merged.get(layer.id);
    if (!previousLayer) {
      merged.set(layer.id, layer);
      return;
    }

    if (isReplaceStyleLayer(layer.id)) {
      merged.set(layer.id, layer);
      return;
    }

    merged.set(layer.id, {
      ...layer,
      cssText: mergeThemeLayerCss(layer.id, previousLayer.cssText, layer.cssText)
    });
  });

  const parts: string[] = [];
  const remainder = [base.remainder, next.remainder].filter(Boolean).join('\n\n').trim();
  if (remainder) parts.push(remainder);
  order.forEach((id) => {
    const layer = merged.get(id);
    if (layer) parts.push(wrapThemeCssLayer(layer.id, layer.cssText));
  });
  return parts.join('\n\n').trim();
}

export function readThemeGeneratedSurfaceLayers(generatedCSS: string): ThemeGeneratedSurfaceLayerSummary[] {
  return parseThemeLayers(generatedCSS).layers.map((layer) => ({
    ...describeThemeLayer(layer.id),
    layerCount: 1,
    layerIds: [layer.id],
    operations: [isReplaceStyleLayer(layer.id) ? ('replace' satisfies ThemeToolPatchMode) : ('merge' satisfies ThemeToolPatchMode)]
  }));
}

export function formatThemeGeneratedLayerLabel(layer: ThemeGeneratedSurfaceLayerSummary) {
  return layer.label;
}

export function summarizeThemeGeneratedLayers(generatedCSS: string) {
  const layers = readThemeGeneratedSurfaceLayers(generatedCSS);
  const overlayLabels = layers.map((layer) => formatThemeGeneratedLayerLabel(layer));
  const replaceLabels = layers
    .filter((layer) => layer.operations.includes('replace'))
    .map((layer) => formatThemeGeneratedLayerLabel(layer));
  const mergeLabels = layers
    .filter((layer) => layer.operations.includes('merge'))
    .map((layer) => formatThemeGeneratedLayerLabel(layer));
  return {
    layers,
    overlayLabels,
    replaceLabels,
    mergeLabels
  };
}

export function resolveCreativeCssPatch(
  action: { kind: 'patchRawCss'; css: string; label?: string }
): { ok: true; generatedCssPatch: string } | { ok: false; error: string } {
  const rawCss = action.css.trim();
  if (!rawCss) return { ok: false, error: '整页 CSS 不能为空。' };
  const guard = analyzeThemeCustomCss(rawCss);
  if (guard.blockingIssues.length > 0) return { ok: false, error: guard.blockingIssues[0] };
  return { ok: true, generatedCssPatch: buildCreativeCssPatch(rawCss) };
}
