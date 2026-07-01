import { parseThemeLayers, wrapThemeCssLayer } from '../engines/themeCssLayerBlocks';
import { normalizeThemeCssForRuntime } from '../engines/themeCssRuntime';
import type { ThemeState, ThemeVariables } from '../types/domain';

const CORE_VARIABLE_KEYS = [
  '--bg',
  '--surface',
  '--surface-solid',
  '--surface-deep',
  '--accent',
  '--accent-soft',
  '--text',
  '--card-bg'
] as const;

const CORE_SURFACE_LAYER_IDS = [
  'stable:background',
  'stable:topbar',
  'stable:chat-user-bubble',
  'stable:chat-ai-bubble',
  'stable:composer',
  'stable:panel',
  'stable:card'
] as const;

const RELEVANT_VISUAL_PROPERTIES = new Set([
  'background',
  'background-color',
  'background-image',
  'box-shadow',
  'backdrop-filter',
  'color',
  'filter',
  'opacity',
  'transform'
]);

const THEME_METADATA_COMMENT_PATTERN = /\/\*\s*polaris-stable-theme-(?:state|meta):[\s\S]*?\*\//gi;

type ColorSample = {
  hue: number;
  lightness: number;
  alpha: number;
};

export type ThemeDomSnapshot = {
  activePresetId: string | null;
  cssVariables: ThemeVariables;
  presetCss: string;
  customCss: string;
  generatedCss: string;
  domSignature: string;
  presetVisualFingerprint: string;
  customVisualFingerprint: string;
  generatedVisualFingerprint: string;
};

function stripThemeMetadataComments(cssText: string) {
  return cssText.replace(THEME_METADATA_COMMENT_PATTERN, '').trim();
}

function normalizeThemeLayerCss(cssText: string) {
  return stripThemeMetadataComments(normalizeThemeCssForRuntime(cssText)).trim();
}

function normalizeGeneratedCssForDom(cssText: string) {
  const parsed = parseThemeLayers(cssText);
  const parts: string[] = [];
  const remainder = normalizeThemeLayerCss(parsed.remainder);
  if (remainder) parts.push(remainder);

  parsed.layers.forEach((layer) => {
    const normalizedLayerCss = normalizeThemeLayerCss(layer.cssText);
    if (!normalizedLayerCss) return;
    parts.push(wrapThemeCssLayer(layer.id, normalizedLayerCss));
  });

  return parts.join('\n\n').trim();
}

function buildMeaningfulCssFingerprint(cssText: string) {
  const normalized = normalizeThemeLayerCss(cssText);
  if (!normalized) return '';

  return Array.from(normalized.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/gi))
    .filter(([, property]) => RELEVANT_VISUAL_PROPERTIES.has(property.toLowerCase()))
    .map(([, property, value]) => `${property.toLowerCase()}:${value.trim()}`)
    .join(';');
}

function buildGeneratedVisualFingerprint(cssText: string) {
  const parsed = parseThemeLayers(cssText);
  const layerMap = new Map(parsed.layers.map((layer) => [layer.id, layer.cssText]));

  return CORE_SURFACE_LAYER_IDS
    .map((layerId) => `${layerId}:${buildMeaningfulCssFingerprint(layerMap.get(layerId) ?? '')}`)
    .join('|');
}

function serializeVariables(cssVariables: ThemeVariables) {
  return JSON.stringify(Object.entries(cssVariables).sort(([left], [right]) => left.localeCompare(right)));
}

function hueDistance(left: number, right: number) {
  const raw = Math.abs(left - right);
  return Math.min(raw, 360 - raw);
}

function parseAlpha(raw: string | undefined, fallback = 1) {
  if (!raw) return fallback;
  const value = raw.trim();
  if (value.endsWith('%')) return Number(value.slice(0, -1)) / 100;
  return Number(value);
}

