import {
  THEME_SURFACE_REGISTRY,
  type ThemeCoordinateSurface
} from '../../config/theme/themeSurfaceRegistry';

export { type ThemeCoordinateSurface } from '../../config/theme/themeSurfaceRegistry';

export const THEME_COORDINATE_SURFACES = THEME_SURFACE_REGISTRY.map((entry) => entry.surface) as ThemeCoordinateSurface[];

function buildSurfaceRecord<K extends 'prefix' | 'label' | 'code' | 'aiLabel'>(key: K) {
  return Object.fromEntries(
    THEME_SURFACE_REGISTRY.map((entry) => [entry.surface, entry[key]])
  ) as Record<ThemeCoordinateSurface, (typeof THEME_SURFACE_REGISTRY)[number][K]>;
}

export const THEME_COORDINATE_SURFACE_PREFIX = buildSurfaceRecord('prefix');
export const THEME_COORDINATE_SURFACE_LABEL = buildSurfaceRecord('label');
export const THEME_COORDINATE_SURFACE_CODE = buildSurfaceRecord('code');
export const THEME_COORDINATE_SURFACE_AI_LABEL = buildSurfaceRecord('aiLabel');
