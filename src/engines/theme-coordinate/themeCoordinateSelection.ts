import {
  THEME_COORDINATE_SURFACE_PREFIX,
  THEME_COORDINATE_SURFACES,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';
import type { ThemeCoordinatePreview } from './themeCoordinateSpaceMapping';

const BACKGROUND_GLOBAL_KEYS = [
  '--bg',
  '--surface',
  '--surface-solid',
  '--surface-deep',
  '--border',
  '--border-hover',
  '--text',
  '--text-soft',
  '--text-muted',
  '--accent',
  '--accent-soft',
  '--accent-glow',
  '--cool-bg',
  '--cool-surface',
  '--cool-surface-solid',
  '--cool-surface-deep',
  '--cool-border',
  '--cool-border-hover',
  '--cool-text',
  '--cool-text-soft',
  '--cool-text-muted',
  '--cool-accent',
  '--cool-accent-soft',
  '--cool-accent-glow',
  '--warm-bg',
  '--warm-surface',
  '--warm-surface-solid',
  '--warm-surface-deep',
  '--warm-border',
  '--warm-border-hover',
  '--warm-text',
  '--warm-text-soft',
  '--warm-text-muted',
  '--warm-accent',
  '--warm-accent-soft',
  '--warm-accent-glow',
  '--tc-shell-glow-top',
  '--tc-shell-glow-bottom'
] as const;

const SURFACE_EXTRA_GLOBAL_KEYS: Partial<Record<ThemeCoordinateSurface, readonly string[]>> = {
  background: BACKGROUND_GLOBAL_KEYS,
  'chat-user-bubble': ['--bubble-user', '--shadow-bubble'],
  panel: ['--shadow-panel', '--radius-panel'],
  card: [
    '--card-bg',
    '--collection-card-fill',
    '--collection-card-background',
    '--collection-card-border-color',
    '--collection-card-shadow',
    '--collection-card-hover-shadow',
    '--collection-card-pinned-shadow',
    '--collection-card-surface',
    '--collection-card-surface-solid',
    '--collection-card-text',
    '--collection-card-text-soft',
    '--collection-card-text-muted',
    '--collection-card-accent',
    '--collection-card-accent-soft',
    '--collection-card-border',
    '--collection-card-border-hover',
    '--collection-card-code-strip-bg',
    '--collection-card-code-strip-opacity',
    '--collection-card-divider-bg',
    '--collection-card-thread-bg',
    '--collection-card-thread-opacity'
  ]
};

export function getThemeCoordinateSurfaceExtraGlobalKeys(surface: ThemeCoordinateSurface) {
  return [...(SURFACE_EXTRA_GLOBAL_KEYS[surface] ?? [])];
}

export function mergeThemeCoordinatePreview(args: {
  baselinePreview: ThemeCoordinatePreview;
  activePreview: ThemeCoordinatePreview;
  selectedSurfaces: ThemeCoordinateSurface[];
}) {
  const { baselinePreview, activePreview, selectedSurfaces } = args;
  const selectedSet = new Set(selectedSurfaces);
  const styleVars = { ...baselinePreview.styleVars };

  for (const surface of THEME_COORDINATE_SURFACES) {
    if (!selectedSet.has(surface)) continue;
    const prefix = `--tc-${THEME_COORDINATE_SURFACE_PREFIX[surface]}-`;
    for (const [key, value] of Object.entries(activePreview.styleVars)) {
      if (key.startsWith(prefix)) styleVars[key] = value;
    }
    for (const key of SURFACE_EXTRA_GLOBAL_KEYS[surface] ?? []) {
      styleVars[key] = activePreview.styleVars[key];
    }
  }

  return {
    ...activePreview,
    styleVars,
    surfaceTraits: Object.fromEntries(
      THEME_COORDINATE_SURFACES.map((surface) => [
        surface,
        selectedSet.has(surface) ? activePreview.surfaceTraits[surface] : baselinePreview.surfaceTraits[surface]
      ])
    ),
    surfaceDetails: THEME_COORDINATE_SURFACES.map((surface) => {
      const source = selectedSet.has(surface) ? activePreview : baselinePreview;
      const detail = source.surfaceDetails.find((item) => item.key === surface);
      return {
        ...detail!,
        selected: selectedSet.has(surface)
      };
    })
  };
}
