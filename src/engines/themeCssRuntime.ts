import { parseThemeLayers, wrapThemeCssLayer } from './themeCssLayerBlocks';
import { buildThemeCoordinateControlStyleVars } from './theme-coordinate/themeCoordinateControlVars';
import type { BaseColor } from './theme-coordinate/themeCoordinateTypes';

const USER_BUBBLE_NTH_PATTERN = /\.bubble\.user:(?:nth-child|nth-of-type)\(\s*([2-6])n(?:\s*([+-])\s*(\d+))?\s*\)/g;
const ANIMATION_ALIASES: Record<string, string> = {
  'bubble-float-up': 'messageLift',
  'bubble-float-in': 'messageLift',
  'bubble-rise': 'messageLift',
  'bubble-fade-up': 'fadeInUp',
  'bubble-breathe': 'softPulse'
};
const THEME_VARIABLE_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['--bg', ['--chat-bg', '--cool-bg']],
  ['--surface', ['--cool-surface']],
  ['--surface-solid', ['--cool-surface-solid']],
  ['--surface-deep', ['--cool-surface-deep']],
  ['--border', ['--cool-border']],
  ['--border-hover', ['--cool-border-hover']],
  ['--text', ['--cool-text']],
  ['--text-soft', ['--cool-text-soft']],
  ['--text-muted', ['--cool-text-muted']],
  ['--accent', ['--cool-accent']],
  ['--accent-soft', ['--cool-accent-soft']],
  ['--accent-glow', ['--cool-accent-glow']]
];
const PROTECTED_THEME_SHELL_SELECTORS = [
  '.app-shell',
  '.app-shell.chat',
  '.app-shell.collection',
  '.app-stage',
  '.app-shell .app-stage',
  '.app-shell.chat .app-stage',
  '.app-shell.collection .app-stage',
  '.world-stack',
  '.app-shell .world-stack',
  '.app-shell.chat .world-stack',
  '.app-shell.collection .world-stack',
  '.world-frame',
  '.world',
  '.world-chat',
  '.world-collection'
] as const;
const SHELL_FILTER_PROPERTIES = new Set(['filter', 'backdrop-filter', '-webkit-backdrop-filter']);
const PROTECTED_COMPOSER_SHELL_TOKENS = [
  '.chat-composer',
  '.chat-box-shell',
  '.chat-box-main',
  '.chat-box'
] as const;
const PROTECTED_COMPOSER_CONTROL_TOKENS = [
  '.send-btn',
  '.composer-slot-btn'
] as const;
const PROTECTED_COMPOSER_SHELL_PROPERTIES = new Set([
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-block',
  'inset-inline',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'transform',
  'translate',
  'rotate',
  'scale',
  'transform-origin',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'display',
  'flex',
  'flex-basis',
  'flex-grow',
  'flex-shrink',
  'align-self',
  'justify-self',
  'place-self',
  'order',
  'gap',
  'row-gap',
  'column-gap',
  'overflow',
  'overflow-x',
  'overflow-y'
]);
const PROTECTED_COMPOSER_CONTROL_PROPERTIES = new Set([
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'inset-block',
  'inset-inline',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'transform',
  'translate',
  'rotate',
  'scale',
  'transform-origin',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'flex',
  'flex-basis',
  'flex-grow',
  'flex-shrink',
  'align-self',
  'justify-self',
  'place-self',
  'order'
]);
const PROTECTED_SHELF_TAB_CHROME_TOKENS = [
  '.collection-shelf-tab-row',
  '.shelf-tab',
  '.shelf-tab-icon'
] as const;
const PROTECTED_SHELF_TAB_CHROME_PROPERTIES = new Set([
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'box-shadow',
  'filter',
  'backdrop-filter',
  '-webkit-backdrop-filter',
  'outline',
  'outline-color',
  'outline-offset',
  'outline-width'
]);
const CONTROL_THEME_COLOR_SOURCES = [
  '--control-base',
  '--bg',
  '--cool-bg',
  '--warm-bg',
  'background',
  'background-color'
] as const;
const CONTROL_THEME_MARKER_PATTERN = /(?:^|[;\s])--control-(?:surface|border|text|placeholder|focus-shadow)\s*:/i;

