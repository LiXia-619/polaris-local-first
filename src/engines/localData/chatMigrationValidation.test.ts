import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import { assertValidMigrationPromotionReport } from './migrationValidation';
import {
  buildChatMigrationValidationReport,
  type ChatMigrationHydratedConversation
} from './chatMigrationValidation';
import type {
  ChatDomainMetaRow,
  CommitPointerRow,
  ConversationCatalogRow,
  ConversationRecordRow
} from './types';

const pointer: CommitPointerRow = {
  domain: 'chat',
  version: 3,
  committedAt: 30,
  commitId: 'chat-commit'
};

const meta = {
  domain: 'chat' as const,
  version: 3,
  committedAt: 30,
  commitId: 'chat-commit'
};

function message(id: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'user',
    content: `message ${id}`,
    timestamp
  };
}

function domainMeta(
  activeConversationId: string | null,
  counts = {
    activeConversationCount: 2,
    quarantinedConversationCount: 1,
    totalConversationCount: 3
  }
): ChatDomainMetaRow {
  return {
    id: 'chat',
    activeConversationId,
    activeConversationCount: counts.activeConversationCount,
    quarantinedConversationCount: counts.quarantinedConversationCount,
    totalConversationCount: counts.totalConversationCount,
    updatedAt: 30
  };
}

function domainMetaWithCounts(
  activeConversationId: string | null,
  counts: {
    activeConversationCount: number;
    quarantinedConversationCount: number;
    totalConversationCount: number;
  }
): ChatDomainMetaRow {
  return domainMeta(activeConversationId, counts);
}

