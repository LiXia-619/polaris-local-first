import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import { assertValidMigrationPromotionReport } from './migrationValidation';
import {
  buildChatMigrationRehearsal,
  buildChatMigrationRehearsalValidationReport,
  ChatMigrationRehearsalContractError
} from './chatMigrationRehearsal';
import {
  createCompleteLocalDataRow,
  getChatDomainMetaLocalDataRef,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  type ChatDomainMetaRow,
  type CommitPointerRow,
  type ConversationCatalogRow,
  type ConversationRecordRow,
  type LocalDataCompleteRow,
  type LocalDataReadResult,
  type LocalDataRef,
  type LocalDataStoredRow
} from './index';

const pointer: CommitPointerRow = {
  domain: 'chat',
  version: 3,
  committedAt: 40,
  commitId: 'chat-commit'
};

const promotionMeta = {
  domain: 'chat' as const,
  version: 3,
  committedAt: 40,
  commitId: 'chat-commit'
};

function message(id: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'user',
    content: id,
    timestamp
  };
}

function completeRead<T>(row: LocalDataCompleteRow<T>): LocalDataReadResult<T> {
  return {
    status: 'complete',
    ref: row.ref,
    value: row.value,
    row
  };
}

function incompleteRead<T>(ref: LocalDataRef, reason: string): LocalDataReadResult<T> {
  return {
    status: 'incomplete',
    ref,
    reason,
    missingKeys: []
  };
}

function rowValue<T>(rows: LocalDataStoredRow[], ref: LocalDataRef): LocalDataCompleteRow<T> {
  const row = rows.find((candidate) => {
    return candidate.ref.domain === ref.domain
      && candidate.ref.kind === ref.kind
      && candidate.ref.id === ref.id;
  });

  if (!row || row.state !== 'complete') {
    throw new Error(`Missing complete test row: ${ref.domain}/${ref.kind}/${ref.id}`);
  }
  return row as LocalDataCompleteRow<T>;
}

function completeMutationRows(rehearsal: ReturnType<typeof buildChatMigrationRehearsal>) {
  return rehearsal.unitOfWork.mutations.flatMap((mutation) => {
    return mutation.type === 'put' || mutation.type === 'restore' ? [mutation.row] : [];
  });
}

function readDomainMetaFromUnit(rehearsal: ReturnType<typeof buildChatMigrationRehearsal>) {
  return completeRead(rowValue<ChatDomainMetaRow>(
    completeMutationRows(rehearsal),
    getChatDomainMetaLocalDataRef()
  ));
}

function readCatalogFromUnit(rehearsal: ReturnType<typeof buildChatMigrationRehearsal>, id: string) {
  return completeRead(rowValue<ConversationCatalogRow>(
    completeMutationRows(rehearsal),
    getConversationCatalogLocalDataRef(id)
  ));
}

function readRecordFromUnit(rehearsal: ReturnType<typeof buildChatMigrationRehearsal>, id: string) {
  return completeRead(rowValue<ConversationRecordRow>(
    completeMutationRows(rehearsal),
    getConversationRecordLocalDataRef(id)
  ));
}

