const REPLACEMENT_CHARACTER = '\uFFFD';
const GLYPH_PROBE_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/u;
const GLYPH_PROBE_FONT = '32px -apple-system, BlinkMacSystemFont, "Apple Color Emoji", "Apple Symbols", sans-serif';
const glyphSupportCache = new Map<string, boolean>();

declare global {
  interface Window {
    __POLARIS_IOS_SIMULATOR__?: boolean;
  }
}

type GraphemeSegment = { segment: string };
type IntlSegmenterLike = {
  segment: (value: string) => Iterable<GraphemeSegment>;
};
type IntlWithSegmenter = typeof Intl & {
  Segmenter?: new (locale?: string | string[], options?: { granularity?: 'grapheme' }) => IntlSegmenterLike;
};

type GlyphProbe = {
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
};

let glyphProbe: GlyphProbe | null = null;
let missingGlyphSignature: string | null = null;

function splitGraphemes(value: string) {
  const Segmenter = typeof Intl !== 'undefined' ? (Intl as IntlWithSegmenter).Segmenter : undefined;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (segment) => segment.segment);
  }
  return Array.from(value);
}

function shouldStripSimulatorEmojiGlyphs() {
  return typeof window !== 'undefined' && window.__POLARIS_IOS_SIMULATOR__ === true;
}

function hasBrokenTextMarks(value: string) {
  if (value.includes(REPLACEMENT_CHARACTER)) return true;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return true;
  }
  return false;
}

function getGlyphProbe() {
  if (glyphProbe) return glyphProbe;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.font = GLYPH_PROBE_FONT;
  context.textBaseline = 'middle';
  glyphProbe = { context, canvas };
  return glyphProbe;
}

function glyphSignature(value: string) {
  const probe = getGlyphProbe();
  if (!probe) return null;
  const { context, canvas } = probe;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = GLYPH_PROBE_FONT;
  context.fillStyle = '#000000';
  context.fillText(value, 4, 32);
  const pixels = Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
  if (pixels.every((pixel) => pixel === 0)) return null;
  return pixels.join(',');
}

function isSupportedGlyph(value: string) {
  if (!GLYPH_PROBE_PATTERN.test(value)) {
    glyphSupportCache.set(value, true);
    return true;
  }

  if (shouldStripSimulatorEmojiGlyphs()) {
    return false;
  }

  const cached = glyphSupportCache.get(value);
  if (cached !== undefined) return cached;

  const signature = glyphSignature(value);
  if (!signature) {
    glyphSupportCache.set(value, true);
    return true;
  }

  missingGlyphSignature ??= glyphSignature('\uFFFD');
  const supported = Boolean(missingGlyphSignature && signature !== missingGlyphSignature);
  glyphSupportCache.set(value, supported);
  return supported;
}

export function cleanDisplayText(value: string) {
  return splitGraphemes(value)
    .filter((segment) => !hasBrokenTextMarks(segment) && isSupportedGlyph(segment))
    .join('')
    .replace(/[ \t]{2,}/g, ' ');
}
