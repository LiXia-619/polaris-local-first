import { createInitialSpaceFrontstageState } from './spaceStoreFrontstageState';
import { createSpaceFrontstageActions } from './spaceStoreFrontstageActions';
import type { SpaceStoreSet } from './spaceStoreActionShared';
import type { SpaceFrontstageActions, SpaceFrontstageState } from './spaceStoreTypes';

export type SpaceFrontstageSlice = SpaceFrontstageState & SpaceFrontstageActions;

export function createSpaceFrontstageSlice(set: SpaceStoreSet): SpaceFrontstageSlice {
  return {
    ...createInitialSpaceFrontstageState(),
    ...createSpaceFrontstageActions(set)
  };
}