const NAMED_COLOR_SAMPLES: Record<string, BaseColor> = {
  black: { h: 0, s: 0, l: 0 },
  white: { h: 0, s: 0, l: 100 }
};

function toCycleIndex(step: number, sign?: string, rawOffset?: string) {
  const offset = rawOffset ? Number(rawOffset) * (sign === '-' ? -1 : 1) : 0;
  return ((offset - 1) % step + step) % step;
}

function escapeCssProperty(property: string) {
  return property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mirrorThemeVariableAliases(cssText: string) {
  return cssText.replace(/\{([^{}]*)\}/g, (match, body: string) => {
    let nextBody = body;

    THEME_VARIABLE_ALIASES.forEach(([source, aliases]) => {
      const declarationPattern = new RegExp(`(${escapeCssProperty(source)}\\s*:\\s*([^;{}]+);)`, 'gi');
      const sourceDeclarations = Array.from(body.matchAll(declarationPattern));
      if (sourceDeclarations.length === 0) return;

      const aliasDeclarations = aliases
        .filter((alias) => {
          const aliasPattern = new RegExp(`(?:^|[;\\s])${escapeCssProperty(alias)}\\s*:`, 'i');
          return !aliasPattern.test(body);
        })
        .map((alias) => `${alias}: ${sourceDeclarations[sourceDeclarations.length - 1]?.[2]?.trim()};`)
        .join(' ');

      if (!aliasDeclarations) return;
      nextBody = nextBody.replace(declarationPattern, `$1 ${aliasDeclarations}`);
    });

    return `{${nextBody}}`;
  });
}

function normalizeSelector(selector: string) {
  return selector.trim().replace(/\s+/g, ' ');
}

function parseAlpha(raw: string | undefined, fallback = 1) {
  if (!raw) return fallback;
  const value = raw.trim();
  if (value.endsWith('%')) return Number(value.slice(0, -1)) / 100;
  return Number(value);
}

function rgbToBaseColor(red: number, green: number, blue: number): BaseColor {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
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
    h: Math.round(hue),
    s: Number((saturation * 100).toFixed(2)),
    l: Number((lightness * 100).toFixed(2))
  };
}

function parseHexColorSample(raw: string): BaseColor | null {
  const hex = raw.replace('#', '');
  if (![3, 4, 6, 8].includes(hex.length)) return null;
  const normalized = hex.length <= 4
    ? hex.split('').map((digit) => `${digit}${digit}`).join('')
    : hex;
  if (normalized.length === 8) {
    const alpha = parseInt(normalized.slice(6, 8), 16) / 255;
    if (alpha <= 0.02) return null;
  }
  return rgbToBaseColor(
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  );
}

function parseHslColorSample(raw: string): BaseColor | null {
  const match = raw.match(/hsla?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].trim().split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const hue = Number(parts[0].replace(/deg$/i, ''));
  const saturation = Number(parts[1].replace('%', ''));
  const lightness = Number(parts[2].replace('%', ''));
  const alpha = parseAlpha(parts[3]);
  if (!Number.isFinite(hue) || !Number.isFinite(saturation) || !Number.isFinite(lightness) || alpha <= 0.02) {
    return null;
  }
  return { h: hue, s: saturation, l: lightness };
}

function parseRgbColorSample(raw: string): BaseColor | null {
  const match = raw.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].trim().split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const [red, green, blue] = parts.slice(0, 3).map((value) => {
    if (value.endsWith('%')) return Number(value.slice(0, -1)) * 2.55;
    return Number(value);
  });
  const alpha = parseAlpha(parts[3]);
  if (![red, green, blue].every(Number.isFinite) || alpha <= 0.02) return null;
  return rgbToBaseColor(red!, green!, blue!);
}

function parseRepresentativeColorSample(cssValue: string): BaseColor | null {
  const colorPattern = /#[0-9a-f]{3,8}\b|hsla?\([^)]*\)|rgba?\([^)]*\)|\b(?:black|white)\b/gi;
  for (const match of cssValue.matchAll(colorPattern)) {
    const raw = match[0];
    const lower = raw.toLowerCase();
    const sample =
      lower.startsWith('#') ? parseHexColorSample(raw)
        : lower.startsWith('hsl') ? parseHslColorSample(raw)
          : lower.startsWith('rgb') ? parseRgbColorSample(raw)
            : NAMED_COLOR_SAMPLES[lower] ?? null;
    if (sample) return sample;
  }
  return null;
}

