type HslColor = {
  h: number;
  s: number;
  l: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function expandHex(hex: string) {
  if (hex.length === 3) {
    return hex.split('').map((char) => `${char}${char}`).join('');
  }
  return hex.length === 6 ? hex : null;
}

export function normalizeThemeCoordinateBaseColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const bare = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(bare)) return undefined;
  const expanded = expandHex(bare);
  return expanded ? `#${expanded.toLowerCase()}` : undefined;
}

function rgbToHsl(red: number, green: number, blue: number): HslColor {
  const r = clamp(red, 0, 255) / 255;
  const g = clamp(green, 0, 255) / 255;
  const b = clamp(blue, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);

  let hue = 0;
  switch (max) {
    case r:
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g:
      hue = (b - r) / delta + 2;
      break;
    default:
      hue = (r - g) / delta + 4;
      break;
  }

  return {
    h: hue * 60,
    s: saturation * 100,
    l: lightness * 100
  };
}

export function themeCoordinateBaseColorToHsl(value?: string): HslColor | null {
  const normalized = normalizeThemeCoordinateBaseColor(value);
  if (!normalized) return null;
  const hex = normalized.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return rgbToHsl(red, green, blue);
}
