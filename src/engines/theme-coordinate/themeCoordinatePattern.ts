import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';

type PatternArgs = {
  textureLabel: string;
  surface: ThemeCoordinateSurface;
  seed: number;
  textureSoft: (alpha: number) => string;
  textureDark: (alpha: number) => string;
  textureTint: (alpha: number) => string;
  textureAccent: (alpha: number) => string;
  textureSpan: number;
  lineGap: number;
};

function pickVariant(args: { seed: number; surface: ThemeCoordinateSurface; textureLabel: string }) {
  const { seed, surface, textureLabel } = args;
  return (seed + surface.length * 3 + textureLabel.length) % 5;
}

export function buildTexturePatternOverlay(args: PatternArgs) {
  const { textureLabel, surface, seed, textureSoft, textureDark, textureTint, textureAccent, textureSpan, lineGap } = args;
  const variant = pickVariant({ seed, surface, textureLabel });

  if (textureLabel === 'powder-dust') {
    return `radial-gradient(circle at 18% 24%, ${textureTint(0.12)} 0 1px, transparent 1px 16px), radial-gradient(circle at 72% 68%, ${textureSoft(0.08)} 0 1px, transparent 1px 18px), radial-gradient(circle at 44% 42%, ${textureDark(0.05)} 0 1px, transparent 1px 20px)`;
  }

  if (textureLabel === 'pearlescent') {
    return `linear-gradient(${variant % 2 === 0 ? '115deg' : '65deg'}, ${textureAccent(0.18)}, transparent 38%, ${textureTint(0.1)} 62%, transparent 84%), repeating-linear-gradient(${variant % 2 === 0 ? '135deg' : '45deg'}, ${textureSoft(0.06)} 0 1px, transparent 1px ${Math.round(textureSpan * 0.9)}px)`;
  }

  if (textureLabel === 'paper' || textureLabel === 'paper-fiber') {
    if (variant === 0) {
      return `repeating-linear-gradient(0deg, ${textureSoft(0.05)} 0 1px, transparent 1px ${Math.round(lineGap)}px)`;
    }
    if (variant === 1) {
      return `repeating-linear-gradient(90deg, ${textureSoft(0.038)} 0 1px, transparent 1px ${Math.round(lineGap * 1.8)}px)`;
    }
    if (variant === 2) {
      return `repeating-linear-gradient(0deg, ${textureSoft(0.045)} 0 1px, transparent 1px ${Math.round(lineGap * 1.15)}px), repeating-linear-gradient(90deg, ${textureSoft(0.024)} 0 1px, transparent 1px ${Math.round(lineGap * 2.2)}px)`;
    }
    if (variant === 3) {
      return `repeating-linear-gradient(45deg, ${textureTint(0.044)} 0 1px, transparent 1px ${Math.round(textureSpan)}px)`;
    }
    return `repeating-linear-gradient(45deg, ${textureSoft(0.036)} 0 1px, transparent 1px ${Math.round(textureSpan)}px), repeating-linear-gradient(-45deg, ${textureTint(0.024)} 0 1px, transparent 1px ${Math.round(textureSpan * 1.05)}px)`;
  }

  if (textureLabel === 'fabric') {
    if (variant <= 1) {
      return `repeating-linear-gradient(45deg, ${textureSoft(0.07)} 0 2px, transparent 2px ${Math.round(textureSpan * 0.72)}px), repeating-linear-gradient(-45deg, ${textureDark(0.05)} 0 2px, transparent 2px ${Math.round(textureSpan * 0.72)}px)`;
    }
    if (variant === 2) {
      return `repeating-linear-gradient(0deg, ${textureSoft(0.05)} 0 2px, transparent 2px ${Math.round(textureSpan * 0.88)}px), repeating-linear-gradient(90deg, ${textureAccent(0.04)} 0 1px, transparent 1px ${Math.round(textureSpan * 0.94)}px)`;
    }
    return `repeating-linear-gradient(45deg, ${textureTint(0.054)} 0 1px, transparent 1px ${Math.round(textureSpan * 0.8)}px)`;
  }

  if (textureLabel === 'linen') {
    return `repeating-linear-gradient(0deg, ${textureTint(0.042)} 0 1px, transparent 1px ${Math.round(lineGap * 1.14)}px), repeating-linear-gradient(90deg, ${textureDark(0.026)} 0 1px, transparent 1px ${Math.round(lineGap * 1.36)}px)`;
  }

  if (textureLabel === 'washi-paper') {
    return `repeating-linear-gradient(${variant <= 1 ? '90deg' : variant === 2 ? '45deg' : '-45deg'}, ${variant === 0 ? textureAccent(0.08) : textureTint(0.07)} 0 2px, transparent 2px ${Math.round(textureSpan * 0.92)}px), repeating-linear-gradient(0deg, ${textureDark(0.03)} 0 1px, transparent 1px ${Math.round(lineGap * 1.4)}px)`;
  }

  if (textureLabel === 'candy-film') {
    return `repeating-linear-gradient(${variant % 2 === 0 ? '135deg' : '45deg'}, ${variant <= 1 ? textureAccent(0.12) : textureTint(0.1)} 0 2px, transparent 2px ${Math.round(textureSpan)}px)`;
  }

  if (textureLabel === 'leather') {
    if (variant <= 1) {
      return `repeating-linear-gradient(0deg, ${textureDark(0.08)} 0 1px, transparent 1px ${Math.round(lineGap * 1.5)}px), linear-gradient(135deg, ${textureTint(0.06)}, transparent 44%)`;
    }
    if (variant === 2) {
      return `repeating-linear-gradient(90deg, ${textureDark(0.06)} 0 1px, transparent 1px ${Math.round(textureSpan * 1.2)}px), repeating-linear-gradient(0deg, ${textureAccent(0.04)} 0 2px, transparent 2px ${Math.round(lineGap * 1.8)}px)`;
    }
    return `linear-gradient(180deg, ${textureDark(0.08)}, transparent 34%, ${textureTint(0.05)} 68%, transparent 100%), repeating-linear-gradient(45deg, ${textureDark(0.04)} 0 1px, transparent 1px ${Math.round(textureSpan * 1.1)}px)`;
  }

  return '';
}
