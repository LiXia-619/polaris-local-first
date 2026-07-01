import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import { assertValidMigrationPromotionReport } from './migrationValidation';
import {
  buildChatMigrationValidationReportFromRows,
  hydrateChatMigrationConversations
} from './chatMigrationHydration';
import {
  createCompleteLocalDataRow,
  getChatDomainMetaLocalDataRef,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  getLocalDataRowKey,
  type ChatDomainMetaRow,
  type CommitPointerRow,
  type ConversationCatalogRow,
  type ConversationRecordRow,
  type LocalDataCompleteRow,
  type LocalDataReadResult,
  type LocalDataRef
} from './index';

const pointer: CommitPointerRow = {
  domain: 'chat',
  version: 3,
  committedAt: 30,
  commitId: 'chat-commit'
};

const promotionMeta = {
  domain: 'chat' as const,
  version: 3,
  committedAt: 30,
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

function catalogValue(id: string, messages: ChatMessage[]): ConversationCatalogRow {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    activeProjectId: 'project-1',
    pinnedAt: null,
    updatedAt: 30,
    messageCount: messages.length,
    latestMessageTimestamp: Math.max(0, ...messages.map((item) => item.timestamp)),
    state: 'active',
    recordVersion: 3
  };
}

function recordValue(id: string, messages: ChatMessage[]): ConversationRecordRow {
  return {
    id,
    version: 3,
    committedAt: 30,
    messages,
    task: null,
    draft: '',
    workspaceLedger: [],
    ownerProjectId: 'project-1',
    assetRefs: []
  };
}

function domainMetaValue(activeConversationId: string | null, active: number, quarantined: number): ChatDomainMetaRow {
  return {
    id: 'chat',
    activeConversationId,
    activeConversationCount: active,
    quarantinedConversationCount: quarantined,
    totalConversationCount: active + quarantined,
    updatedAt: 30
  };
}

function completeRead<T>(ref: LocalDataRef, value: T): LocalDataReadResult<T> {
  const row = createCompleteLocalDataRow({
    ref,
    value,
    version: 3,
    updatedAt: 30
  }) as LocalDataCompleteRow<T>;
  return {
    status: 'complete',
    ref,
    value,
    row
  };
}

function incompleteRead<T>(ref: LocalDataRef, reason: string): LocalDataReadResult<T> {
  return {
    status: 'incomplete',
    ref,
    reason,
    missingKeys: [getLocalDataRowKey(ref)]
  };
}

describe('hydrateChatMigrationConversations', () => {
  it('hydrates complete active catalog and record rows into active projection evidence', () => {
    const messages = [message('m-1', 10)];
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-1',
      catalog: completeRead(getConversationCatalogLocalDataRef('c-1'), catalogValue('c-1', messages)),
      record: completeRead(getConversationRecordLocalDataRef('c-1'), recordValue('c-1', messages))
    }]);

    expect(conversations).toEqual([expect.objectContaining({
      state: 'active',
      catalog: expect.objectContaining({ id: 'c-1' }),
      record: expect.objectContaining({ id: 'c-1' })
    })]);
  });

  it('quarantines unloaded or incomplete shells instead of emitting active empty records', () => {
    const catalogRef = getConversationCatalogLocalDataRef('c-missing');
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-missing',
      catalog: incompleteRead(catalogRef, 'Local data row is missing.')
    }]);

    expect(conversations).toEqual([{
      state: 'quarantined',
      id: 'c-missing',
      reason: 'conversation catalog is incomplete'
    }]);
  });

  it('quarantines active catalogs whose record body was not read back completely', () => {
    const messages = [message('m-1', 10), message('m-2', 20)];
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-1',
      catalog: completeRead(getConversationCatalogLocalDataRef('c-1'), catalogValue('c-1', messages)),
      record: incompleteRead(getConversationRecordLocalDataRef('c-1'), 'conversation record is missing')
    }]);

    expect(conversations).toEqual([{
      state: 'quarantined',
      id: 'c-1',
      reason: 'conversation record is incomplete'
    }]);
  });

  it('quarantines complete catalog rows whose value id does not match the row ref', () => {
    const messages = [message('m-1', 10)];
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-ref',
      catalog: completeRead(getConversationCatalogLocalDataRef('c-ref'), catalogValue('c-value', messages)),
      record: completeRead(getConversationRecordLocalDataRef('c-value'), recordValue('c-value', messages))
    }]);

    expect(conversations).toEqual([{
      state: 'quarantined',
      id: 'c-ref',
      reason: 'conversation catalog identity does not match its row'
    }]);
  });

  it('quarantines complete catalog rows whose ref kind does not match a conversation catalog', () => {
    const messages = [message('m-1', 10)];
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-ref',
      catalog: completeRead(
        { domain: 'chat', kind: 'conversationRecord', id: 'c-ref' },
        catalogValue('c-ref', messages)
      ),
      record: completeRead(getConversationRecordLocalDataRef('c-ref'), recordValue('c-ref', messages))
    }]);

    expect(conversations).toEqual([{
      state: 'quarantined',
      id: 'c-ref',
      reason: 'conversation catalog identity does not match its row'
    }]);
  });

  it('quarantines complete record rows whose value id does not match the active catalog id', () => {
    const messages = [message('m-1', 10)];
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-ref',
      catalog: completeRead(getConversationCatalogLocalDataRef('c-ref'), catalogValue('c-ref', messages)),
      record: completeRead(getConversationRecordLocalDataRef('c-ref'), recordValue('c-value', messages))
    }]);

    expect(conversations).toEqual([{
      state: 'quarantined',
      id: 'c-ref',
      reason: 'conversation record identity does not match its row'
    }]);
  });

  it('quarantines complete record rows whose ref kind does not match a conversation record', () => {
    const messages = [message('m-1', 10)];
    const conversations = hydrateChatMigrationConversations([{
      id: 'c-ref',
      catalog: completeRead(getConversationCatalogLocalDataRef('c-ref'), catalogValue('c-ref', messages)),
      record: completeRead(
        { domain: 'chat', kind: 'conversationCatalog', id: 'c-ref' },
        recordValue('c-ref', messages)
      )
    }]);

    expect(conversations).toEqual([{
      state: 'quarantined',
      id: 'c-ref',
      reason: 'conversation record identity does not match its row'
    }]);
  });
});

