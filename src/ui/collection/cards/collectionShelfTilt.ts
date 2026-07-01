import type { CSSProperties } from 'react';

const COLLECTION_CARD_TILT_VARIANTS = [
  { tilt: -1.62, liftTilt: -0.48 },
  { tilt: 1.34, liftTilt: 0.42 },
  { tilt: -0.92, liftTilt: -0.2 },
  { tilt: 1.74, liftTilt: 0.54 },
  { tilt: -1.18, liftTilt: -0.32 },
  { tilt: 0.58, liftTilt: 0.16 },
  { tilt: -0.38, liftTilt: -0.06 },
  { tilt: 1.02, liftTilt: 0.24 }
] as const;

function hashTiltSeed(seed: number | string) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed));
  }

  let hash = 0;
  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function formatTilt(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}deg`;
}

type ResolveCollectionCardTiltOptions = {
  scale?: number;
};

export function resolveCollectionCardTiltStyle(
  seed: number | string,
  options: ResolveCollectionCardTiltOptions = {}
) {
  const hash = hashTiltSeed(seed);
  const scale = options.scale ?? 1;
  const variant = COLLECTION_CARD_TILT_VARIANTS[hash % COLLECTION_CARD_TILT_VARIANTS.length];
  return {
    '--collection-card-tilt': formatTilt(variant.tilt * scale),
    '--collection-card-lift-tilt': formatTilt(variant.liftTilt * scale)
  } as CSSProperties;
}
