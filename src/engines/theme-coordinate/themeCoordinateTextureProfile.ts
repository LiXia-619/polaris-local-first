import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';

export const TACTILE_TEXTURE_LABELS = ['paper', 'paper-fiber', 'washi-paper', 'linen', 'fabric', 'leather'] as const;

export function isTactileTextureLabel(textureLabel: string) {
  return (TACTILE_TEXTURE_LABELS as readonly string[]).includes(textureLabel);
}

export function resolveTextureLabel(meaning: number, emotion: number) {
  if (emotion >= 7 && meaning <= -1) return 'pearlescent';
  if (emotion <= -5 && meaning <= 0) return 'powder-dust';
  if (emotion >= 6 && meaning <= 2) return 'candy-film';
  if (meaning <= -7) return 'glass';
  if (meaning <= -3 && emotion >= -1 && emotion <= 5) return 'wash-cloud';
  if (meaning <= -2) return 'frosted-glass';
  if (meaning <= 1 && emotion <= 3) return 'paper-fiber';
  if (meaning <= 3 && emotion >= 3) return 'washi-paper';
  if (meaning <= 4) return emotion <= 0 ? 'linen' : 'paper';
  if (meaning <= 7) return emotion <= 1 ? 'linen' : 'fabric';
  return 'leather';
}

function pickAiryVariant(seed: number, surface: ThemeCoordinateSurface, span: number) {
  return Math.abs(seed * 17 + surface.length * 13) % span;
}

function isBackgroundFamilySurface(surface: ThemeCoordinateSurface) {
  return surface === 'background' || surface === 'topbar';
}

function isBubbleFamilySurface(surface: ThemeCoordinateSurface) {
  return surface === 'chat-user-bubble' || surface === 'chat-ai-bubble';
}

function isExpressiveFlowerMist(meaning: number, emotion: number) {
  return meaning <= -7 && emotion >= 8;
}

export function resolveSurfaceTextureLabel(args: {
  surface: ThemeCoordinateSurface;
  meaning: number;
  emotion: number;
  seed: number;
}) {
  const { surface, meaning, emotion, seed } = args;
  if (emotion >= 5 && meaning >= 0 && meaning <= 4) {
    const variant = pickAiryVariant(seed, surface, 4);
    if (isBackgroundFamilySurface(surface)) {
      return ['candy-film', 'pearlescent', 'frosted-glass', 'wash-cloud'][variant]!;
    }
    if (isBubbleFamilySurface(surface)) {
      return ['frosted-glass', 'wash-cloud', 'candy-film', 'pearlescent'][variant]!;
    }
    return ['frosted-glass', 'wash-cloud', 'candy-film', 'pearlescent'][variant]!;
  }
  if (meaning >= 0) return resolveTextureLabel(meaning, emotion);

  const variant = pickAiryVariant(seed, surface, 4);
  if (isExpressiveFlowerMist(meaning, emotion)) {
    if (isBackgroundFamilySurface(surface)) {
      return ['pearlescent', 'candy-film', 'pearlescent', 'frosted-glass'][variant]!;
    }
    if (isBubbleFamilySurface(surface)) {
      return ['wash-cloud', 'frosted-glass', 'wash-cloud', 'pearlescent'][variant]!;
    }
    return ['frosted-glass', 'wash-cloud', 'pearlescent', 'candy-film'][variant]!;
  }
  if (meaning <= -5 && emotion >= 6) {
    if (isBackgroundFamilySurface(surface)) {
      return ['pearlescent', 'candy-film', 'wash-cloud', 'frosted-glass'][variant]!;
    }
    if (isBubbleFamilySurface(surface)) {
      return ['candy-film', 'pearlescent', 'frosted-glass', 'wash-cloud'][variant]!;
    }
    return ['wash-cloud', 'frosted-glass', 'candy-film', 'pearlescent'][variant]!;
  }
  if (meaning <= -6 && emotion <= 0) {
    if (isBackgroundFamilySurface(surface)) {
      return ['glass', 'wash-cloud', 'powder-dust', 'frosted-glass'][variant]!;
    }
    if (isBubbleFamilySurface(surface)) {
      return ['wash-cloud', 'glass', 'frosted-glass', 'powder-dust'][variant]!;
    }
    return ['frosted-glass', 'wash-cloud', 'glass', 'powder-dust'][variant]!;
  }
  if (meaning <= -2) {
    if (isBackgroundFamilySurface(surface)) {
      return ['wash-cloud', 'frosted-glass', 'powder-dust', 'glass'][variant]!;
    }
    if (isBubbleFamilySurface(surface)) {
      return ['frosted-glass', 'wash-cloud', 'glass', 'powder-dust'][variant]!;
    }
    return ['wash-cloud', 'frosted-glass', 'glass', 'powder-dust'][variant]!;
  }

  return resolveTextureLabel(meaning, emotion);
}

