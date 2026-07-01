import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import type { Persona } from '../../types/domain';
import {
  buildPersonaLocalDataUnitOfWork,
  getPersonaObjectLocalDataRef
} from './personaRows';
import { createLocalDataMemoryBackend } from './localDataMemoryBackend';
import { createLocalDataRepository, LocalDataContractError } from './repository';
import {
  createCompleteLocalDataRow,
  createIncompleteLocalDataRow,
  getLocalDataActiveDataSourceKey,
  getLocalDataCommitPointerKey,
  getLocalDataRowKey,
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataMigrationValidationReport,
  type LocalDataRef,
  type LocalDataStoredRow
} from './types';

const conversationRef: LocalDataRef = {
  domain: 'chat',
  kind: 'conversationRecord',
  id: 'c-accident'
};

function persona(id: string): Persona {
  return createPersonaTemplate({
    id,
    name: id,
    description: '',
    memory: {
      inheritGlobal: true,
      crossConversationRecallEnabled: true,
      excludedGlobalIds: [],
      personalMemories: [],
      referenceDocs: []
    }
  });
}

function promotionReport(
  domain: LocalDataMigrationValidationReport['domain'],
  commitId: string,
  objectIds: string[]
): LocalDataMigrationValidationReport {
  return {
    id: `${domain}-report`,
    domain,
    commitId,
    version: LOCAL_DATA_SCHEMA_VERSION,
    validatedAt: 50,
    stagingHydrated: true,
    legacyBaselineCount: objectIds.length,
    legacyBaselineObjectIds: objectIds,
    activeBaselineObjectIds: objectIds,
    activeObjectCount: objectIds.length,
    activeObjectIds: objectIds,
    quarantinedObjectCount: 0,
    quarantinedObjectIds: [],
    duplicateObjectIdCount: 0,
    missingActiveCollaboratorIdCount: 0,
    missingActiveCollaboratorIds: [],
    activeIncompleteRowCount: 0,
    activeTimedOutRowCount: 0,
    recoveredMetadata: domain === 'chat' ? { activeConversationId: objectIds[0] ?? null } : {}
  };
}

describe('data-boundary accident fixtures', () => {
  it('keeps ordinary repository commits out of activeDataSource', async () => {
    const backend = createLocalDataMemoryBackend();
    const repository = createLocalDataRepository({
      backend,
      now: () => 100,
      createCommitId: () => 'persona-ordinary-commit'
    });
    const recoveredShell = persona('recovered-shell');

    const meta = await repository.commit(buildPersonaLocalDataUnitOfWork({
      state: {
        personas: [recoveredShell],
        activeCollaboratorId: recoveredShell.id,
        seededDefaultPersonaIds: []
      },
      version: LOCAL_DATA_SCHEMA_VERSION,
      updatedAt: 100
    }));
    const objectRead = await repository.read(getPersonaObjectLocalDataRef(recoveredShell.id));

    expect(meta.domain).toBe('persona');
    expect(objectRead.status).toBe('complete');
    expect(backend.entries().some((entry) => entry.key === getLocalDataActiveDataSourceKey())).toBe(false);
    expect(backend.entries().some((entry) => entry.key === getLocalDataCommitPointerKey('persona'))).toBe(true);
  });

  it('preserves incomplete reads as incomplete instead of turning them into empty facts', async () => {
    const incompleteRow = createIncompleteLocalDataRow({
      ref: conversationRef,
      reason: 'fixture message body is missing',
      missingKeys: ['chat-message-v1:c-accident'],
      version: LOCAL_DATA_SCHEMA_VERSION,
      updatedAt: 110
    });
    const repository = createLocalDataRepository({
      backend: createLocalDataMemoryBackend([{
        key: incompleteRow.key,
        value: incompleteRow
      }])
    });

    const result = await repository.read(conversationRef);

    expect(result).toEqual(expect.objectContaining({
      status: 'incomplete',
      reason: 'fixture message body is missing',
      missingKeys: ['chat-message-v1:c-accident']
    }));
    expect(result.status).not.toBe('complete');
  });

  it('does not let an ordinary complete row revive a deleted tombstone', async () => {
    const deletedRow: LocalDataStoredRow = {
      schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
      key: getLocalDataRowKey(conversationRef),
      ref: conversationRef,
      version: LOCAL_DATA_SCHEMA_VERSION,
      updatedAt: 120,
      state: 'deleted',
      deletedAt: 120
    };
    const staleCompleteRow = createCompleteLocalDataRow({
      ref: conversationRef,
      value: { messages: ['stale body'] },
      version: LOCAL_DATA_SCHEMA_VERSION,
      updatedAt: 130
    });
    const backend = createLocalDataMemoryBackend([{
      key: deletedRow.key,
      value: deletedRow
    }]);
    const repository = createLocalDataRepository({
      backend,
      now: () => 130,
      createCommitId: () => 'stale-complete'
    });

    await expect(repository.commit({
      domain: 'chat',
      version: LOCAL_DATA_SCHEMA_VERSION,
      mutations: [{ type: 'put', row: staleCompleteRow }]
    })).rejects.toBeInstanceOf(LocalDataContractError);
    expect(backend.committed()).toEqual([]);
  });

  it('records partial activeDataSource domains without implying global repository truth', async () => {
    const backend = createLocalDataMemoryBackend([
      {
        key: getLocalDataCommitPointerKey('chat'),
        value: {
          domain: 'chat',
          version: LOCAL_DATA_SCHEMA_VERSION,
          committedAt: 140,
          commitId: 'chat-ready'
        }
      },
      {
        key: getLocalDataCommitPointerKey('persona'),
        value: {
          domain: 'persona',
          version: LOCAL_DATA_SCHEMA_VERSION,
          committedAt: 141,
          commitId: 'persona-staged-only'
        }
      }
    ]);
    const repository = createLocalDataRepository({
      backend,
      now: () => 150
    });

    const activeDataSource = await repository.promoteActiveDataSources([{
      meta: {
        domain: 'chat',
        version: LOCAL_DATA_SCHEMA_VERSION,
        committedAt: 140,
        commitId: 'chat-ready'
      },
      validationReport: promotionReport('chat', 'chat-ready', ['c-accident'])
    }]);

    expect(activeDataSource.activeDataSource).toBe('repository');
    expect(activeDataSource.domains.chat?.commitId).toBe('chat-ready');
    expect(activeDataSource.domains.persona).toBeUndefined();
  });
});