describe('buildChatMigrationValidationReportFromRows', () => {
  it('builds promotion evidence from hydrated rows while preserving quarantined objects', () => {
    const activeMessages = [message('m-1', 10)];
    const missingMessages = [message('m-2', 20)];
    const report = buildChatMigrationValidationReportFromRows({
      pointer,
      domainMeta: completeRead(
        getChatDomainMetaLocalDataRef(),
        domainMetaValue('c-active', 1, 1)
      ),
      legacyBaselineConversationIds: ['c-active', 'c-missing'],
      legacyActiveConversationIds: ['c-active'],
      rows: [
        {
          id: 'c-active',
          catalog: completeRead(
            getConversationCatalogLocalDataRef('c-active'),
            catalogValue('c-active', activeMessages)
          ),
          record: completeRead(
            getConversationRecordLocalDataRef('c-active'),
            recordValue('c-active', activeMessages)
          )
        },
        {
          id: 'c-missing',
          catalog: completeRead(
            getConversationCatalogLocalDataRef('c-missing'),
            catalogValue('c-missing', missingMessages)
          ),
          record: incompleteRead(
            getConversationRecordLocalDataRef('c-missing'),
            'conversation record is missing'
          )
        }
      ],
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      stagingHydrated: true,
      legacyBaselineCount: 2,
      legacyBaselineObjectIds: ['c-active', 'c-missing'],
      activeBaselineObjectIds: ['c-active'],
      activeObjectCount: 1,
      activeObjectIds: ['c-active'],
      quarantinedObjectCount: 1,
      quarantinedObjectIds: ['c-missing'],
      duplicateObjectIdCount: 0,
      activeIncompleteRowCount: 0,
      recoveredMetadata: {
        activeConversationId: 'c-active'
      }
    }));
    expect(() => assertValidMigrationPromotionReport(promotionMeta, report)).not.toThrow();
  });

  it('does not treat incomplete domain metadata as hydrated staging', () => {
    const activeMessages = [message('m-1', 10)];
    const report = buildChatMigrationValidationReportFromRows({
      pointer,
      domainMeta: incompleteRead(getChatDomainMetaLocalDataRef(), 'domain meta is missing'),
      legacyBaselineConversationIds: ['c-active'],
      legacyActiveConversationIds: ['c-active'],
      rows: [{
        id: 'c-active',
        catalog: completeRead(
          getConversationCatalogLocalDataRef('c-active'),
          catalogValue('c-active', activeMessages)
        ),
        record: completeRead(
          getConversationRecordLocalDataRef('c-active'),
          recordValue('c-active', activeMessages)
        )
      }],
      validatedAt: 40
    });

    expect(report.stagingHydrated).toBe(false);
    expect(() => assertValidMigrationPromotionReport(promotionMeta, report)).toThrow(
      'Local data migration validation did not hydrate staging.'
    );
  });
});
