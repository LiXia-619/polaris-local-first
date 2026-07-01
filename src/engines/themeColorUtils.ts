type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value));
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, value));
}

function parseHexColor(input: string): RgbaColor | null {
  const value = input.trim().replace('#', '');
  if (![3, 4, 6, 8].includes(value.length) || /[^0-9a-f]/i.test(value)) return null;

  const normalized = value.length <= 4
    ? value.split('').map((part) => `${part}${part}`).join('')
    : value;
  const hasAlpha = normalized.length === 8;

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
    a: hasAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1
  };
}

function parseRgbChannel(input: string) {
  if (input.trim().endsWith('%')) {
    return clampChannel((Number(input.trim().slice(0, -1)) / 100) * 255);
  }
  return clampChannel(Number(input));
}

function parseRgbColor(input: string): RgbaColor | null {
  const match = input.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;

  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 4) return null;

  const [r, g, b, a] = parts;
  const rgb = [r, g, b].map(parseRgbChannel);
  if (rgb.some((value) => Number.isNaN(value))) return null;

  const alpha = a === undefined ? 1 : clampAlpha(Number(a));
  if (Number.isNaN(alpha)) return null;

  return {
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
    a: alpha
  };
}

export function parseSimpleColor(input: string | undefined): RgbaColor | null {
  if (!input) return null;
  return parseHexColor(input) ?? parseRgbColor(input);
}

function srgbToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: RgbaColor) {
  return (
    0.2126 * srgbToLinear(color.r)
    + 0.7152 * srgbToLinear(color.g)
    + 0.0722 * srgbToLinear(color.b)
  );
}

export function contrastRatio(left: RgbaColor, right: RgbaColor) {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatContrastRatio(value: number) {
  return `${value.toFixed(2)}:1`;
}

export function pickReadableTextColor(background: string | undefined) {
  const bg = parseSimpleColor(background);
  if (!bg) return undefined;

  const dark = { r: 24, g: 31, b: 42, a: 1 };
  const light = { r: 250, g: 252, b: 255, a: 1 };
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? '#181f2a' : '#fafcff';
}