function rgbToColorSample(red: number, green: number, blue: number, alpha = 1): ColorSample {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    switch (max) {
      case r:
        hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        hue = ((b - r) / delta + 2) * 60;
        break;
      default:
        hue = ((r - g) / delta + 4) * 60;
        break;
    }
  }

  return {
    hue: Math.round(hue),
    lightness: Number((lightness * 100).toFixed(2)),
    alpha
  };
}

function parseHexColor(value: string): ColorSample | null {
  const match = value.match(/#([0-9a-f]{6}|[0-9a-f]{8}|[0-9a-f]{3}|[0-9a-f]{4})/i);
  if (!match) return null;
  const hex = match[1];

  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a = 'f'] = hex.split('');
    return rgbToColorSample(
      parseInt(`${r}${r}`, 16),
      parseInt(`${g}${g}`, 16),
      parseInt(`${b}${b}`, 16),
      parseInt(`${a}${a}`, 16) / 255
    );
  }

  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return rgbToColorSample(
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    alpha
  );
}

function parseHslColor(value: string): ColorSample | null {
  const match = value.match(/hsla?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].trim().split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  return {
    hue: Math.round(Number(parts[0].replace(/deg$/i, ''))),
    lightness: Number(parts[2].replace('%', '')),
    alpha: parseAlpha(parts[3])
  };
}

function parseRgbColor(value: string): ColorSample | null {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].trim().split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  return rgbToColorSample(
    Number(parts[0].replace('%', '')),
    Number(parts[1].replace('%', '')),
    Number(parts[2].replace('%', '')),
    parseAlpha(parts[3])
  );
}

function parseColorSample(value: string): ColorSample | null {
  return parseHslColor(value) ?? parseRgbColor(value) ?? parseHexColor(value);
}

function hasMeaningfulVariableShift(previousVariables: ThemeVariables, nextVariables: ThemeVariables) {
  return CORE_VARIABLE_KEYS.some((key) => {
    const previousValue = previousVariables[key] ?? '';
    const nextValue = nextVariables[key] ?? '';
    if (previousValue === nextValue) return false;

    const previousColor = parseColorSample(previousValue);
    const nextColor = parseColorSample(nextValue);
    if (!previousColor || !nextColor) return true;

    return (
      hueDistance(previousColor.hue, nextColor.hue) >= 12
      || Math.abs(previousColor.lightness - nextColor.lightness) >= 6
      || Math.abs(previousColor.alpha - nextColor.alpha) >= 0.12
    );
  });
}

export function buildThemeDomSnapshot(theme: ThemeState): ThemeDomSnapshot {
  const presetCss = normalizeThemeLayerCss(theme.presetCSS);
  const customCss = normalizeThemeLayerCss(theme.customCSS);
  const generatedCss = normalizeGeneratedCssForDom(theme.generatedCSS);

  return {
    activePresetId: theme.activePresetId,
    cssVariables: theme.cssVariables,
    presetCss,
    customCss,
    generatedCss,
    domSignature: JSON.stringify([
      theme.activePresetId,
      serializeVariables(theme.cssVariables),
      presetCss,
      customCss,
      generatedCss
    ]),
    presetVisualFingerprint: buildMeaningfulCssFingerprint(presetCss),
    customVisualFingerprint: buildMeaningfulCssFingerprint(customCss),
    generatedVisualFingerprint: buildGeneratedVisualFingerprint(theme.generatedCSS)
  };
}

export function shouldAnimateThemeTransition(previous: ThemeDomSnapshot | null, next: ThemeDomSnapshot) {
  if (!previous) return false;
  if (previous.activePresetId !== next.activePresetId) return true;
  if (hasMeaningfulVariableShift(previous.cssVariables, next.cssVariables)) return true;
  if (previous.presetVisualFingerprint !== next.presetVisualFingerprint) return true;
  if (previous.customVisualFingerprint !== next.customVisualFingerprint) return true;
  return previous.generatedVisualFingerprint !== next.generatedVisualFingerprint;
}
