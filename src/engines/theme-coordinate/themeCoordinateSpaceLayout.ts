import {
  THEME_COORDINATE_SURFACES,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';
import {
  resolveTextureLabel
} from './themeCoordinateTextureProfile';
import { selectThemeCoordinateTraits, type ThemeCoordinateTraitMap } from './themeCoordinateTraits';
import { normalizeThemeCoordinateBaseColor, themeCoordinateBaseColorToHsl } from './themeCoordinateBaseColor';
import {
  adjustColor,
  buildThemeCoordinateBoostedSurfaces,
  buildThemeCoordinateSurfaceColor,
  buildThemeCoordinateSurfaceSpec,
  hsl,
  resolveThemeCoordinateEffectiveEmotion,
  resolveThemeCoordinateSurfaceBaseColorOverride
} from './themeCoordinateSurfaceBuilder';
import {
  clamp,
  wrapHue
} from './themeCoordinateMath';
import {
  resolveThemeCoordinateStyleFamily,
  type ThemeCoordinateStyleFamily
} from './themeCoordinateStyleFamily';
import {
  restraintStrength,
  resolveAiryBubbleSeparationStrength,
  resolveSampledSemanticState,
  resolveExpressiveAiryProminence,
  emotionToSaturation
} from './themeCoordinateSemantics';
import type {
  BaseColor,
  ThemeCoordinateState,
  ThemeCoordinateSurfaceSpec
} from './themeCoordinateTypes';

export { THEME_COORDINATE_SURFACES, type ThemeCoordinateSurface } from './themeCoordinateSurfaceMeta';
export { type BaseColor, type ThemeCoordinateState, type ThemeCoordinateSurfaceSpec } from './themeCoordinateTypes';
export {
  restraintStrength,
  resolveSampledSemanticState,
  emotionToSaturation,
  resolveAiryBubbleSeparationStrength,
  resolveExpressiveAiryProminence
} from './themeCoordinateSemantics';
export { adjustColor, hsl } from './themeCoordinateSurfaceBuilder';

export type ThemeCoordinateSpaceLayout = {
  normalizedState: ThemeCoordinateState;
  resolvedState: ThemeCoordinateState;
  specs: Record<ThemeCoordinateSurface, ThemeCoordinateSurfaceSpec>;
  boostedSurfaces: ThemeCoordinateSurface[];
  surfaceTraits: ThemeCoordinateTraitMap;
  styleFamily: ThemeCoordinateStyleFamily;
  backgroundColor: BaseColor;
  cardColor: BaseColor;
  shellRestraint: number;
};

export function buildThemeCoordinateSpaceLayout(
  state: ThemeCoordinateState,
  options?: { forcedTraits?: ThemeCoordinateTraitMap }
): ThemeCoordinateSpaceLayout {
  const normalizedState = {
    hue: wrapHue(state.hue),
    hueCount: clamp(Math.round(state.hueCount), 1, 9),
    emotion: clamp(state.emotion, -10, 10),
    meaning: clamp(state.meaning, -10, 10),
    seed: state.seed,
    baseColor: normalizeThemeCoordinateBaseColor(state.baseColor)
  } satisfies ThemeCoordinateState;
  const resolvedState = resolveSampledSemanticState(normalizedState);
  const styleFamily = resolveThemeCoordinateStyleFamily(normalizedState);
  const baseColorOverride = themeCoordinateBaseColorToHsl(normalizedState.baseColor);
  const boostedSurfaces = buildThemeCoordinateBoostedSurfaces(normalizedState);
  const autoTraits = selectThemeCoordinateTraits({
    emotion: resolvedState.emotion,
    meaning: resolvedState.meaning,
    seed: resolvedState.seed,
    boostedSurfaces,
    styleFamily
  });
  const surfaceTraits = {
    ...autoTraits,
    ...(options?.forcedTraits ?? {})
  } satisfies ThemeCoordinateTraitMap;
  const backgroundEmotion = resolveThemeCoordinateEffectiveEmotion('background', resolvedState.emotion, boostedSurfaces);
  const backgroundTexture = resolveTextureLabel(resolvedState.meaning, backgroundEmotion);
  const backgroundColor = buildThemeCoordinateSurfaceColor(
    resolvedState.hue,
    backgroundEmotion,
    resolvedState.meaning,
    'background',
    backgroundTexture,
    null
  ).color;
  const airyBubbleSeparation = resolveAiryBubbleSeparationStrength({
    meaning: resolvedState.meaning,
    hueCount: normalizedState.hueCount,
    backgroundColor,
    backgroundTextureLabel: backgroundTexture
  });
  const specs = Object.fromEntries(
    THEME_COORDINATE_SURFACES.map((surface) => [
      surface,
      buildThemeCoordinateSurfaceSpec({
        surface,
        styleFamily,
        ...resolvedState,
        requestedEmotion: normalizedState.emotion,
        requestedMeaning: normalizedState.meaning,
        boostedSurfaces,
        airyBubbleSeparation,
        baseColorOverride
      })
    ])
  ) as Record<ThemeCoordinateSurface, ThemeCoordinateSurfaceSpec>;
  const cardEmotion = resolveThemeCoordinateEffectiveEmotion('card', resolvedState.emotion, boostedSurfaces);
  const cardTexture = resolveTextureLabel(resolvedState.meaning, cardEmotion);
  const cardColor = buildThemeCoordinateSurfaceColor(
    resolvedState.hue,
    cardEmotion,
    resolvedState.meaning,
    'card',
    cardTexture,
    resolveThemeCoordinateSurfaceBaseColorOverride({
      surface: 'card',
      meaning: normalizedState.meaning,
      textureLabel: cardTexture,
      baseColorOverride
    })
  ).color;

  return {
    normalizedState,
    resolvedState,
    specs,
    boostedSurfaces,
    surfaceTraits,
    styleFamily,
    backgroundColor,
    cardColor,
    shellRestraint: restraintStrength(resolvedState.emotion, resolvedState.meaning)
  };
}
