import type { CodeCard } from '../types/domain';
import { normalizeCodeLanguage } from './codeCardLanguage';

type FaceCard = Pick<CodeCard, 'id' | 'kind' | 'language' | 'title' | 'tags' | 'cardFaceCss'>;

export type CodeCardFaceType = 'code' | 'text' | 'rule';
export type CodeCardFaceVars = Record<`--${string}`, string>;
const TEXT_CARD_LANGUAGES = new Set(['text', 'txt', 'markdown', 'md']);

const REMOTE_URL_PATTERN = /url\(\s*(['"]?)((?:https?:)?\/\/[^'")\s]+)\1\s*\)/i;
const REMOTE_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?['"]?(?:https?:)?\/\//i;
export const DEFAULT_CODE_CARD_FACE_ROOT_SCOPE = '.app-shell.collection .world-collection';
function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFromRange(seed: number, min: number, max: number) {
  const ratio = (seed % 10_000) / 10_000;
  return min + (max - min) * ratio;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatAlpha(value: number) {
  return value.toFixed(3);
}

function formatDeg(value: number) {
  return `${value.toFixed(2)}deg`;
}

function sanitizeCardFaceDeclarations(rawDeclarations: string) {
  const declarations = rawDeclarations
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const separatorIndex = item.indexOf(':');
      if (separatorIndex <= 0) return [];
      const property = item.slice(0, separatorIndex).trim().toLowerCase();
      const value = item.slice(separatorIndex + 1).trim();
      if (!value) return [];
      if ((REMOTE_URL_PATTERN.test(value) || REMOTE_IMPORT_PATTERN.test(value)) && !property.startsWith('--')) {
        return [];
      }
      return [`${property}: ${value}`];
    });

  return declarations.join(';\n');
}

export function resolveCodeCardFaceType(card: Pick<CodeCard, 'kind' | 'language'>): CodeCardFaceType {
  if (card.kind === 'room-rule') return 'rule';
  return TEXT_CARD_LANGUAGES.has(normalizeCodeLanguage(card.language)) ? 'text' : 'code';
}

export function buildCodeCardFaceVars(card: FaceCard): CodeCardFaceVars {
  const faceType = resolveCodeCardFaceType(card);
  const seed = stableHash([
    card.id,
    card.title,
    card.language,
    card.kind ?? 'card',
    card.tags.join('|')
  ].join('::'));
  const toneSeed = stableHash(`${seed}:tone`);
  const glowSeed = stableHash(`${seed}:glow`);
  const textureSeed = stableHash(`${seed}:texture`);

  const baseHue =
    faceType === 'rule'
      ? 34 + (toneSeed % 24)
      : faceType === 'text'
        ? 12 + (toneSeed % 26)
        : 188 + (toneSeed % 44);
  const accentHue = (baseHue + 18 + (glowSeed % 26)) % 360;

  const stripOpacity =
    faceType === 'rule'
      ? 0.74
      : faceType === 'text'
        ? 0.56
        : 0.88;
  const textureOpacity =
    faceType === 'rule'
      ? 0.085
      : faceType === 'text'
        ? 0.06
        : 0.11;

  return {
    '--code-card-face-angle': formatDeg(112 + (toneSeed % 36)),
    '--code-card-face-tilt': formatDeg(-1.2 + pickFromRange(textureSeed, 0, 2.4)),
    '--code-card-face-glow-x': formatPercent(18 + (glowSeed % 52)),
    '--code-card-face-glow-y': formatPercent(14 + (textureSeed % 36)),
    '--code-card-face-accent': `hsl(${baseHue} 66% 71% / 0.20)`,
    '--code-card-face-accent-strong': `hsl(${accentHue} 74% 64% / 0.38)`,
    '--code-card-face-panel-top': `hsl(${baseHue} 55% 97% / 0.98)`,
    '--code-card-face-panel-bottom': `hsl(${(baseHue + 10) % 360} 44% 94% / 0.94)`,
    '--code-card-face-strip': `linear-gradient(90deg, hsl(${baseHue} 82% 90% / ${formatAlpha(stripOpacity)}), hsl(${accentHue} 88% 91% / ${formatAlpha(stripOpacity * 0.76)}))`,
    '--code-card-face-grid-opacity': formatAlpha(textureOpacity),
    '--code-card-face-dot-opacity': formatAlpha(faceType === 'code' ? 0.18 : 0.12),
    '--code-card-face-tag-fill': `hsl(${baseHue} 86% 96% / 0.82)`,
    '--code-card-face-tag-border': `hsl(${accentHue} 48% 72% / 0.24)`,
    '--code-card-face-tag-color': `hsl(${(baseHue + 18) % 360} 30% 34% / 0.78)`,
    '--code-card-face-meta-fill': `hsl(${baseHue} 84% 97% / 0.82)`,
    '--code-card-face-meta-color': `hsl(${(baseHue + 18) % 360} 18% 42% / 0.76)`,
    '--code-card-face-preview-opacity': formatAlpha(faceType === 'text' ? 0.68 : 0.78),
    '--code-card-face-title-color': `hsl(${(baseHue + 22) % 360} 22% 21% / 0.96)`
  };
}

export function normalizeCodeCardFaceCss(cssText: string | null | undefined) {
  if (typeof cssText !== 'string') return undefined;
  const normalized = cssText.trim();
  if (!normalized) return undefined;
  if (REMOTE_URL_PATTERN.test(normalized) || REMOTE_IMPORT_PATTERN.test(normalized)) {
    return undefined;
  }
  return normalized;
}

export function buildScopedCodeCardFaceCss(
  cardId: string,
  cssText: string | null | undefined,
  rootScope = DEFAULT_CODE_CARD_FACE_ROOT_SCOPE
) {
  const normalizedCss = normalizeCodeCardFaceCss(cssText);
  if (!normalizedCss) return '';

  const rootSelector = `${rootScope} [data-polaris-card-id="${cardId.replace(/"/g, '\\"')}"]`;
  const source = normalizedCss.includes('{')
    ? normalizedCss.replace(/&/g, rootSelector)
    : `& { ${normalizedCss} }`.replace(/&/g, rootSelector);
  if (source.includes('@')) {
    return source.trim();
  }

  const rules: string[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of source.matchAll(rulePattern)) {
    const selectorText = match[1]?.trim();
    const declarationText = match[2]?.trim();
    if (!selectorText || !declarationText) continue;

    const selectors = selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => (
        selector.includes(rootSelector)
          ? selector
          : `${rootSelector} ${selector}`
      ));

    const sanitizedDeclarations = sanitizeCardFaceDeclarations(declarationText);
    if (!sanitizedDeclarations) continue;

    rules.push(`${selectors.join(', ')} {\n${sanitizedDeclarations};\n}`);
  }

  return rules.join('\n\n');
}
