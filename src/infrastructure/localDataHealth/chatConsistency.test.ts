import { describe, expect, it } from 'vitest';
import { buildLocalChatPersistenceHealth } from './chatConsistency';
import type { PersistedDbEntry } from '../persistence';

const kv = (entries: Array<{ key: string; value: unknown }>): PersistedDbEntry[] => entries;

describe('buildLocalChatPersistenceHealth', () => {
  it('reports an empty store as having no catalog or pointer', () => {
    const health = buildLocalChatPersistenceHealth(kv([]));
    expect(health).toEqual(expect.objectContaining({
      hasCatalog: false,
      hasCommitPointer: false,
      hasCurrentManifest: false,
      catalogConversationCount: 0,
      conversationRecordCount: 0,
      legacyMessageChunkCount: 0
    }));
  });

  it('counts catalog conversations, records, manifest, and quarantine without reading message text', () => {
    const health = buildLocalChatPersistenceHealth(kv([
      { key: 'chat-commit-pointer-v1', value: { schemaVersion: 1, currentCommitId: 'commit-1' } },
      {
        key: 'chat-manifest-v1:commit-1',
        value: {
          schemaVersion: 1,
          commitId: 'commit-1',
          conversations: [{ id: 'c-1', messageKey: 'chat-message-v1:commit-1:c-1' }],
          quarantinedConversationIds: ['c-orphan']
        }
      },
      { key: 'chat-message-v1:commit-1:c-1', value: [{ role: 'user', content: 'secret' }] },
      {
        key: 'chat-catalog-v1',
        value: {
          conversations: [{ id: 'c-1', recordKey: 'chat-conversation-record-v1:c-1' }],
          deletedConversationIds: [],
          quarantinedConversationIds: ['c-orphan']
        }
      },
      { key: 'chat-conversation-record-v1:c-1', value: { id: 'c-1', messages: [{ content: 'secret' }] } },
      { key: 'chat-messages-v2:c-1', value: [{ content: 'secret' }] }
    ]));

    expect(health).toEqual(expect.objectContaining({
      hasCatalog: true,
      catalogConversationCount: 1,
      conversationRecordCount: 1,
      missingConversationRecordCount: 0,
      orphanedConversationRecordCount: 0,
      deletedCatalogConversationCount: 0,
      hasCommitPointer: true,
      hasCurrentManifest: true,
      manifestConversationCount: 1,
      quarantinedConversationCount: 1,
      legacyMessageChunkCount: 1
    }));
  });

  it('counts orphan, stale, and tombstoned chat evidence', () => {
    const health = buildLocalChatPersistenceHealth(kv([
      { key: 'chat-commit-pointer-v1', value: { schemaVersion: 1, currentCommitId: 'commit-current' } },
      {
        key: 'chat-manifest-v1:commit-current',
        value: {
          schemaVersion: 1,
          commitId: 'commit-current',
          conversations: [{ id: 'c-current', messageKey: 'chat-message-v1:commit-current:c-current' }],
          deletedConversationIds: ['c-deleted']
        }
      },
      { key: 'chat-manifest-v1:commit-old', value: { schemaVersion: 1, commitId: 'commit-old', conversations: [] } },
      { key: 'chat-message-v1:commit-current:c-current', value: [{ content: 'secret' }] },
      { key: 'chat-message-v1:commit-old:c-old', value: [{ content: 'secret' }] },
      { key: 'chat-messages-v2:c-current', value: [{ content: 'secret' }] },
      { key: 'chat-messages-v2:c-orphan', value: [{ content: 'secret' }] },
      { key: 'chat-messages-v2:c-deleted', value: [{ content: 'secret' }] },
      { key: 'chat-conversation-v1:c-deleted', value: { id: 'c-deleted' } },
      { key: 'chat-conversation-v1:c-orphan', value: { id: 'c-orphan' } },
      { key: 'chat-index-v2-pending', value: { conversations: [] } }
    ]));

    expect(health).toEqual(expect.objectContaining({
      orphanedLegacyMessageChunkCount: 1,
      staleCommitManifestCount: 1,
      staleCommittedMessageChunkCount: 1,
      tombstonedLegacyMessageChunkCount: 1,
      tombstonedConversationEnvelopeCount: 1,
      pendingLegacyIndexCount: 1,
      legacyMessageChunkCount: 3
    }));
  });
});
