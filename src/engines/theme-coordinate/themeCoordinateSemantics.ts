import type { ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
import type { BaseColor, ThemeCoordinateState } from './themeCoordinateTypes';
import { clamp, lerp } from './themeCoordinateMath';

export function normalizeSigned(value: number) {
  return (clamp(value, -10, 10) + 10) / 20;
}

export function restraintStrength(emotion: number, meaning: number) {
  return clamp((-emotion + Math.max(0, meaning - 1) * 0.55) / 10, 0, 1);
}

function seededSignedUnit(seed: number, salt: number) {
  let next = (seed * 131 + salt * 977 + 0x6D2B79F5) >>> 0;
  next += 0x6D2B79F5;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

function semanticSamplingRadius(value: number) {
  return lerp(0.92, 0.22, Math.pow(Math.abs(clamp(value, -10, 10)) / 10, 1.2));
}

function curveSigned(value: number, power: number) {
  const normalized = clamp(value, -10, 10) / 10;
  return Math.sign(normalized) * Math.pow(Math.abs(normalized), power) * 10;
}

export function resolveSampledSemanticState(state: ThemeCoordinateState) {
  const emotionRadius = semanticSamplingRadius(state.emotion) * lerp(1, 0.78, Math.abs(clamp(state.meaning, -10, 10)) / 10);
  const meaningRadius = semanticSamplingRadius(state.meaning) * lerp(1, 0.78, Math.abs(clamp(state.emotion, -10, 10)) / 10);
  return {
    ...state,
    emotion: clamp(state.emotion + seededSignedUnit(state.seed || 1, 17) * emotionRadius, -10, 10),
    meaning: clamp(state.meaning + seededSignedUnit(state.seed || 1, 31) * meaningRadius, -10, 10)
  } satisfies ThemeCoordinateState;
}

export function emotionToSaturation(emotion: number, meaning: number) {
  const normalizedEmotion = clamp(emotion, -10, 10) / 10;
  const positive = Math.max(0, normalizedEmotion);
  const negative = Math.max(0, -normalizedEmotion);
  const base =
    10
    + lerp(0, 18, Math.pow(1 - negative, 1.5))
    + lerp(0, 42, Math.pow(positive, 2.25));
  const restraint = restraintStrength(emotion, meaning);
  return clamp(base - lerp(0, 24, restraint), 6, 72);
}

function meaningToLightness(meaning: number) {
  const curvedMeaning = curveSigned(meaning, 1.26);
  if (curvedMeaning <= -6) return lerp(88, 76, (curvedMeaning + 10) / 4);
  if (curvedMeaning < 0) return lerp(76, 58, (curvedMeaning + 6) / 6);
  if (curvedMeaning <= 6) return lerp(54, 38, curvedMeaning / 6);
  return lerp(38, 22, (curvedMeaning - 6) / 4);
}

export function buildThemeCoordinateBaseColor(hue: number, emotion: number, meaning: number): BaseColor {
  return {
    h: ((hue % 360) + 360) % 360,
    s: emotionToSaturation(emotion, meaning),
    l: meaningToLightness(meaning)
  };
}

export function resolveAiryBubbleSeparationStrength(args: {
  meaning: number;
  hueCount: number;
  backgroundColor: BaseColor;
  backgroundTextureLabel: string;
}) {
  const { meaning, hueCount, backgroundColor, backgroundTextureLabel } = args;
  if (meaning >= 0) return 0;

  const airy = clamp((-meaning) / 10, 0, 1);
  const grayness = clamp((34 - backgroundColor.s) / 24, 0, 1);
  const softness = clamp((backgroundColor.l - 62) / 22, 0, 1);
  const simpleField = clamp((4 - hueCount) / 3, 0, 1);
  const textureBias =
    backgroundTextureLabel === 'wash-cloud'
      ? 1
      : backgroundTextureLabel === 'frosted-glass'
        ? 0.82
        : backgroundTextureLabel === 'glass'
          ? 0.62
          : 0.34;
  const quietField = clamp(
    grayness * 0.58
    + softness * 0.16
    + simpleField * 0.12
    + textureBias * 0.14,
    0,
    1
  );

  return clamp(airy * quietField, 0, 1);
}

export function resolveExpressiveAiryProminence(args: {
  surface: ThemeCoordinateSurface;
  requestedEmotion: number;
  requestedMeaning: number;
  boostedSurfaces: ThemeCoordinateSurface[];
}) {
  const { surface, requestedEmotion, requestedMeaning, boostedSurfaces } = args;
  if (requestedMeaning > 4 || requestedEmotion < 7) return 0;

  const intensity = clamp((requestedEmotion - 6) / 4, 0, 1);
  const worldShare =
    surface === 'background'
      ? 0.88
      : boostedSurfaces.includes(surface)
        ? 0.68
        : surface === 'topbar' || surface === 'panel'
          ? 0.18
          : 0;
  const surfaceBias =
    surface === 'background'
      ? 1
      : surface === 'topbar'
        ? 0.74
        : surface === 'panel' || surface === 'composer' || surface === 'system-note'
          ? 0.58
          : surface.includes('bubble')
            ? 0.42
            : 0.46;

  return clamp(intensity * worldShare * surfaceBias, 0, 1);
}
