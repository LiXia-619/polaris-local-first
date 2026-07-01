import type { ThemeFrame } from '../types/domain';
import type {
  ActiveThemePreview,
  ThemePreviewStartResult
} from './spaceStoreTypes';
import { areThemeVariablesEqual } from './spaceStoreTheme';

export function buildThemePreviewStartResult(currentTheme: ThemeFrame): ThemePreviewStartResult {
  return {
    visibleThemeBeforeStart: {
      activePresetId: currentTheme.activePresetId,
      activeSavedSkinId: currentTheme.activeSavedSkinId,
      cssVariables: { ...currentTheme.cssVariables },
      presetCSS: currentTheme.presetCSS,
      customCSS: currentTheme.customCSS,
      generatedCSS: currentTheme.generatedCSS,
      recipe: currentTheme.recipe ? { ...currentTheme.recipe } : undefined
    }
  };
}

export function resolveExternalThemePreviewStatus(
  activePreview: ActiveThemePreview,
  nextTheme: ThemeFrame
): 'rolled_back' | 'superseded' | null {
  if (!activePreview) return null;
  const previousTheme = activePreview.before;
  const rolledBack =
    nextTheme.activePresetId === previousTheme.activePresetId &&
    nextTheme.activeSavedSkinId === previousTheme.activeSavedSkinId &&
    nextTheme.presetCSS === previousTheme.presetCSS &&
    nextTheme.customCSS === previousTheme.customCSS &&
    nextTheme.generatedCSS === previousTheme.generatedCSS &&
    nextTheme.recipe?.name === previousTheme.recipe?.name &&
    nextTheme.recipe?.note === previousTheme.recipe?.note &&
    areThemeVariablesEqual(nextTheme.cssVariables, previousTheme.cssVariables);
  return rolledBack ? 'rolled_back' : 'superseded';
}
