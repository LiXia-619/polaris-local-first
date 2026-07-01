import {
  THEME_COORDINATE_SURFACE_CODE,
  THEME_COORDINATE_SURFACE_LABEL
} from './themeCoordinateSurfaceMeta';
import { describeThemeCoordinateTrait, type ThemeCoordinateTraitMap } from './themeCoordinateTraits';
import { describeThemeCoordinateStyleFamily } from './themeCoordinateStyleFamily';
import {
  buildThemeCoordinateSpaceLayout,
  THEME_COORDINATE_SURFACES,
  type ThemeCoordinateState,
  type ThemeCoordinateSurface
} from './themeCoordinateSpaceLayout';
import { buildThemeCoordinateStyleVars } from './themeCoordinateSpaceVars';

export { THEME_COORDINATE_SURFACES, type ThemeCoordinateState, type ThemeCoordinateSurface } from './themeCoordinateSpaceLayout';

export function buildThemeCoordinatePreview(
  state: ThemeCoordinateState,
  options?: { forcedTraits?: ThemeCoordinateTraitMap }
) {
  const layout = buildThemeCoordinateSpaceLayout(state, options);

  return {
    state: layout.normalizedState,
    resolvedState: layout.resolvedState,
    styleFamily: layout.styleFamily,
    styleFamilyLabel: describeThemeCoordinateStyleFamily(layout.styleFamily),
    styleVars: buildThemeCoordinateStyleVars(layout),
    surfaceSpecs: layout.specs,
    boostedSurfaces: layout.boostedSurfaces,
    surfaceTraits: layout.surfaceTraits,
    surfaceDetails: THEME_COORDINATE_SURFACES.map((surface) => ({
      key: surface,
      code: THEME_COORDINATE_SURFACE_CODE[surface],
      label: THEME_COORDINATE_SURFACE_LABEL[surface],
      boosted: layout.boostedSurfaces.includes(surface),
      styleFamily: layout.specs[surface].styleFamily,
      styleFamilyLabel: describeThemeCoordinateStyleFamily(layout.specs[surface].styleFamily),
      textureLabel: layout.specs[surface].textureLabel,
      edgeLabel: layout.specs[surface].edgeLabel,
      ornamentLabel: layout.specs[surface].ornamentLabel,
      gradientLabel: layout.specs[surface].gradientLabel,
      traitLabel: describeThemeCoordinateTrait(layout.surfaceTraits[surface])
    }))
  };
}

export type ThemeCoordinatePreview = ReturnType<typeof buildThemeCoordinatePreview>;
export type ThemeCoordinatePreviewTraits = ThemeCoordinateTraitMap;
