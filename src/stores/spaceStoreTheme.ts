import {
  DEFAULT_THEME_PRESET_ID,
  buildThemeFrameFromPresetId,
  getThemePresetById
} from '../config/theme/themePresets';
import { createUid } from '../engines/id';
import {
  THEME_COORDINATE_SURFACES,
  THEME_COORDINATE_SURFACE_CODE
} from '../engines/theme-coordinate/themeCoordinateSurfaceMeta';
import { normalizeThemeCoordinateSurfaceCode } from '../engines/theme-coordinate/themeCoordinateSurfaceTokens';
import type { SavedSkin, SkinSnapshot, ThemeFrame, ThemeState, ThemeVariables } from '../types/domain';

export function snapshotTheme(frame: ThemeFrame, label: string): SkinSnapshot {
  return {
    id: createUid('skin'),
    label,
    sourcePresetId: frame.activePresetId,
    sourceSavedSkinId: frame.activeSavedSkinId,
    createdAt: Date.now(),
    cssVariables: { ...frame.cssVariables },
    presetCSS: frame.presetCSS,
    customCSS: frame.customCSS,
    generatedCSS: frame.generatedCSS,
    recipe: frame.recipe ? { ...frame.recipe } : undefined
  };
}

export function restoreThemeFrame(snapshot: SkinSnapshot): ThemeFrame {
  return {
    activePresetId: snapshot.sourcePresetId,
    activeSavedSkinId: snapshot.sourceSavedSkinId,
    cssVariables: { ...snapshot.cssVariables },
    presetCSS: snapshot.presetCSS,
    customCSS: snapshot.customCSS,
    generatedCSS: snapshot.generatedCSS,
    recipe: snapshot.recipe ? { ...snapshot.recipe } : undefined
  };
}

export function savedSkinToThemeFrame(savedSkin: SavedSkin): ThemeFrame {
  return {
    activePresetId: savedSkin.sourcePresetId,
    activeSavedSkinId: savedSkin.id,
    cssVariables: { ...savedSkin.cssVariables },
    presetCSS: savedSkin.presetCSS,
    customCSS: savedSkin.customCSS,
    generatedCSS: savedSkin.generatedCSS,
    recipe: savedSkin.recipe ? { ...savedSkin.recipe } : undefined
  };
}

export function areThemeVariablesEqual(left: ThemeVariables, right: ThemeVariables): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

const HISTORY_LIMIT = 15;
export const ALL_THEME_SURFACE_CODES = THEME_COORDINATE_SURFACES.map((surface) => THEME_COORDINATE_SURFACE_CODE[surface]);

export function normalizeSelectedSurfaceCodes(
  selectedSurfaceCodes?: string[],
  options?: { fallbackToAll?: boolean }
) {
  const normalized = Array.from(new Set(
    (Array.isArray(selectedSurfaceCodes) ? selectedSurfaceCodes : [])
      .map((code) => normalizeThemeCoordinateSurfaceCode(code))
      .filter((code): code is string => Boolean(code))
  ));
  if (normalized.length > 0) return normalized;
  return options?.fallbackToAll ? [...ALL_THEME_SURFACE_CODES] : [];
}

export function createInitialThemeState(): ThemeState {
  const frame = buildThemeFrameFromPresetId(DEFAULT_THEME_PRESET_ID);
  return {
    ...frame,
    toolMode: 'stable',
    selectedSurfaceCodes: [],
    savedSkins: [],
    skinHistory: [],
    patchLedger: []
  };
}

export function toThemeFrame(theme: ThemeState): ThemeFrame {
  return {
    activePresetId: theme.activePresetId,
    activeSavedSkinId: theme.activeSavedSkinId,
    cssVariables: { ...theme.cssVariables },
    presetCSS: theme.presetCSS,
    customCSS: theme.customCSS,
    generatedCSS: theme.generatedCSS,
    recipe: theme.recipe ? { ...theme.recipe } : undefined
  };
}

export function applyThemeFrame(theme: ThemeState, frame: ThemeFrame): ThemeState {
  return {
    ...theme,
    activePresetId: frame.activePresetId,
    activeSavedSkinId: frame.activeSavedSkinId,
    cssVariables: { ...frame.cssVariables },
    presetCSS: frame.presetCSS,
    customCSS: frame.customCSS,
    generatedCSS: frame.generatedCSS,
    recipe: frame.recipe ? { ...frame.recipe } : undefined
  };
}

export function resolveSavedSkinId(savedSkins: SavedSkin[], savedSkinId: string | null): string | null {
  if (!savedSkinId) return null;
  return savedSkins.some((savedSkin) => savedSkin.id === savedSkinId) ? savedSkinId : null;
}

export function themeLabel(theme: ThemeState): string {
  const activeSavedSkin = theme.activeSavedSkinId
    ? theme.savedSkins.find((savedSkin) => savedSkin.id === theme.activeSavedSkinId) ?? null
    : null;

  if (activeSavedSkin) return activeSavedSkin.name;

  const activePreset = getThemePresetById(theme.activePresetId);
  if (!activePreset) {
    return theme.customCSS.trim() || theme.generatedCSS.trim() ? '纯自定义皮肤' : '纯自定义底座';
  }

  const purePreset =
    !theme.activeSavedSkinId &&
    !theme.customCSS.trim() &&
    !theme.generatedCSS.trim() &&
    theme.presetCSS === activePreset.css &&
    areThemeVariablesEqual(theme.cssVariables, activePreset.cssVariables);

  return purePreset ? activePreset.name : `${activePreset.name} · 手调中`;
}

export function withSnapshot(theme: ThemeState, label?: string) {
  return [snapshotTheme(toThemeFrame(theme), label ?? themeLabel(theme)), ...theme.skinHistory].slice(0, HISTORY_LIMIT);
}

export function normalizeFrame(theme: ThemeState, frame: ThemeFrame): ThemeFrame {
  return {
    activePresetId: frame.activePresetId,
    activeSavedSkinId: resolveSavedSkinId(theme.savedSkins, frame.activeSavedSkinId),
    cssVariables: { ...frame.cssVariables },
    presetCSS: frame.presetCSS,
    customCSS: frame.customCSS,
    generatedCSS: frame.generatedCSS,
    recipe: frame.recipe ? { ...frame.recipe } : undefined
  };
}
