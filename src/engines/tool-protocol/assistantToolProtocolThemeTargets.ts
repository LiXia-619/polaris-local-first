import {
  normalizeThemeCoordinateSurfaceRefs
} from '../theme-coordinate/themeCoordinateStableAction';
import {
  THEME_COORDINATE_SURFACE_CODE,
  THEME_COORDINATE_SURFACE_LABEL,
  THEME_COORDINATE_SURFACES
} from '../theme-coordinate/themeCoordinateSurfaceMeta';

export type StableThemeTargets = 'all' | string[];

const ALL_THEME_TARGET_ALIASES = new Set([
  'all',
  'app',
  'global',
  'whole',
  '全部',
  '整页',
  '整体',
  '全局',
  '整个应用',
  '整个app'
]);

function normalizeTargetString(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTargetCodes(values: string[]) {
  return normalizeThemeCoordinateSurfaceRefs(values).map((surface) => THEME_COORDINATE_SURFACE_CODE[surface]);
}

export function isAllThemeTargetValue(value: unknown) {
  return typeof value === 'string' && ALL_THEME_TARGET_ALIASES.has(normalizeTargetString(value));
}

export function normalizeStableThemeTargets(value: unknown): StableThemeTargets | null {
  if (isAllThemeTargetValue(value)) {
    return 'all';
  }

  if (typeof value === 'string') {
    const codes = normalizeTargetCodes([value]);
    return codes.length ? codes : null;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.filter((item): item is string => typeof item === 'string');
  if (items.some((item) => isAllThemeTargetValue(item))) {
    return 'all';
  }

  const codes = normalizeTargetCodes(items);
  return codes.length ? codes : null;
}

export function buildStableThemeTargetLegendLines() {
  return [`编号地图：${THEME_COORDINATE_SURFACES.map((surface) =>
    `${THEME_COORDINATE_SURFACE_CODE[surface]}=${THEME_COORDINATE_SURFACE_LABEL[surface]}`
  ).join(' · ')}`];
}
