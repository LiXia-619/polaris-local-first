import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import type { Conversation } from '../../types/domain';
import { buildStableAssetGovernanceReferences } from './assetGovernanceReferences';
import {
  cancelAllDerivedDataWork,
  pauseDerivedDataWorkQueue,
  readStableCompleteChatConversationsForDerivedDataWork,
  resumeDerivedDataWorkQueue,
  runDerivedDataWork
} from './derivedDataWork';
import {
  buildChatDomainMetaLocalDataRow,
  buildConversationLocalDataProjection,
  getChatDomainMetaLocalDataRef,
  getConversationCatalogLocalDataRef,
  getConversationRecordLocalDataRef,
  getLocalDataRowKey
} from '../../engines/localData';

const persistence = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const kvKeys = vi.fn(async () => [...values.keys()]);
  const kvKeysWithPrefix = vi.fn(async (prefix: string) => [...values.keys()].filter((key) => key.startsWith(prefix)));
  const kvGet = vi.fn(async (key: string) => values.get(key) ?? null);
  const kvApplyMutations = vi.fn(async () => undefined);
  const getPersistenceLocalDataCommitMode = vi.fn(() => 'transactional');
  return {
    values,
    kvKeys,
    kvKeysWithPrefix,
    kvGet,
    kvApplyMutations,
    getPersistenceLocalDataCommitMode
  };
});

vi.mock('../../infrastructure/persistence', () => ({
  kvKeys: persistence.kvKeys,
  kvKeysWithPrefix: persistence.kvKeysWithPrefix,
  kvGet: persistence.kvGet,
  kvApplyMutations: persistence.kvApplyMutations,
  getPersistenceLocalDataCommitMode: persistence.getPersistenceLocalDataCommitMode
}));

function createConversation(content = '持久化里的完整正文。'): Conversation {
  return {
    id: 'c1',
    title: '派生任务',
    collaboratorId: 'aa',
    messages: [{
      id: 'm1',
      role: 'user',
      content,
      timestamp: 100
    }],
    pinnedAt: null,
    updatedAt: 100
  };
}

function seedLiveChatState(conversation = createConversation()) {
  const now = conversation.updatedAt;
  const projection = buildConversationLocalDataProjection({
    conversation,
    bodyState: 'complete',
    version: 1,
    committedAt: now
  });
  const domainMeta = buildChatDomainMetaLocalDataRow({
    activeConversationId: conversation.id,
    activeConversationCount: 1,
    quarantinedConversationCount: 0,
    totalConversationCount: 1,
    version: 1,
    updatedAt: now
  });

  persistence.values.set(getLocalDataRowKey(getChatDomainMetaLocalDataRef()), domainMeta);
  persistence.values.set(getLocalDataRowKey(getConversationCatalogLocalDataRef(conversation.id)), projection.catalogRow);
  if (projection.recordRow) {
    persistence.values.set(getLocalDataRowKey(getConversationRecordLocalDataRef(conversation.id)), projection.recordRow);
  }
}

function hydrateDerivedWorkStores() {
  useChatStore.setState({
    conversations: [createConversation('store 里不该被 asset audit 当完整正文。')],
    activeConversationId: 'c1',
    hydrated: true,
    dirtyConversationIds: [],
    deletedConversationIds: [],
    loadingMessageConversationIds: []
  });
  usePersonaStore.setState({
    personas: [],
    hydrated: true
  });
  useRuntimeStore.setState({
    hydrated: true
  });
  useCollectionStore.setState({
    hydrated: true
  });
}

describe('derived data work', () => {
  beforeEach(() => {
    persistence.values.clear();
    persistence.kvKeys.mockClear();
    persistence.kvKeysWithPrefix.mockClear();
    persistence.kvGet.mockClear();
    persistence.kvApplyMutations.mockClear();
    resumeDerivedDataWorkQueue();
    seedLiveChatState();
    hydrateDerivedWorkStores();
  });

  afterEach(() => {
    cancelAllDerivedDataWork();
    resumeDerivedDataWorkQueue();
  });

  it('reads complete conversation bodies from live LocalData without hydrating the live store', async () => {
    const conversations = await readStableCompleteChatConversationsForDerivedDataWork('conversation_summary');

    expect(conversations[0]?.messages[0]?.content).toBe('持久化里的完整正文。');
    expect(useChatStore.getState().conversations[0]?.messages[0]?.content).toBe('store 里不该被 asset audit 当完整正文。');
  });

  it('rejects derived work while source chat writes are pending', async () => {
    useChatStore.setState({
      dirtyConversationIds: ['c1']
    });

    await expect(readStableCompleteChatConversationsForDerivedDataWork('asset_audit')).rejects.toThrow('未落盘更改');
  });

  it('builds asset audit references from stable live LocalData conversations', async () => {
    const references = await buildStableAssetGovernanceReferences();

    expect(references.conversations[0]?.messages[0]?.content).toBe('持久化里的完整正文。');
  });

  it('lets foreground derived work run before queued background work', async () => {
    pauseDerivedDataWorkQueue();
    const events: string[] = [];
    const background = runDerivedDataWork({
      kind: 'memory_vector_index',
      priority: 'background',
      run: async () => {
        events.push('background');
      }
    });
    const foreground = runDerivedDataWork({
      kind: 'asset_audit',
      priority: 'foreground',
      run: async () => {
        events.push('foreground');
      }
    });

    resumeDerivedDataWorkQueue();
    await Promise.all([background, foreground]);

    expect(events).toEqual(['foreground', 'background']);
  });

  it('rejects queued work immediately when the caller cancels it', async () => {
    pauseDerivedDataWorkQueue();
    const controller = new AbortController();
    const run = vi.fn(async () => undefined);
    const work = runDerivedDataWork({
      kind: 'conversation_summary',
      signal: controller.signal,
      run
    });

    controller.abort(new Error('用户取消整理。'));

    await expect(work).rejects.toThrow('用户取消整理。');
    resumeDerivedDataWorkQueue();
    expect(run).not.toHaveBeenCalled();
  });
});
