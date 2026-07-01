import { restoreThemeFrame } from './spaceStoreTheme';
import { createUid } from '../engines/id';
import type { SavedSkin } from '../types/domain';
import type { SpaceThemeActions } from './spaceStoreTypes';
import type { SpaceStoreSet } from './spaceStoreActionShared';
import { patchThemeFields } from './spaceStoreActionShared';
import { withSnapshot } from './spaceStoreTheme';
import { commitResolvedThemePreview, replaceResolvedThemeFrame } from './spaceStoreThemeMutations';
import {
  capturePersistableCollaboratorThemeSession,
  writeCurrentCollaboratorThemeSession
} from './spaceStoreCollaboratorThemes';

export function createSpaceSkinActions(set: SpaceStoreSet) {
  return {
    saveCurrentSkin: (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) return null;

      let savedSkin: SavedSkin | null = null;
      set((state) => {
        const now = Date.now();
        savedSkin = {
          id: createUid('saved-skin'),
          name: trimmedName,
          sourcePresetId: state.theme.activePresetId,
          cssVariables: { ...state.theme.cssVariables },
          presetCSS: state.theme.presetCSS,
          customCSS: state.theme.customCSS,
          generatedCSS: state.theme.generatedCSS,
          recipe: state.theme.recipe ? { ...state.theme.recipe } : undefined,
          createdAt: now,
          updatedAt: now
        };

        const theme = {
          ...state.theme,
          activeSavedSkinId: savedSkin.id,
          savedSkins: [savedSkin, ...state.theme.savedSkins]
        };

        if (state.activeThemePreview) {
          return commitResolvedThemePreview({
            ...state,
            theme
          });
        }

        return {
          theme,
          collaboratorThemes: writeCurrentCollaboratorThemeSession(
            state,
            capturePersistableCollaboratorThemeSession({ ...state, theme })
          )
        };
      });
      return savedSkin;
    },
    deleteSavedSkin: (savedSkinId: string) =>
      set((state) =>
        patchThemeFields(state, {
          activeSavedSkinId: state.theme.activeSavedSkinId === savedSkinId ? null : state.theme.activeSavedSkinId,
          savedSkins: state.theme.savedSkins.filter((savedSkin) => savedSkin.id !== savedSkinId)
        })
      ),
    renameSavedSkin: (savedSkinId: string, name: string) =>
      set((state) => {
        const trimmedName = name.trim();
        if (!trimmedName) return state;

        const savedSkins = state.theme.savedSkins.map((savedSkin) =>
          savedSkin.id === savedSkinId && savedSkin.name !== trimmedName
            ? {
                ...savedSkin,
                name: trimmedName,
                updatedAt: Date.now()
              }
            : savedSkin
        );
        const theme = { ...state.theme, savedSkins };

        return {
          theme,
          collaboratorThemes: writeCurrentCollaboratorThemeSession(
            state,
            capturePersistableCollaboratorThemeSession({ ...state, theme })
          )
        };
      }),
    updateSavedSkinCss: (savedSkinId: string, customCSS: string) =>
      set((state) => {
        const savedSkins = state.theme.savedSkins.map((savedSkin) =>
          savedSkin.id === savedSkinId
            ? {
                ...savedSkin,
                customCSS,
                generatedCSS: '',
                updatedAt: Date.now()
              }
            : savedSkin
        );
        const activeSavedSkin = state.theme.activeSavedSkinId === savedSkinId
          ? savedSkins.find((savedSkin) => savedSkin.id === savedSkinId) ?? null
          : null;
        const theme = {
          ...state.theme,
          savedSkins,
          ...(activeSavedSkin
            ? {
                customCSS: activeSavedSkin.customCSS,
                generatedCSS: activeSavedSkin.generatedCSS
              }
            : {})
        };

        return {
          theme,
          collaboratorThemes: writeCurrentCollaboratorThemeSession(
            state,
            capturePersistableCollaboratorThemeSession({ ...state, theme })
          )
        };
      }),
    commitSkinSnapshot: (label?: string) =>
      set((state) =>
        patchThemeFields(state, {
          skinHistory: withSnapshot(state.theme, label)
        })
      ),
    restoreSkinSnapshot: (snapshotId: string) =>
      set((state) => {
        const snapshot = state.theme.skinHistory.find((entry) => entry.id === snapshotId);
        if (!snapshot) return state;
        const nextTheme = restoreThemeFrame(snapshot);
        return replaceResolvedThemeFrame(state, nextTheme);
      }),
    rollbackLastSkin: () =>
      set((state) => {
        const [latestSnapshot, ...restHistory] = state.theme.skinHistory;
        if (!latestSnapshot) return state;
        const nextTheme = restoreThemeFrame(latestSnapshot);
        return replaceResolvedThemeFrame(state, nextTheme, { skinHistory: restHistory });
      })
  } satisfies Pick<
    SpaceThemeActions,
    | 'saveCurrentSkin'
    | 'renameSavedSkin'
    | 'updateSavedSkinCss'
    | 'deleteSavedSkin'
    | 'commitSkinSnapshot'
    | 'restoreSkinSnapshot'
    | 'rollbackLastSkin'
  >;
}
