import { createInitialSpaceThemeState } from './spaceStoreThemeState';
import { createSpaceSkinActions } from './spaceStoreSkinActions';
import { createSpaceThemeActions } from './spaceStoreThemeActions';
import type { SpaceStoreSet } from './spaceStoreActionShared';
import type { SpaceThemeActions, SpaceThemeState } from './spaceStoreTypes';
import { mergeAppCustomizationPatch } from './runtimeStoreCustomization';
import {
  capturePersistableCollaboratorThemeSession,
  writeCurrentCollaboratorThemeSession
} from './spaceStoreCollaboratorThemes';

export type SpaceThemeSessionSlice = SpaceThemeState & SpaceThemeActions;

export function createSpaceThemeSessionSlice(set: SpaceStoreSet): SpaceThemeSessionSlice {
  return {
    ...createInitialSpaceThemeState(),
    deleteCollaboratorThemeSession: (collaboratorId) =>
      set((state) => {
        if (!state.collaboratorThemes[collaboratorId]) return state;
        const { [collaboratorId]: _deleted, ...collaboratorThemes } = state.collaboratorThemes;
        return { collaboratorThemes };
      }),
    setCustomization: (patch) =>
      set((state) => {
        const customization = mergeAppCustomizationPatch(state.customization, patch);
        return {
          customization,
          collaboratorThemes: writeCurrentCollaboratorThemeSession(
            state,
            capturePersistableCollaboratorThemeSession({ ...state, customization })
          )
        };
      }),
    ...createSpaceThemeActions(set),
    ...createSpaceSkinActions(set)
  };
}
