import { kvGet } from '../../infrastructure/persistence';
import { readLocalDataCensusReport } from '../../infrastructure/localDataHealth';
import {
  buildCollectionMigrationCensusResult,
  buildCollectionMigrationPlan,
  type CollectionMigrationCensusResult
} from '../../engines/localData/collectionMigration';
import { createStagedLocalDataKvBackendForMigration } from '../../engines/localData/localDataKvBackend';
import { createLocalDataRepository } from '../../engines/localData/repository';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta
} from '../../engines/localData/types';
import { normalizeCodeCard, sortCodeCards } from '../collectionStoreCodeCards';
import { migrateLegacyImageCard, sortImageCards } from '../collectionStoreImageCards';
import { migrateLegacyProjectCards } from '../collectionStoreProjectFiles';
import { readLegacyCollectionStateForBoundary } from '../collectionLegacyStateBoundary';
import { loadWorkspaceReferenceDocsContent } from '../workspaceReferenceDocContentPersistence';
import type { PersistedCollectionState } from './index';

type SpaceThemeStatePayload = {
  collectionProjectId?: unknown;
};

export type CollectionRowsMigrationResult = {
  commitMeta: LocalDataCommitMeta;
  census: CollectionMigrationCensusResult;
};

export async function commitCollectionRowsMigrationFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  unitId?: string;
  activeProjectId?: string | null;
} = {}): Promise<CollectionRowsMigrationResult> {
  const committedAt = args.committedAt ?? Date.now();
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const collectionState = await readLegacyCollectionStateForBoundary();
  const activeProjectId = args.activeProjectId ?? await readActiveCollectionProjectId();
  const workspaceReferenceDocs = await loadWorkspaceReferenceDocsContent(collectionState?.workspaceReferenceDocs ?? []);
  const normalizedState = await normalizeCollectionStateForRowsMigration({
    cards: collectionState?.cards ?? [],
    imageCards: collectionState?.imageCards ?? [],
    roomProjects: collectionState?.roomProjects ?? [],
    projectFiles: collectionState?.projectFiles ?? [],
    workspaceReferenceDocs
  });
  const plan = buildCollectionMigrationPlan({
    id: args.unitId ?? `collection-rows-migration-${committedAt}`,
    activeProjectId,
    version,
    updatedAt: committedAt,
    state: normalizedState
  });
  const repository = createLocalDataRepository({
    backend: createStagedLocalDataKvBackendForMigration(),
    now: () => committedAt
  });
  const commitMeta = await repository.commit(plan.unitOfWork);
  const censusReport = await readLocalDataCensusReport();

  return {
    commitMeta,
    census: buildCollectionMigrationCensusResult({
      plan,
      commitMeta,
      censusReport
    })
  };
}

async function normalizeCollectionStateForRowsMigration(
  state: Omit<PersistedCollectionState, 'deletedBundledCardIds'>
) {
  const migratedCards = migrateLegacyProjectCards({
    cards: state.cards,
    projectFiles: state.projectFiles
  });
  const migratedImageCards = await Promise.all(state.imageCards.map((card) => migrateLegacyImageCard(card)));

  return {
    cards: sortCodeCards(migratedCards.cards.map((card) => normalizeCodeCard(card))),
    imageCards: sortImageCards(migratedImageCards),
    roomProjects: state.roomProjects,
    projectFiles: migratedCards.projectFiles,
    workspaceReferenceDocs: state.workspaceReferenceDocs
  };
}

async function readActiveCollectionProjectId() {
  const spaceState = await kvGet<SpaceThemeStatePayload>('space-theme-state-v1');
  return typeof spaceState?.collectionProjectId === 'string' && spaceState.collectionProjectId.trim().length > 0
    ? spaceState.collectionProjectId
    : null;
}
