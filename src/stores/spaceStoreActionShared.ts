import type { StoreApi } from 'zustand';
import {
  capturePersistableCollaboratorThemeSession,
  writeCurrentCollaboratorThemeSession
} from './spaceStoreCollaboratorThemes';
import type { SpaceFrontstageState, SpaceState, SpaceThemeState } from './spaceStoreTypes';

export type SpaceStoreSet = StoreApi<SpaceState>['setState'];

type ThemePatchState = SpaceThemeState & Pick<SpaceFrontstageState, 'frontstageCollaboratorId'>;

export function patchThemeFields(state: ThemePatchState, patch: Partial<SpaceThemeState['theme']>) {
  const theme = {
    ...state.theme,
    ...patch
  };

  return {
    theme,
    collaboratorThemes: writeCurrentCollaboratorThemeSession(
      state,
      capturePersistableCollaboratorThemeSession({ ...state, theme })
    )
  };
}
