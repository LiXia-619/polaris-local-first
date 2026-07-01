import { kvGet } from '../../infrastructure/persistence';
import { readLocalDataCensusReport } from '../../infrastructure/localDataHealth';
import {
  buildSpaceMigrationCensusResult,
  buildSpaceMigrationPlan,
  type SpaceMigrationCensusResult
} from '../../engines/localData/spaceMigration';
import { createStagedLocalDataKvBackendForMigration } from '../../engines/localData/localDataKvBackend';
import { createLocalDataRepository } from '../../engines/localData/repository';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta
} from '../../engines/localData/types';
import {
  migratePersistedSpaceState,
  SPACE_THEME_STATE_KEY,
  type PersistedSpaceState,
  type PersistedSpaceThemeState
} from './index';

const SPACE_LOCAL_STATE_KEY = 'polaris-space-store-v1';

export type SpaceRowsMigrationResult = {
  commitMeta: LocalDataCommitMeta;
  census: SpaceMigrationCensusResult;
};

export async function commitSpaceRowsMigrationFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  unitId?: string;
} = {}): Promise<SpaceRowsMigrationResult> {
  const committedAt = args.committedAt ?? Date.now();
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const state = await readCurrentSpaceStateForMigration();
  const plan = buildSpaceMigrationPlan({
    id: args.unitId ?? `space-rows-migration-${committedAt}`,
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
    census: buildSpaceMigrationCensusResult({
      plan,
      commitMeta,
      censusReport
    })
  };
}

export async function readCurrentSpaceStateForMigration() {
  const [themePayload, localPayload] = await Promise.all([
    kvGet<PersistedSpaceThemeState>(SPACE_THEME_STATE_KEY),
    Promise.resolve(readLocalStorageSpaceState())
  ]);

  return migratePersistedSpaceState({
    ...(localPayload ?? {}),
    ...(themePayload ?? {})
  });
}

function readLocalStorageSpaceState(): PersistedSpaceState | null {
  if (typeof window === 'undefined') return null;
  const rawValue = window.localStorage.getItem(SPACE_LOCAL_STATE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as { state?: PersistedSpaceState };
    return parsed?.state ?? parsed as PersistedSpaceState;
  } catch {
    return null;
  }
}
