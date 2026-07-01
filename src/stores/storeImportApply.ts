import { useChatStore } from './chatStore';
import { useCollectionStore } from './collectionStore';
import { usePersonaStore } from './personaStore';
import { useRuntimeStore } from './runtimeStore';
import { useSpaceStore } from './spaceStore';
import type { SpaceState } from './spaceStoreTypes';
import { migratePersistedSpaceState, readPersistedSpaceThemeState } from './spaceStorePersistence';
import { reconcilePersonaVectorIndexStatusesAfterImport } from './personaStoreVectorIndex';
import { SPACE_STORE_KEY } from './storeExportPackage';
import {
  applyLegacyRuntimeSpaceFields,
  readLegacyRuntimeSpacePayload
} from './persistentStoreLegacyMigrations';

async function readImportedSpaceState() {
  if (typeof window === 'undefined') return null;

  const rawValue = window.localStorage.getItem(SPACE_STORE_KEY);
  const persistedThemeState = (await readPersistedSpaceThemeState())?.themeState ?? null;
  if (!rawValue) return persistedThemeState;

  try {
    const parsed = JSON.parse(rawValue) as { state?: unknown };
    return {
      ...migratePersistedSpaceState(parsed?.state ?? parsed),
      ...(persistedThemeState ?? {})
    };
  } catch {
    return persistedThemeState;
  }
}

export async function applyImportedPersistedStores() {
  const legacyRuntimeSpacePayloadPromise = readLegacyRuntimeSpacePayload();
  const spaceState = await readImportedSpaceState();
  if (spaceState) {
    useSpaceStore.setState(spaceState as Partial<SpaceState>);
  }

  const [
    ,
    shouldPersistPersonaAfterHydration,
    shouldPersistRuntimeAfterHydration
  ] = await Promise.all([
    useChatStore.getState().hydrateFromDb(),
    usePersonaStore.getState().hydrateFromDb(),
    useRuntimeStore.getState().hydrateFromDb(),
    useCollectionStore.getState().hydrateFromDb()
  ]);

  await Promise.all([
    shouldPersistPersonaAfterHydration ? usePersonaStore.getState().persistToDb() : Promise.resolve(),
    shouldPersistRuntimeAfterHydration ? useRuntimeStore.getState().persistToDb() : Promise.resolve()
  ]);

  const reconciledVectorIndexes = await reconcilePersonaVectorIndexStatusesAfterImport(
    usePersonaStore.getState().personas
  );
  if (reconciledVectorIndexes.changed) {
    usePersonaStore.setState({ personas: reconciledVectorIndexes.personas });
    await usePersonaStore.getState().persistToDb();
  }

  await applyLegacyRuntimeSpaceFields({
    getSpaceState: useSpaceStore.getState,
    legacyRuntimePayload: await legacyRuntimeSpacePayloadPromise
  });

  useChatStore.getState().reconcileConversationWorkspaceBindings(
    useCollectionStore.getState().roomProjects.map((project) => project.id)
  );
}
