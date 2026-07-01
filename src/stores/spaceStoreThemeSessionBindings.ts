import { useMemo } from 'react';
import { useSpaceStore } from './spaceStore';

export function useSpaceThemeSessionBindings() {
  const activeThemePreview = useSpaceStore((state) => state.activeThemePreview);
  const theme = useSpaceStore((state) => state.theme);
  const customization = useSpaceStore((state) => state.customization);
  const beginThemePreview = useSpaceStore((state) => state.beginThemePreview);
  const commitThemePreview = useSpaceStore((state) => state.commitThemePreview);
  const rollbackThemePreview = useSpaceStore((state) => state.rollbackThemePreview);
  const applyThemePreset = useSpaceStore((state) => state.applyThemePreset);
  const applyThemePatch = useSpaceStore((state) => state.applyThemePatch);
  const enterCustomThemeMode = useSpaceStore((state) => state.enterCustomThemeMode);
  const setThemeToolMode = useSpaceStore((state) => state.setThemeToolMode);
  const setSelectedSurfaceCodes = useSpaceStore((state) => state.setSelectedSurfaceCodes);
  const selectAllThemeSurfaces = useSpaceStore((state) => state.selectAllThemeSurfaces);
  const applySavedSkin = useSpaceStore((state) => state.applySavedSkin);
  const setCustomization = useSpaceStore((state) => state.setCustomization);
  const setCustomCSS = useSpaceStore((state) => state.setCustomCSS);
  const clearCustomCSS = useSpaceStore((state) => state.clearCustomCSS);
  const saveCurrentSkin = useSpaceStore((state) => state.saveCurrentSkin);
  const renameSavedSkin = useSpaceStore((state) => state.renameSavedSkin);
  const updateSavedSkinCss = useSpaceStore((state) => state.updateSavedSkinCss);
  const deleteSavedSkin = useSpaceStore((state) => state.deleteSavedSkin);
  const deleteCollaboratorThemeSession = useSpaceStore((state) => state.deleteCollaboratorThemeSession);
  const commitSkinSnapshot = useSpaceStore((state) => state.commitSkinSnapshot);
  const restoreSkinSnapshot = useSpaceStore((state) => state.restoreSkinSnapshot);
  const rollbackLastSkin = useSpaceStore((state) => state.rollbackLastSkin);

  return useMemo(() => ({
    activeThemePreview,
    theme,
    customization,
    beginThemePreview,
    commitThemePreview,
    rollbackThemePreview,
    applyThemePreset,
    applyThemePatch,
    enterCustomThemeMode,
    setThemeToolMode,
    setSelectedSurfaceCodes,
    selectAllThemeSurfaces,
    applySavedSkin,
    setCustomization,
    setCustomCSS,
    clearCustomCSS,
    saveCurrentSkin,
    renameSavedSkin,
    updateSavedSkinCss,
    deleteSavedSkin,
    deleteCollaboratorThemeSession,
    commitSkinSnapshot,
    restoreSkinSnapshot,
    rollbackLastSkin
  }), [
    activeThemePreview,
    theme,
    customization,
    beginThemePreview,
    commitThemePreview,
    rollbackThemePreview,
    applyThemePreset,
    applyThemePatch,
    enterCustomThemeMode,
    setThemeToolMode,
    setSelectedSurfaceCodes,
    selectAllThemeSurfaces,
    applySavedSkin,
    setCustomization,
    setCustomCSS,
    clearCustomCSS,
    saveCurrentSkin,
    renameSavedSkin,
    updateSavedSkinCss,
    deleteSavedSkin,
    deleteCollaboratorThemeSession,
    commitSkinSnapshot,
    restoreSkinSnapshot,
    rollbackLastSkin
  ]);
}

export type SpaceThemeSessionBindings = ReturnType<typeof useSpaceThemeSessionBindings>;