function activeConversation(id: string, timestamps: number[]): ChatMigrationHydratedConversation {
  const messages = timestamps.map((timestamp, index) => message(`${id}-m-${index + 1}`, timestamp));
  const catalog: ConversationCatalogRow = {
    id,
    title: id,
    collaboratorId: 'pharos',
    activeProjectId: 'project-1',
    pinnedAt: null,
    updatedAt: 30,
    messageCount: messages.length,
    latestMessageTimestamp: Math.max(0, ...timestamps),
    state: 'active',
    recordVersion: 3
  };
  const record: ConversationRecordRow = {
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

  return {
    state: 'active',
    catalog,
    record
  };
}

describe('buildChatMigrationValidationReport', () => {
  it('builds promotion evidence for hydrated active rows plus quarantined legacy objects', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMeta('c-1'),
      legacyBaselineConversationIds: ['c-1', 'c-2', 'c-bad'],
      legacyActiveConversationIds: ['c-1', 'c-2'],
      conversations: [
        activeConversation('c-1', [10, 20]),
        activeConversation('c-2', [15]),
        {
          state: 'quarantined',
          id: 'c-bad',
          reason: 'legacy record body is missing'
        }
      ],
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      id: 'chat:chat-commit:validation',
      domain: 'chat',
      commitId: 'chat-commit',
      version: 3,
      stagingHydrated: true,
      legacyBaselineCount: 3,
      legacyBaselineObjectIds: ['c-1', 'c-2', 'c-bad'],
      activeBaselineObjectIds: ['c-1', 'c-2'],
      activeObjectCount: 2,
      activeObjectIds: ['c-1', 'c-2'],
      quarantinedObjectCount: 1,
      quarantinedObjectIds: ['c-bad'],
      duplicateObjectIdCount: 0,
      activeIncompleteRowCount: 0,
      activeTimedOutRowCount: 0,
      recoveredMetadata: {
        activeConversationId: 'c-1'
      }
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).not.toThrow();
  });

  it('marks active projection rows incomplete when catalog and record disagree', () => {
    const mismatched = activeConversation('c-1', [10, 20]);
    if (mismatched.state !== 'active') throw new Error('test setup failed');
    mismatched.catalog.messageCount = 3;

    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-1', {
        activeConversationCount: 1,
        quarantinedConversationCount: 0,
        totalConversationCount: 1
      }),
      legacyBaselineConversationIds: ['c-1'],
      legacyActiveConversationIds: ['c-1'],
      conversations: [mismatched],
      validatedAt: 40
    });

    expect(report.activeIncompleteRowCount).toBe(1);
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation contains non-complete active rows.'
    );
  });

  it('reports active conversations whose collaborator ids are missing from the recovered persona directory', () => {
    const knownConversation = activeConversation('c-known', [10]);
    const orphanConversation = activeConversation('c-orphan', [20]);
    if (knownConversation.state !== 'active' || orphanConversation.state !== 'active') {
      throw new Error('test setup failed');
    }
    knownConversation.catalog.collaboratorId = 'pharos';
    orphanConversation.catalog.collaboratorId = 'persona-missing';

    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-known', {
        activeConversationCount: 2,
        quarantinedConversationCount: 0,
        totalConversationCount: 2
      }),
      legacyBaselineConversationIds: ['c-known', 'c-orphan'],
      legacyActiveConversationIds: ['c-known', 'c-orphan'],
      knownCollaboratorIds: ['pharos'],
      conversations: [knownConversation, orphanConversation],
      validatedAt: 40
    });

    expect(report.missingActiveCollaboratorIds).toEqual(['persona-missing']);
    expect(report.missingActiveCollaboratorIdCount).toBe(1);
    expect(() => assertValidMigrationPromotionReport(meta, report)).not.toThrow();
  });

  it('does not treat missing domain metadata as hydrated staging', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: null,
      legacyBaselineConversationIds: ['c-1'],
      legacyActiveConversationIds: ['c-1'],
      conversations: [activeConversation('c-1', [10])],
      validatedAt: 40
    });

    expect(report.stagingHydrated).toBe(false);
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation did not hydrate staging.'
    );
  });

  it('does not treat mismatched domain metadata counts as hydrated staging', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-1', {
        activeConversationCount: 2,
        quarantinedConversationCount: 0,
        totalConversationCount: 2
      }),
      legacyBaselineConversationIds: ['c-1'],
      legacyActiveConversationIds: ['c-1'],
      conversations: [activeConversation('c-1', [10])],
      validatedAt: 40
    });

    expect(report.stagingHydrated).toBe(false);
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation did not hydrate staging.'
    );
  });

  it('does not recover an active conversation id that points outside the active projection', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-quarantined', {
        activeConversationCount: 1,
        quarantinedConversationCount: 1,
        totalConversationCount: 2
      }),
      legacyBaselineConversationIds: ['c-1', 'c-quarantined'],
      legacyActiveConversationIds: ['c-1'],
      conversations: [
        activeConversation('c-1', [10]),
        {
          state: 'quarantined',
          id: 'c-quarantined',
          reason: 'legacy body is missing'
        }
      ],
      validatedAt: 40
    });

    expect(report.recoveredMetadata.activeConversationId).toBeNull();
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation degraded activeConversationId without a reason.'
    );
  });

  it('rejects active conversation degradation when the active projection shrinks', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts(null, {
        activeConversationCount: 0,
        quarantinedConversationCount: 1,
        totalConversationCount: 1
      }),
      legacyBaselineConversationIds: ['c-active'],
      legacyActiveConversationIds: ['c-active'],
      conversations: [{
        state: 'quarantined',
        id: 'c-active',
        reason: 'active conversation record is missing'
      }],
      metadataDegradationReasons: {
        activeConversationId: 'legacy active conversation points at a quarantined object'
      },
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      activeObjectCount: 0,
      quarantinedObjectCount: 1,
      recoveredMetadata: {
        activeConversationId: null
      }
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation shrank the active projection.'
    );
  });

  it('rejects active projection replacement even when the active count stays the same', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-x', {
        activeConversationCount: 2,
        quarantinedConversationCount: 0,
        totalConversationCount: 2
      }),
      legacyBaselineConversationIds: ['c-a', 'c-b'],
      legacyActiveConversationIds: ['c-a', 'c-b'],
      conversations: [
        activeConversation('c-x', [10]),
        activeConversation('c-y', [20])
      ],
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      activeBaselineObjectIds: ['c-a', 'c-b'],
      activeObjectCount: 2,
      activeObjectIds: ['c-x', 'c-y']
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation shrank the active projection.'
    );
  });

  it('rejects legacy baseline replacement even when active plus quarantine counts stay the same', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-x', {
        activeConversationCount: 1,
        quarantinedConversationCount: 1,
        totalConversationCount: 2
      }),
      legacyBaselineConversationIds: ['c-a', 'c-b'],
      legacyActiveConversationIds: [],
      conversations: [
        activeConversation('c-x', [10]),
        {
          state: 'quarantined',
          id: 'c-y',
          reason: 'wrong object preserved'
        }
      ],
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      legacyBaselineObjectIds: ['c-a', 'c-b'],
      activeObjectIds: ['c-x'],
      quarantinedObjectIds: ['c-y']
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation lost legacy object ids.'
    );
  });

  it('rejects duplicate active conversation ids as invalid migration evidence', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-1', {
        activeConversationCount: 1,
        quarantinedConversationCount: 0,
        totalConversationCount: 1
      }),
      legacyBaselineConversationIds: ['c-1'],
      legacyActiveConversationIds: ['c-1'],
      conversations: [
        activeConversation('c-1', [10]),
        activeConversation('c-1', [20])
      ],
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      activeObjectCount: 1,
      quarantinedObjectCount: 0,
      duplicateObjectIdCount: 1
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation contains duplicate object ids.'
    );
  });

  it('rejects duplicate quarantined conversation ids as invalid migration evidence', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts(null, {
        activeConversationCount: 0,
        quarantinedConversationCount: 1,
        totalConversationCount: 1
      }),
      legacyBaselineConversationIds: ['c-bad'],
      legacyActiveConversationIds: [],
      conversations: [
        {
          state: 'quarantined',
          id: 'c-bad',
          reason: 'legacy record body is missing'
        },
        {
          state: 'quarantined',
          id: 'c-bad',
          reason: 'legacy record catalog is missing'
        }
      ],
      metadataDegradationReasons: {
        activeConversationId: 'legacy active conversation is unavailable'
      },
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      activeObjectCount: 0,
      quarantinedObjectCount: 1,
      duplicateObjectIdCount: 1
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation contains duplicate object ids.'
    );
  });

  it('rejects active and quarantined conversation id overlap', () => {
    const report = buildChatMigrationValidationReport({
      pointer,
      domainMeta: domainMetaWithCounts('c-1', {
        activeConversationCount: 1,
        quarantinedConversationCount: 1,
        totalConversationCount: 1
      }),
      legacyBaselineConversationIds: ['c-1'],
      legacyActiveConversationIds: ['c-1'],
      conversations: [
        activeConversation('c-1', [10]),
        {
          state: 'quarantined',
          id: 'c-1',
          reason: 'duplicate quarantined shell'
        }
      ],
      validatedAt: 40
    });

    expect(report).toEqual(expect.objectContaining({
      activeObjectCount: 1,
      quarantinedObjectCount: 1,
      duplicateObjectIdCount: 1
    }));
    expect(() => assertValidMigrationPromotionReport(meta, report)).toThrow(
      'Local data migration validation contains duplicate object ids.'
    );
  });
});
