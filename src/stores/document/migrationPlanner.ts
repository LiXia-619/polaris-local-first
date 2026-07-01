import { kvEntries, kvGet } from '../../infrastructure/persistence';
import { readLocalDataCensusReport } from '../../infrastructure/localDataHealth';
import {
  buildDocumentMigrationCensusResult,
  buildDocumentMigrationPlan,
  type DocumentMigrationCensusResult
} from '../../engines/localData/documentMigration';
import { buildDocumentLocalDataStateFromSources } from '../../engines/localData/documentSources';
import { createStagedLocalDataKvBackendForMigration } from '../../engines/localData/localDataKvBackend';
import { createLocalDataRepository } from '../../engines/localData/repository';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta
} from '../../engines/localData/types';
import type { Persona } from '../../types/domain';
import { readLegacyCollectionStateForBoundary } from '../collectionLegacyStateBoundary';
import { migratePersistedPersonaPayload } from '../personaStore';

type PersistedPersonaPayload = {
  personas?: Persona[];
  seededDefaultPersonaIds?: string[];
};

export type DocumentRowsMigrationResult = {
  commitMeta: LocalDataCommitMeta;
  census: DocumentMigrationCensusResult;
};

export async function commitDocumentRowsMigrationFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  unitId?: string;
} = {}): Promise<DocumentRowsMigrationResult> {
  const committedAt = args.committedAt ?? Date.now();
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const [kv, personas, collectionState] = await Promise.all([
    kvEntries(),
    readCurrentPersonas(),
    readLegacyCollectionStateForBoundary()
  ]);
  const state = buildDocumentLocalDataStateFromSources({
    kv,
    personas,
    workspaceReferenceDocs: collectionState?.workspaceReferenceDocs ?? [],
    updatedAt: committedAt
  });
  const plan = buildDocumentMigrationPlan({
    id: args.unitId ?? `document-rows-migration-${committedAt}`,
    version,
    updatedAt: committedAt,
    state
  });
  const repository = createLocalDataRepository({
    backend: createStagedLocalDataKvBackendForMigration(),
    now: () => committedAt
  });
  const commitMeta = await repository.commit(plan.unitOfWork);
  const censusReport = await readLocalDataCensusReport();

  return {
    commitMeta,
    census: buildDocumentMigrationCensusResult({
      plan,
      commitMeta,
      censusReport
    })
  };
}

async function readCurrentPersonas() {
  const payload = await kvGet<PersistedPersonaPayload>('persona-state-v2');
  if (!payload || !Array.isArray(payload.personas)) return [];
  return migratePersistedPersonaPayload({
    personas: payload.personas,
    seededDefaultPersonaIds: payload.seededDefaultPersonaIds
  }).personas;
}
