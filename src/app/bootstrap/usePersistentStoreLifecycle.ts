import { useRef } from 'react';
import { usePersistentStoreFlush } from './persistentStoreFlush';
import { usePersistentStoreHydration } from './persistentStoreHydration';

export {
  createLifecyclePersistenceFlush,
  createPersistScheduler,
  flushPersistSchedulerIfHydrated,
  shouldFlushSpaceThemeStateImmediately,
  shouldPersistChatState,
  shouldPersistCollectionState,
  shouldPersistPersonaState,
  shouldPersistRuntimeState,
  shouldPersistSpaceState,
  shouldPersistSpaceThemeState
} from './persistentStoreFlush';
export { hydrateSpaceThemeState } from './persistentStoreHydration';
export type { SpaceThemeHydrationState } from './persistentStoreHydration';

export function usePersistentStoreLifecycle() {
  const spaceThemeHydratedRef = useRef(false);
  const startupState = usePersistentStoreHydration(spaceThemeHydratedRef);
  usePersistentStoreFlush(spaceThemeHydratedRef);

  return startupState;
}
