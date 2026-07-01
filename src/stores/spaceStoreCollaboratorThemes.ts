import type { AppCustomization, SavedSkin, SkinSnapshot, ThemePatchLedgerEntry, ThemeState } from '../types/domain';
import { DEFAULT_APP_CUSTOMIZATION } from './runtimeStoreCustomization';
import { applyThemeFrame, createInitialThemeState, normalizeFrame, resolveSavedSkinId } from './spaceStoreTheme';
import type { CollaboratorThemeSession, SpaceFrontstageState, SpaceThemeState } from './spaceStoreTypes';

type ThemeOwnerState = SpaceThemeState & Pick<SpaceFrontstageState, 'frontstageCollaboratorId'>;

function cloneSavedSkin(savedSkin: SavedSkin): SavedSkin {
  return {
    ...savedSkin,
    cssVariables: { ...savedSkin.cssVariables },
    recipe: savedSkin.recipe ? { ...savedSkin.recipe } : undefined
  };
}

function cloneSkinSnapshot(snapshot: SkinSnapshot): SkinSnapshot {
  return {
    ...snapshot,
    cssVariables: { ...snapshot.cssVariables },
    recipe: snapshot.recipe ? { ...snapshot.recipe } : undefined
  };
}

function cloneThemePatchLedgerEntry(entry: ThemePatchLedgerEntry): ThemePatchLedgerEntry {
  return {
    ...entry,
    surfaceIds: entry.surfaceIds ? [...entry.surfaceIds] : undefined,
    surfaceLabels: entry.surfaceLabels ? [...entry.surfaceLabels] : undefined
  };
}

export function cloneThemeState(theme: ThemeState): ThemeState {
  return {
    ...theme,
    cssVariables: { ...theme.cssVariables },
    recipe: theme.recipe ? { ...theme.recipe } : undefined,
    selectedSurfaceCodes: [...(theme.selectedSurfaceCodes ?? [])],
    savedSkins: (theme.savedSkins ?? []).map(cloneSavedSkin),
    skinHistory: (theme.skinHistory ?? []).map(cloneSkinSnapshot),
    patchLedger: (theme.patchLedger ?? []).map(cloneThemePatchLedgerEntry)
  };
}

export function cloneRoomThemeState(theme: ThemeState): ThemeState {
  return {
    ...cloneThemeState(theme),
    savedSkins: []
  };
}

export function attachSharedSavedSkins(theme: ThemeState, savedSkins: SavedSkin[]): ThemeState {
  return {
    ...cloneThemeState(theme),
    activeSavedSkinId: resolveSavedSkinId(savedSkins, theme.activeSavedSkinId),
    savedSkins: savedSkins.map(cloneSavedSkin)
  };
}

export function cloneCustomization(customization: AppCustomization): AppCustomization {
  return {
    ...customization,
    customFontAssetIds: [...customization.customFontAssetIds],
    customFontScopeAssignments: { ...customization.customFontScopeAssignments }
  };
}

function restoreCollaboratorCustomization(
  collaboratorCustomization: AppCustomization,
  currentCustomization: AppCustomization
): AppCustomization {
  const customization = cloneCustomization(collaboratorCustomization);
  return {
    ...customization,
    customFontAssetIds: [...currentCustomization.customFontAssetIds],
    customFontScopeAssignments: { ...currentCustomization.customFontScopeAssignments }
  };
}

export function cloneCollaboratorThemeSession(session: CollaboratorThemeSession): CollaboratorThemeSession {
  return {
    theme: cloneThemeState(session.theme),
    customization: cloneCustomization(session.customization)
  };
}

export function createDefaultCollaboratorThemeSession(): CollaboratorThemeSession {
  return {
    theme: createInitialThemeState(),
    customization: { ...DEFAULT_APP_CUSTOMIZATION }
  };
}

function keepCurrentThemeToolMode(theme: ThemeState, currentTheme: ThemeState): ThemeState {
  return {
    ...theme,
    toolMode: currentTheme.toolMode
  };
}

export function captureCollaboratorThemeSession(
  theme: ThemeState,
  customization: AppCustomization
): CollaboratorThemeSession {
  return {
    theme: cloneRoomThemeState(theme),
    customization: cloneCustomization(customization)
  };
}

export function resolvePersistableCollaboratorTheme(
  state: Pick<ThemeOwnerState, 'theme'> & { activeThemePreview?: ThemeOwnerState['activeThemePreview'] }
) {
  return state.activeThemePreview
    ? applyThemeFrame(state.theme, normalizeFrame(state.theme, state.activeThemePreview.before))
    : state.theme;
}

export function capturePersistableCollaboratorThemeSession(
  state: Pick<ThemeOwnerState, 'theme' | 'customization'> & { activeThemePreview?: ThemeOwnerState['activeThemePreview'] }
) {
  return captureCollaboratorThemeSession(resolvePersistableCollaboratorTheme(state), state.customization);
}

export function writeCurrentCollaboratorThemeSession(
  state: Pick<ThemeOwnerState, 'frontstageCollaboratorId' | 'collaboratorThemes'>,
  session: CollaboratorThemeSession
) {
  const ownerId = state.frontstageCollaboratorId;
  if (!ownerId) return state.collaboratorThemes;
  return {
    ...state.collaboratorThemes,
    [ownerId]: cloneCollaboratorThemeSession(session)
  };
}

export function switchCollaboratorThemeSession(
  state: ThemeOwnerState,
  nextCollaboratorId: string | null
): Partial<ThemeOwnerState> {
  const previousCollaboratorId = state.frontstageCollaboratorId;
  if (previousCollaboratorId === nextCollaboratorId) {
    return { frontstageCollaboratorId: nextCollaboratorId };
  }

  let collaboratorThemes = state.collaboratorThemes;
  if (previousCollaboratorId) {
    collaboratorThemes = {
      ...collaboratorThemes,
      [previousCollaboratorId]: capturePersistableCollaboratorThemeSession(state)
    };
  }

  if (!nextCollaboratorId) {
    return {
      frontstageCollaboratorId: nextCollaboratorId,
      collaboratorThemes
    };
  }

  const existingSession = collaboratorThemes[nextCollaboratorId];
  if (existingSession) {
    const nextSession = cloneCollaboratorThemeSession(existingSession);
    return {
      frontstageCollaboratorId: nextCollaboratorId,
      activeThemePreview: null,
      theme: keepCurrentThemeToolMode(
        attachSharedSavedSkins(nextSession.theme, state.theme.savedSkins),
        state.theme
      ),
      customization: restoreCollaboratorCustomization(nextSession.customization, state.customization),
      collaboratorThemes
    };
  }

  const shouldAdoptCurrentTheme =
    !previousCollaboratorId
    && Object.keys(collaboratorThemes).length === 0;
  const nextSession = shouldAdoptCurrentTheme
    ? capturePersistableCollaboratorThemeSession(state)
    : createDefaultCollaboratorThemeSession();

  return {
    frontstageCollaboratorId: nextCollaboratorId,
    activeThemePreview: shouldAdoptCurrentTheme ? state.activeThemePreview : null,
    theme: shouldAdoptCurrentTheme
      ? state.theme
      : keepCurrentThemeToolMode(
          attachSharedSavedSkins(nextSession.theme, state.theme.savedSkins),
          state.theme
        ),
    customization: shouldAdoptCurrentTheme
      ? cloneCustomization(state.customization)
      : restoreCollaboratorCustomization(nextSession.customization, state.customization),
    collaboratorThemes: {
      ...collaboratorThemes,
      [nextCollaboratorId]: nextSession
    }
  };
}
