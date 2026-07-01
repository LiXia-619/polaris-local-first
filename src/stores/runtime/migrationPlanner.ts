import { readLocalDataCensusReport } from '../../infrastructure/localDataHealth';
import {
  buildRuntimeMigrationCensusResult,
  buildRuntimeMigrationPlan,
  type RuntimeMigrationCensusResult
} from '../../engines/localData/runtimeMigration';
import { createStagedLocalDataKvBackendForMigration } from '../../engines/localData/localDataKvBackend';
import { createLocalDataRepository } from '../../engines/localData/repository';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta
} from '../../engines/localData/types';
import {
  hydrateFromDb,
  normalizeRuntimePayload,
  type RuntimePayload
} from './index';

export type RuntimeRowsMigrationResult = {
  commitMeta: LocalDataCommitMeta;
  census: RuntimeMigrationCensusResult;
};

export async function commitRuntimeRowsMigrationFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  unitId?: string;
} = {}): Promise<RuntimeRowsMigrationResult> {
  const committedAt = args.committedAt ?? Date.now();
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const payload = await readCurrentRuntimePayload();
  const plan = buildRuntimeMigrationPlan({
    id: args.unitId ?? `runtime-rows-migration-${committedAt}`,
    version,
    updatedAt: committedAt,
    state: payload
  });
  const repository = createLocalDataRepository({
    backend: createStagedLocalDataKvBackendForMigration(),
    now: () => committedAt
  });
  const commitMeta = await repository.commit(plan.unitOfWork);
  const censusReport = await readLocalDataCensusReport();

  return {
    commitMeta,
    census: buildRuntimeMigrationCensusResult({
      plan,
      commitMeta,
      censusReport
    })
  };
}

async function readCurrentRuntimePayload(): Promise<RuntimePayload> {
  const hydrated = await hydrateFromDb({ throwOnReadFailure: true });
  return hydrated?.payload ?? normalizeRuntimePayload(null);
}
