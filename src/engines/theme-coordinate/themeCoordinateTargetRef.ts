import { findThemeSurfaceEntryByRef } from '../../config/theme/themeSurfaceRegistry';
import {
  THEME_COORDINATE_SURFACE_LABEL,
  type ThemeCoordinateSurface
} from './themeCoordinateSurfaceMeta';

export type ThemeCoordinateTargetPart = 'base' | 'border' | 'face';

export type ThemeCoordinateTargetRef = {
  surface: ThemeCoordinateSurface;
  part?: ThemeCoordinateTargetPart;
};

const PART_LABEL: Record<ThemeCoordinateTargetPart, string> = {
  base: '底片',
  border: '边框',
  face: '卡面'
};

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function themeCoordinateTargetRefKey(ref: ThemeCoordinateTargetRef) {
  return ref.part ? `${ref.surface}.${ref.part}` : ref.surface;
}

export function themeCoordinateTargetRefLabel(ref: ThemeCoordinateTargetRef) {
  const surfaceLabel = THEME_COORDINATE_SURFACE_LABEL[ref.surface];
  return ref.part ? `${surfaceLabel}${PART_LABEL[ref.part]}` : surfaceLabel;
}

function parsePart(value?: string): ThemeCoordinateTargetPart | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'base') return 'base';
  if (normalized === 'border') return 'border';
  if (normalized === 'face') return 'face';
  return undefined;
}

function normalizeSurface(value: string): ThemeCoordinateSurface | null {
  return findThemeSurfaceEntryByRef(value)?.surface ?? null;
}

function parseSingleTargetRef(value: string): ThemeCoordinateTargetRef[] {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [];

  if (trimmed === 'bubble.border') {
    return [
      { surface: 'chat-user-bubble', part: 'border' },
      { surface: 'chat-ai-bubble', part: 'border' }
    ];
  }

  const [surfaceToken, partToken] = trimmed.split('.', 2);
  const surface = normalizeSurface(surfaceToken);
  const part = parsePart(partToken);
  if (!surface) return [];
  if (!part) return [{ surface }];
  if (surface === 'topbar' && part === 'base') return [{ surface, part }];
  if (surface === 'card' && part === 'face') return [{ surface, part }];
  if ((surface === 'chat-user-bubble' || surface === 'chat-ai-bubble') && part === 'border') {
    return [{ surface, part }];
  }
  return [{ surface }];
}

export function normalizeThemeCoordinateTargetRefs(values?: string[]) {
  const refs = (values ?? []).flatMap(parseSingleTargetRef);
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = themeCoordinateTargetRefKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeThemeCoordinateTargetRefKeys(values?: string[]) {
  return unique(normalizeThemeCoordinateTargetRefs(values).map(themeCoordinateTargetRefKey));
}

export function extractThemeCoordinateTargetSurfaces(refs?: ThemeCoordinateTargetRef[]) {
  return unique((refs ?? []).map((ref) => ref.surface));
}

export function groupThemeCoordinateTargetParts(refs?: ThemeCoordinateTargetRef[]) {
  const grouped: Partial<Record<ThemeCoordinateSurface, Set<ThemeCoordinateTargetPart>>> = {};
  for (const ref of refs ?? []) {
    if (!ref.part) continue;
    grouped[ref.surface] ??= new Set<ThemeCoordinateTargetPart>();
    grouped[ref.surface]!.add(ref.part);
  }
  return grouped;
}
