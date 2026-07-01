import { parseThemeLayers } from '../engines/themeCssLayerBlocks';
import type { ThemeState } from '../types/domain';

const DIRECT_BACKGROUND_LAYER_IDS = new Set([
  'app-background',
  'chat-background',
  'collection-background'
]);

const BACKGROUND_DECLARATION_PATTERN = /\bbackground(?:-color|-image)?\s*:|--(?:bg|cool-bg|warm-bg)\s*:/i;
const DIRECT_BACKGROUND_SELECTORS = new Set([
  '.app-shell',
  '.app-shell.chat',
  '.app-shell.collection',
  '.app-shell.chat .app-stage',
  '.app-shell.collection .app-stage',
  '.app-shell.chat .world-stack',
  '.app-shell.collection .world-stack',
  '.app-shell.collection .app-stage::before',
  '.world-stack',
  '.bg-glow',
  '.bg-glow-top',
  '.bg-glow-bottom'
]);

function normalizeSelector(selector: string) {
  return selector.trim().replace(/\s+/g, ' ');
}

function isDirectBackgroundSelector(selector: string) {
  return DIRECT_BACKGROUND_SELECTORS.has(normalizeSelector(selector));
}

function cssTargetsBackgroundPaint(cssText: string) {
  const rules = Array.from(cssText.matchAll(/([^{}]+)\{([^{}]*)\}/g));
  return rules.some(([, selectorGroup, declarations]) => {
    if (!BACKGROUND_DECLARATION_PATTERN.test(declarations)) return false;
    return selectorGroup
      .split(',')
      .map((selector) => normalizeSelector(selector))
      .some((selector) => isDirectBackgroundSelector(selector));
  });
}

export function hasCreativeBackgroundOverride(theme: Pick<ThemeState, 'generatedCSS' | 'customCSS'>) {
  const generated = parseThemeLayers(theme.generatedCSS);
  if (generated.layers.some((layer) => DIRECT_BACKGROUND_LAYER_IDS.has(layer.id))) {
    return true;
  }

  if (generated.layers.some((layer) => layer.id === 'creative-raw-css' && cssTargetsBackgroundPaint(layer.cssText))) {
    return true;
  }

  return cssTargetsBackgroundPaint(theme.customCSS);
}