export function resolveEdgeLabel(meaning: number, emotion: number) {
  if (meaning <= -6) return emotion >= 4 ? 'halo-mist' : 'soft-mist';
  if (meaning <= -2) return emotion >= 4 ? 'mist-cut' : 'mist-shell';
  if (meaning <= 2) return emotion >= 5 ? 'candy-cut' : 'paper-soft';
  if (meaning <= 7) return emotion >= 4 ? 'stitched-solid' : 'lined-solid';
  return emotion >= 4 ? 'dense-solid' : 'rounded-solid';
}

export function resolveSurfaceEdgeLabel(args: {
  surface: ThemeCoordinateSurface;
  meaning: number;
  emotion: number;
  seed: number;
}) {
  const { surface, meaning, emotion, seed } = args;
  if (emotion >= 5 && meaning >= 0 && meaning <= 4) {
    const variant = pickAiryVariant(seed + 3, surface, 3);
    return isBackgroundFamilySurface(surface)
      ? (['halo-mist', 'mist-cut', 'candy-cut'][variant]!)
      : (['mist-cut', 'candy-cut', 'halo-mist'][variant]!);
  }
  if (meaning >= 0) return resolveEdgeLabel(meaning, emotion);

  const variant = pickAiryVariant(seed + 3, surface, 3);
  if (isExpressiveFlowerMist(meaning, emotion)) {
    return isBackgroundFamilySurface(surface)
      ? (['halo-mist', 'mist-cut', 'halo-mist'][variant]!)
      : (['mist-cut', 'halo-mist', 'mist-cut'][variant]!);
  }
  if (meaning <= -5 && emotion >= 5) {
    return isBackgroundFamilySurface(surface)
      ? (['halo-mist', 'mist-cut', 'soft-mist'][variant]!)
      : (['mist-cut', 'halo-mist', 'mist-shell'][variant]!);
  }
  if (meaning <= -3) {
    return isBubbleFamilySurface(surface)
      ? (['mist-shell', 'mist-cut', 'soft-mist'][variant]!)
      : (['soft-mist', 'mist-shell', 'mist-cut'][variant]!);
  }
  return resolveEdgeLabel(meaning, emotion);
}

export function resolveOrnamentLabel(meaning: number, emotion: number) {
  if (emotion <= -4) return 'quiet';
  if (emotion <= 1) return meaning <= -2 ? 'sheen' : 'grain';
  if (meaning <= -3) return emotion >= 6 ? 'prism-halo' : 'prism';
  if (meaning <= 3) return emotion >= 5 ? 'confetti' : 'dot-grid';
  return meaning <= 7 ? 'stitched' : 'banded';
}

export function resolveSurfaceOrnamentLabel(args: {
  surface: ThemeCoordinateSurface;
  meaning: number;
  emotion: number;
  seed: number;
}) {
  const { surface, meaning, emotion, seed } = args;
  if (emotion >= 5 && meaning >= 0 && meaning <= 4) {
    const variant = pickAiryVariant(seed + 9, surface, 4);
    return isBackgroundFamilySurface(surface)
      ? (['prism-halo', 'prism', 'sheen', 'prism'][variant]!)
      : (['prism', 'sheen', 'prism-halo', 'sheen'][variant]!);
  }
  if (meaning >= 0) return resolveOrnamentLabel(meaning, emotion);

  const variant = pickAiryVariant(seed + 9, surface, 4);
  if (isExpressiveFlowerMist(meaning, emotion)) {
    return isBackgroundFamilySurface(surface)
      ? (['prism-halo', 'prism', 'sheen', 'prism-halo'][variant]!)
      : (['sheen', 'prism-halo', 'prism', 'sheen'][variant]!);
  }
  if (emotion <= -4) {
    return isBackgroundFamilySurface(surface)
      ? (['quiet', 'sheen', 'quiet', 'grain'][variant]!)
      : (['quiet', 'sheen', 'grain', 'quiet'][variant]!);
  }
  if (meaning <= -4 && emotion >= 5) {
    return isBackgroundFamilySurface(surface)
      ? (['prism-halo', 'prism', 'sheen', 'prism-halo'][variant]!)
      : (['prism', 'sheen', 'prism-halo', 'confetti'][variant]!);
  }
  if (meaning <= -2) {
    return isBubbleFamilySurface(surface)
      ? (['sheen', 'prism', 'quiet', 'grain'][variant]!)
      : (['prism', 'sheen', 'grain', 'quiet'][variant]!);
  }
  return resolveOrnamentLabel(meaning, emotion);
}
