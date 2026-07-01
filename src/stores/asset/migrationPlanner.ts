import {
  listActiveAssetBinaryEntrySizes,
  listActiveAssetMetaEntries,
  listActiveAssetPreviewEntrySizes
} from '../../infrastructure/assetStore';
import { kvGet } from '../../infrastructure/persistence';
import { readLocalDataCensusReport } from '../../infrastructure/localDataHealth';
import { collectAssetReferenceOwners } from '../../engines/assetGovernance';
import {
  buildAssetMigrationCensusResult,
  buildAssetMigrationPlan,
  type AssetMigrationCensusResult
} from '../../engines/localData/assetMigration';
import { createStagedLocalDataKvBackendForMigration } from '../../engines/localData/localDataKvBackend';
import { createLocalDataRepository } from '../../engines/localData/repository';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta
} from '../../engines/localData/types';
import type { Persona } from '../../types/domain';
import { readRecoverableChatStateForMigrationFromCurrentPersistence } from '../chatMigrationDryRunPersistence';
import { readLegacyCollectionStateForBoundary } from '../collectionLegacyStateBoundary';
import { loadWorkspaceReferenceDocsContent } from '../workspaceReferenceDocContentPersistence';
import { migratePersistedPersonaPayload } from '../personaStore';
import { readCurrentSpaceStateForMigration } from '../spaceMigrationPersistence';

type PersistedPersonaPayload = {
  personas?: Persona[];
  seededDefaultPersonaIds?: string[];
};

export type AssetRowsMigrationResult = {
  commitMeta: LocalDataCommitMeta;
  census: AssetMigrationCensusResult;
};

export async function commitAssetRowsMigrationFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  unitId?: string;
} = {}): Promise<AssetRowsMigrationResult> {
  const committedAt = args.committedAt ?? Date.now();
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const [assetState, ownersByAssetId] = await Promise.all([
    readCurrentAssetState(),
    readCurrentAssetReferenceOwners()
  ]);
  const plan = buildAssetMigrationPlan({
    id: args.unitId ?? `asset-rows-migration-${committedAt}`,
    version,
    updatedAt: committedAt,
    state: {
      ...assetState,
      ownersByAssetId
    }
  });
  const repository = createLocalDataRepository({
    backend: createStagedLocalDataKvBackendForMigration(),
    now: () => committedAt
  });
  const commitMeta = await repository.commit(plan.unitOfWork);
  const censusReport = await readLocalDataCensusReport();

  return {
    commitMeta,
    census: buildAssetMigrationCensusResult({
      plan,
      commitMeta,
      censusReport
    })
  };
}

async function readCurrentAssetState() {
  const [metaEntries, binarySizes, previewSizes] = await Promise.all([
    listActiveAssetMetaEntries(),
    listActiveAssetBinaryEntrySizes(),
    listActiveAssetPreviewEntrySizes()
  ]);

  return {
    meta: metaEntries.map((entry) => entry.value),
    binary: binarySizes.map((entry) => ({ id: entry.key, bytes: entry.size })),
    preview: previewSizes.map((entry) => ({ id: entry.key, bytes: entry.size }))
  };
}

async function readCurrentAssetReferenceOwners() {
  const collectionStatePromise = readLegacyCollectionStateForBoundary();
  const [chatState, collectionState, workspaceReferenceDocs, personas, spaceState] = await Promise.all([
    readRecoverableChatStateForMigrationFromCurrentPersistence(),
    collectionStatePromise,
    collectionStatePromise.then(async (state) => (
      await loadWorkspaceReferenceDocsContent(state?.workspaceReferenceDocs ?? [])
    )),
    readCurrentPersonas(),
    readCurrentSpaceStateForMigration()
  ]);
  const collection = collectionState ?? {
    cards: [],
    imageCards: [],
    projectFiles: [],
    roomProjects: [],
    workspaceReferenceDocs: []
  };

  return collectAssetReferenceOwners({
    conversations: chatState?.conversations ?? [],
    codeCards: collection.cards,
    imageCards: collection.imageCards,
    projectFiles: collection.projectFiles,
    workspaceReferenceDocs,
    roomProjects: collection.roomProjects,
    personas,
    theme: spaceState.theme,
    collaboratorThemes: spaceState.collaboratorThemes,
    customization: spaceState.customization,
    pendingAttachments: []
  });
}

async function readCurrentPersonas() {
  const payload = await kvGet<PersistedPersonaPayload>('persona-state-v2');
  if (!payload || !Array.isArray(payload.personas)) return [];
  return migratePersistedPersonaPayload({
    personas: payload.personas,
    seededDefaultPersonaIds: payload.seededDefaultPersonaIds
  }).personas;
}