function getDeclarationValue(declarations: string, property: string) {
  const escapedProperty = escapeCssProperty(property);
  const pattern = new RegExp(`(?:^|;)\\s*${escapedProperty}\\s*:\\s*([^;{}]+)`, 'gi');
  const matches = Array.from(declarations.matchAll(pattern));
  return matches[matches.length - 1]?.[1]?.trim() ?? null;
}

function resolveControlBaseColor(declarations: string) {
  for (const property of CONTROL_THEME_COLOR_SOURCES) {
    const value = getDeclarationValue(declarations, property);
    if (!value) continue;
    const sample = parseRepresentativeColorSample(value);
    if (sample) return sample;
  }
  return null;
}

function matchesThemeVariableOwnerSelector(selector: string) {
  const normalized = normalizeSelector(selector);
  if (normalized === ':root') return true;
  if (!normalized.startsWith('.app-shell')) return false;
  const remainder = normalized.slice('.app-shell'.length);
  if (!remainder) return true;
  if (![':', '[', '.'].includes(remainder[0])) return false;
  return !/[ >+~]/.test(remainder);
}

function shouldHydrateControlVars(selectorGroup: string, declarations: string) {
  if (CONTROL_THEME_MARKER_PATTERN.test(declarations)) return false;
  const selectors = selectorGroup.split(',').map((selector) => normalizeSelector(selector));
  return selectors.some((selector) => matchesThemeVariableOwnerSelector(selector));
}

function hydrateControlVariables(cssText: string) {
  return cssText.replace(/([^{}]+)\{([^{}]*)\}/g, (match, selectorGroup: string, declarations: string) => {
    if (!shouldHydrateControlVars(selectorGroup, declarations)) return match;
    const baseColor = resolveControlBaseColor(declarations);
    if (!baseColor) return match;

    const controlDeclarations = Object.entries(buildThemeCoordinateControlStyleVars(baseColor))
      .map(([key, value]) => `${key}: ${value};`)
      .join(' ');
    return `${selectorGroup}{${declarations.trim()}${declarations.trim().endsWith(';') ? '' : ';'} ${controlDeclarations}}`;
  });
}

function matchesProtectedShellSelector(selector: string) {
  const normalized = normalizeSelector(selector);
  return PROTECTED_THEME_SHELL_SELECTORS.some((protectedSelector) => {
    if (normalized === protectedSelector) return true;
    if (!normalized.startsWith(protectedSelector)) return false;
    const remainder = normalized.slice(protectedSelector.length);
    if (!remainder) return true;
    if (![':', '[', '.'].includes(remainder[0])) return false;
    return !/[ >+~]/.test(remainder);
  });
}

function stripDangerousShellFilters(cssText: string) {
  return cssText.replace(/([^{}]+)\{([^{}]*)\}/g, (match, selectorGroup: string, declarations: string) => {
    const selectors = selectorGroup.split(',').map((selector) => normalizeSelector(selector));
    if (!selectors.some((selector) => matchesProtectedShellSelector(selector))) {
      return match;
    }

    const nextDeclarations = declarations
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .filter((declaration) => {
        const property = declaration.split(':')[0]?.trim().toLowerCase();
        return property ? !SHELL_FILTER_PROPERTIES.has(property) : false;
      })
      .join('; ');

    return `${selectorGroup}{${nextDeclarations}${nextDeclarations ? ';' : ''}}`;
  });
}

function matchesProtectedComposerToken(selector: string, tokens: readonly string[]) {
  const normalized = normalizeSelector(selector);
  return tokens.some((token) => {
    if (!normalized.includes(token)) return false;
    return true;
  });
}

