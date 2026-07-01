import { kvGet } from '../../infrastructure/persistence';
import { readLocalDataCensusReport } from '../../infrastructure/localDataHealth';
import {
  buildPersonaMigrationCensusResult,
  buildPersonaMigrationPlan,
  type PersonaMigrationCensusResult
} from '../../engines/localData/personaMigration';
import { createStagedLocalDataKvBackendForMigration } from '../../engines/localData/localDataKvBackend';
import { createLocalDataRepository } from '../../engines/localData/repository';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta
} from '../../engines/localData/types';
import type { Persona } from '../../types/domain';
import {
  restoreCurrentPersonaMemoryDocContent
} from '../personaMemoryReferenceDocPersistence';
import { migratePersistedPersonaPayload } from '../personaStore';

type PersistedPersonaPayload = {
  personas?: Persona[];
  activeCollaboratorId?: string | null;
  seededDefaultPersonaIds?: string[];
};

export type PersonaRowsMigrationResult = {
  commitMeta: LocalDataCommitMeta;
  census: PersonaMigrationCensusResult;
};

export async function commitPersonaRowsMigrationFromCurrentPersistence(args: {
  version?: number;
  committedAt?: number;
  unitId?: string;
} = {}): Promise<PersonaRowsMigrationResult> {
  const committedAt = args.committedAt ?? Date.now();
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const currentState = await readCurrentPersonaState();
  const restoredPersonas = await restoreCurrentPersonaMemoryDocContent(currentState.personas);
  const activeCollaboratorId = resolveActiveCollaboratorId(currentState.activeCollaboratorId, restoredPersonas);
  const plan = buildPersonaMigrationPlan({
    id: args.unitId ?? `persona-rows-migration-${committedAt}`,
    version,
    updatedAt: committedAt,
    state: {
      personas: restoredPersonas,
      activeCollaboratorId,
      seededDefaultPersonaIds: currentState.seededDefaultPersonaIds
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
    census: buildPersonaMigrationCensusResult({
      plan,
      commitMeta,
      censusReport
    })
  };
}

async function readCurrentPersonaState() {
  const payload = await kvGet<PersistedPersonaPayload>('persona-state-v2');
  if (!payload || !Array.isArray(payload.personas)) {
    return {
      personas: [],
      activeCollaboratorId: null,
      seededDefaultPersonaIds: []
    };
  }

  const migrated = migratePersistedPersonaPayload({
    personas: payload.personas,
    seededDefaultPersonaIds: payload.seededDefaultPersonaIds
  });

  return {
    personas: migrated.personas,
    activeCollaboratorId: typeof payload.activeCollaboratorId === 'string' ? payload.activeCollaboratorId : null,
    seededDefaultPersonaIds: migrated.seededDefaultPersonaIds
  };
}

function resolveActiveCollaboratorId(activeCollaboratorId: string | null, personas: Persona[]) {
  if (activeCollaboratorId && personas.some((persona) => persona.id === activeCollaboratorId)) return activeCollaboratorId;
  return personas[0]?.id ?? null;
}