describe('buildChatMigrationRehearsal', () => {
  it('builds a staged unit and read plan from the legacy source plan', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: 'c-active',
        conversations: [{
          id: 'c-active',
          title: 'Active',
          collaboratorId: 'pharos',
          activeProjectId: 'project-1',
          pinnedAt: null,
          updatedAt: 30,
          messages: [message('m-1', 10)]
        }]
      },
      version: 3,
      committedAt: 40,
      unitId: 'chat-migration'
    });

    expect(rehearsal.unitOfWork).toEqual(expect.objectContaining({
      id: 'chat-migration',
      domain: 'chat',
      version: 3
    }));
    expect(rehearsal.readPlan).toEqual({
      domainMetaRef: getChatDomainMetaLocalDataRef(),
      conversations: [{
        id: 'c-active',
        catalogRef: getConversationCatalogLocalDataRef('c-active'),
        recordRef: getConversationRecordLocalDataRef('c-active')
      }]
    });
  });

  it('builds promotion evidence only from rehearse-planned readback rows', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: 'c-active',
        quarantinedConversationIds: ['c-quarantine'],
        conversations: [
          {
            id: 'c-active',
            title: 'Active',
            collaboratorId: 'pharos',
            activeProjectId: 'project-1',
            pinnedAt: null,
            updatedAt: 30,
            messages: [message('m-1', 10)]
          },
          {
            id: 'c-quarantine',
            title: 'Quarantine',
            collaboratorId: 'pharos',
            activeProjectId: null,
            pinnedAt: null,
            updatedAt: 31,
            expectedMessageCount: 2,
            expectedLatestMessageTimestamp: 20
          }
        ]
      },
      version: 3,
      committedAt: 40
    });

    const report = buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [
        {
          id: 'c-active',
          catalog: readCatalogFromUnit(rehearsal, 'c-active'),
          record: readRecordFromUnit(rehearsal, 'c-active')
        },
        {
          id: 'c-quarantine',
          catalog: readCatalogFromUnit(rehearsal, 'c-quarantine')
        }
      ],
      validatedAt: 50
    });

    expect(report).toEqual(expect.objectContaining({
      stagingHydrated: true,
      legacyBaselineObjectIds: ['c-active', 'c-quarantine'],
      activeBaselineObjectIds: ['c-active'],
      activeObjectIds: ['c-active'],
      quarantinedObjectIds: ['c-quarantine'],
      recoveredMetadata: {
        activeConversationId: 'c-active'
      }
    }));
    expect(() => assertValidMigrationPromotionReport(promotionMeta, report)).not.toThrow();
  });

  it('carries metadata degradation reasons from the source plan into readback validation', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: 'c-missing',
        conversations: [{
          id: 'c-missing',
          title: 'Missing',
          collaboratorId: 'pharos',
          activeProjectId: null,
          pinnedAt: null,
          updatedAt: 30,
          expectedMessageCount: 1,
          expectedLatestMessageTimestamp: 10
        }]
      },
      version: 3,
      committedAt: 40
    });

    const report = buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [{
        id: 'c-missing',
        catalog: readCatalogFromUnit(rehearsal, 'c-missing')
      }],
      validatedAt: 50
    });

    expect(report.metadataDegradationReasons).toEqual({
      activeConversationId: 'legacy active conversation did not hydrate into the active projection'
    });
  });

  it('rejects readback evidence for unplanned conversation ids', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: null,
        conversations: [{
          id: 'c-1',
          title: 'One',
          collaboratorId: 'pharos',
          pinnedAt: null,
          updatedAt: 30,
          messages: [message('m-1', 10)]
        }]
      },
      version: 3,
      committedAt: 40
    });

    expect(() => buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [
        {
          id: 'c-1',
          catalog: readCatalogFromUnit(rehearsal, 'c-1'),
          record: readRecordFromUnit(rehearsal, 'c-1')
        },
        {
          id: 'c-extra',
          catalog: completeRead(createCompleteLocalDataRow({
            ref: getConversationCatalogLocalDataRef('c-extra'),
            value: {
              id: 'c-extra',
              title: 'Extra',
              collaboratorId: 'pharos',
              activeProjectId: null,
              pinnedAt: null,
              updatedAt: 30,
              messageCount: 0,
              latestMessageTimestamp: 0,
              state: 'active',
              recordVersion: 3
            },
            version: 3,
            updatedAt: 30
          }))
        }
      ],
      validatedAt: 50
    })).toThrow(ChatMigrationRehearsalContractError);
  });

  it('rejects missing readback rows before validation evidence can be hand-authored', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: null,
        conversations: [{
          id: 'c-1',
          title: 'One',
          collaboratorId: 'pharos',
          pinnedAt: null,
          updatedAt: 30,
          messages: [message('m-1', 10)]
        }]
      },
      version: 3,
      committedAt: 40
    });

    expect(() => buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [],
      validatedAt: 50
    })).toThrow('Chat migration readback is missing planned conversation row: c-1');
  });

  it('rejects duplicate readback evidence for the same planned row', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: null,
        conversations: [{
          id: 'c-1',
          title: 'One',
          collaboratorId: 'pharos',
          pinnedAt: null,
          updatedAt: 30,
          messages: [message('m-1', 10)]
        }]
      },
      version: 3,
      committedAt: 40
    });
    const row = {
      id: 'c-1',
      catalog: readCatalogFromUnit(rehearsal, 'c-1'),
      record: readRecordFromUnit(rehearsal, 'c-1')
    };

    expect(() => buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [row, row],
      validatedAt: 50
    })).toThrow('Chat migration readback contains duplicate conversation row evidence: c-1');
  });

  it('requires complete plans to read their record evidence', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: null,
        conversations: [{
          id: 'c-1',
          title: 'One',
          collaboratorId: 'pharos',
          pinnedAt: null,
          updatedAt: 30,
          messages: [message('m-1', 10)]
        }]
      },
      version: 3,
      committedAt: 40
    });

    expect(() => buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [{
        id: 'c-1',
        catalog: readCatalogFromUnit(rehearsal, 'c-1')
      }],
      validatedAt: 50
    })).toThrow('Chat migration readback is missing complete record evidence: c-1');
  });

  it('rejects record evidence for non-complete plans', () => {
    const rehearsal = buildChatMigrationRehearsal({
      snapshot: {
        activeConversationId: null,
        conversations: [{
          id: 'c-incomplete',
          title: 'Incomplete',
          collaboratorId: 'pharos',
          pinnedAt: null,
          updatedAt: 30,
          expectedMessageCount: 1,
          expectedLatestMessageTimestamp: 10
        }]
      },
      version: 3,
      committedAt: 40
    });

    expect(() => buildChatMigrationRehearsalValidationReport(rehearsal, {
      pointer,
      domainMeta: readDomainMetaFromUnit(rehearsal),
      rows: [{
        id: 'c-incomplete',
        catalog: readCatalogFromUnit(rehearsal, 'c-incomplete'),
        record: incompleteRead(getConversationRecordLocalDataRef('c-incomplete'), 'unplanned record read')
      }],
      validatedAt: 50
    })).toThrow('Chat migration readback supplied record evidence for a non-complete row: c-incomplete');
  });
});