function stripProtectedComposerGeometry(cssText: string) {
  return cssText.replace(/([^{}]+)\{([^{}]*)\}/g, (match, selectorGroup: string, declarations: string) => {
    const selectors = selectorGroup.split(',').map((selector) => normalizeSelector(selector));
    const hitsControl = selectors.some((selector) => matchesProtectedComposerToken(selector, PROTECTED_COMPOSER_CONTROL_TOKENS));
    const hitsShell = selectors.some((selector) => (
      matchesProtectedComposerToken(selector, PROTECTED_COMPOSER_SHELL_TOKENS)
      && !matchesProtectedComposerToken(selector, PROTECTED_COMPOSER_CONTROL_TOKENS)
    ));
    if (!hitsShell && !hitsControl) {
      return match;
    }

    const nextDeclarations = declarations
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .filter((declaration) => {
        const property = declaration.split(':')[0]?.trim().toLowerCase();
        if (!property) return false;
        if (hitsShell && PROTECTED_COMPOSER_SHELL_PROPERTIES.has(property)) return false;
        if (hitsControl && PROTECTED_COMPOSER_CONTROL_PROPERTIES.has(property)) return false;
        return true;
      })
      .join('; ');

    return `${selectorGroup}{${nextDeclarations}${nextDeclarations ? ';' : ''}}`;
  });
}

function stripProtectedShelfTabChrome(cssText: string) {
  return cssText.replace(/([^{}]+)\{([^{}]*)\}/g, (match, selectorGroup: string, declarations: string) => {
    const selectors = selectorGroup.split(',').map((selector) => normalizeSelector(selector));
    const protectedSelectors = selectors.filter((selector) => (
      matchesProtectedComposerToken(selector, PROTECTED_SHELF_TAB_CHROME_TOKENS)
      && !selector.includes('.collection-shelf-tabs')
    ));
    if (protectedSelectors.length === 0) {
      return match;
    }

    const allowedSelectors = selectors.filter((selector) => !protectedSelectors.includes(selector));
    const nextDeclarations = declarations
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .filter((declaration) => {
        const property = declaration.split(':')[0]?.trim().toLowerCase();
        return property ? !PROTECTED_SHELF_TAB_CHROME_PROPERTIES.has(property) : false;
      })
      .join('; ');

    const parts: string[] = [];
    if (allowedSelectors.length > 0) {
      parts.push(`${allowedSelectors.join(', ')}{${declarations.trim()}${declarations.trim().endsWith(';') ? '' : ';'}}`);
    }
    if (nextDeclarations) {
      parts.push(`${protectedSelectors.join(', ')}{${nextDeclarations};}`);
    }
    return parts.join('\n');
  });
}

function sanitizeThemeCssText(cssText: string) {
  const normalizedSelectors = cssText.replace(USER_BUBBLE_NTH_PATTERN, (_match, stepText: string, sign?: string, rawOffset?: string) => {
    const step = Number(stepText);
    const cycleIndex = toCycleIndex(step, sign, rawOffset);
    return `.msg-row.user[data-user-bubble-cycle${step}="${cycleIndex}"] .bubble.user`;
  });
  const normalizedVariables = mirrorThemeVariableAliases(normalizedSelectors);
  const hydratedVariables = hydrateControlVariables(normalizedVariables);
  return stripProtectedShelfTabChrome(stripDangerousShellFilters(hydratedVariables));
}

export function normalizeThemeCssForRuntime(cssText: string) {
  if (!cssText.trim()) return '';

  const parsed = parseThemeLayers(cssText);
  const sanitizedRemainder = stripProtectedComposerGeometry(sanitizeThemeCssText(parsed.remainder));
  const sanitizedLayers = parsed.layers.map((layer) => {
    const sanitizedCss =
      layer.id === 'creative-raw-css'
        ? stripProtectedComposerGeometry(sanitizeThemeCssText(layer.cssText))
        : sanitizeThemeCssText(layer.cssText);
    return wrapThemeCssLayer(layer.id, sanitizedCss);
  }).filter(Boolean);
  const sanitizedCss = [sanitizedRemainder, ...sanitizedLayers].filter(Boolean).join('\n\n');

  return Object.entries(ANIMATION_ALIASES).reduce((nextCss, [alias, mapped]) => {
    if (nextCss.includes(`@keyframes ${alias}`)) return nextCss;
    return nextCss.replace(new RegExp(`\\b${alias}\\b`, 'g'), mapped);
  }, sanitizedCss);
}
