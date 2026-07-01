import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockChatPersistence(factory: () => Record<string, unknown>) {
  const currentPersistence = factory();
  vi.doMock('./chatCurrentPersistence', () => currentPersistence);
}

describe('store hydration failures', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps chat unhydrated when strict chat persistence read fails', async () => {
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatArchiveState: vi.fn(async () => null),
      readChatState: vi.fn(async () => {
        throw new Error('db unavailable');
      }),
      readLiveChatStateWithOptions: vi.fn(async () => {
        throw new Error('db unavailable');
      }),
      copyArchivedConversationToLocalDataRepository: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');

    await useChatStore.getState().hydrateFromDb();

    expect(useChatStore.getState().hydrated).toBe(false);
  });

  it('keeps lazy chat messages unloaded when strict message reads fail', async () => {
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatArchiveState: vi.fn(async () => null),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(),
      copyArchivedConversationToLocalDataRepository: vi.fn(),
      readConversationMessages: vi.fn(async () => {
        throw new Error('message chunk missing');
      }),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');
    useChatStore.setState({
      conversations: [{
        id: 'c-missing',
        title: 'Monday',
        collaboratorId: 'monday',
        draft: '',
        pinnedAt: null,
        updatedAt: 1,
        messages: []
      }],
      activeConversationId: 'c-missing',
      loadedMessageConversationIds: [],
      loadingMessageConversationIds: []
    });

    await expect(useChatStore.getState().ensureConversationMessagesLoaded('c-missing')).rejects.toThrow('message chunk missing');

    expect(useChatStore.getState().loadedMessageConversationIds).toEqual([]);
    expect(useChatStore.getState().conversations[0]?.messages).toEqual([]);
  });

  it('marks a lazy conversation body missing when its message chunk is definitively missing', async () => {
    const writeChatState = vi.fn();
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatArchiveState: vi.fn(async () => null),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(),
      copyArchivedConversationToLocalDataRepository: vi.fn(),
      readConversationMessages: vi.fn(async (conversationId: string) => {
        throw new Error(`Conversation message chunk is missing: ${conversationId}`);
      }),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState
    }));

    const { useChatStore } = await import('./chatStore');
    const keepConversation = {
      id: 'c-keep',
      title: 'Keep',
      collaboratorId: 'pharos',
      draft: 'keep draft',
      pinnedAt: null,
      updatedAt: 2,
      messages: []
    };
    const missingConversation = {
      id: 'c-missing',
      title: 'Missing',
      collaboratorId: 'pharos',
      draft: 'missing draft',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    useChatStore.setState({
      conversations: [missingConversation, keepConversation],
      activeConversationId: missingConversation.id,
      loadedMessageConversationIds: [],
      loadingMessageConversationIds: [],
      inputDraft: missingConversation.draft,
      pendingWorkspaceProposals: [{
        id: 'proposal-missing',
        conversationId: missingConversation.id,
        source: 'model-proposed',
        requestedActionKinds: [],
        requestedActions: [],
        status: 'pending',
        createdAt: 1,
      }],
      transientRuntimeFeedbackEventsByConversationId: {
        [missingConversation.id]: []
      },
      workspaceScopeEventsByConversationId: {
        [missingConversation.id]: []
      },
      dirtyConversationIds: [missingConversation.id],
      deletedConversationIds: [],
      hydrated: true
    });

    await expect(useChatStore.getState().ensureConversationMessagesLoaded(missingConversation.id))
      .rejects.toThrow(`Conversation message chunk is missing: ${missingConversation.id}`);

    expect(useChatStore.getState().conversations).toEqual([missingConversation, keepConversation]);
    expect(useChatStore.getState().activeConversationId).toBe(missingConversation.id);
    expect(useChatStore.getState().inputDraft).toBe(missingConversation.draft);
    expect(useChatStore.getState().loadedMessageConversationIds).toEqual([]);
    expect(useChatStore.getState().conversationBodyStatuses[missingConversation.id]).toEqual(expect.objectContaining({
      state: 'missing',
      reason: `Conversation message chunk is missing: ${missingConversation.id}`
    }));
    expect(useChatStore.getState().deletedConversationIds).toEqual([]);
    expect(useChatStore.getState().pendingWorkspaceProposals).toHaveLength(1);
    expect(useChatStore.getState().transientRuntimeFeedbackEventsByConversationId).toEqual({
      [missingConversation.id]: []
    });
    expect(useChatStore.getState().workspaceScopeEventsByConversationId).toEqual({
      [missingConversation.id]: []
    });
    expect(writeChatState).not.toHaveBeenCalled();
  });

  it('uses explicit body status instead of empty message arrays when writing loaded bodies', async () => {
    const writeChatState = vi.fn();
    const persistChatStateChange = vi.fn();
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatArchiveState: vi.fn(async () => null),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(),
      copyArchivedConversationToLocalDataRepository: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      persistChatStateChange,
      writeChatState
    }));

    const { useChatStore } = await import('./chatStore');
    const { persistChatStateChange: mockedPersistChatStateChange } = await import('./chatCurrentPersistence');
    const loadedConversation = {
      id: 'c-loaded',
      title: 'Loaded empty',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 2,
      messages: []
    };
    const missingConversation = {
      id: 'c-missing',
      title: 'Missing body',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    useChatStore.setState({
      conversations: [loadedConversation, missingConversation],
      activeConversationId: loadedConversation.id,
      conversationBodyStatuses: {
        [loadedConversation.id]: { state: 'loaded', updatedAt: 2 },
        [missingConversation.id]: {
          state: 'missing',
          updatedAt: 3,
          reason: `Conversation message chunk is missing: ${missingConversation.id}`
        }
      },
      loadedMessageConversationIds: [loadedConversation.id, missingConversation.id],
      loadingMessageConversationIds: [],
      dirtyConversationIds: [loadedConversation.id, missingConversation.id],
      deletedConversationIds: [],
      conversationPersistVersion: 1,
      hydrated: true
    });

    await useChatStore.getState().persistToDb();

    expect(mockedPersistChatStateChange).toHaveBeenCalledWith(expect.objectContaining({
      dirtyConversationIds: [loadedConversation.id, missingConversation.id],
      loadedConversationIds: [loadedConversation.id]
    }));
  });

  it('promotes recovered chat hydration from complete conversation bodies after startup hydration', async () => {
    vi.useFakeTimers();
    const activeConversation = {
      id: 'c-active',
      title: '当前',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 2,
      messages: [{
        id: 'm-active',
        role: 'user',
        content: '当前正文',
        timestamp: 2
      }]
    };
    const unloadedConversation = {
      id: 'c-old',
      title: '旧对话',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    const completeOldConversation = {
      ...unloadedConversation,
      messages: [{
        id: 'm-old',
        role: 'user',
        content: '旧正文也要迁成完整记录',
        timestamp: 1
      }]
    };
    const legacyGroupConversation = {
      id: 'c-group',
      title: '旧群聊',
      collaboratorId: null,
      groupRoomId: 'g-old',
      draft: '',
      pinnedAt: null,
      updatedAt: 3,
      messages: []
    };
    const completeLegacyGroupConversation = {
      ...legacyGroupConversation,
      messages: [{
        id: 'm-group',
        role: 'user',
        content: '旧群聊正文要清掉',
        timestamp: 3
      }]
    };
    const readCompleteLiveChatState = vi.fn(async () => ({
      conversations: [activeConversation, completeOldConversation, completeLegacyGroupConversation],
      activeConversationId: activeConversation.id,
      loadedConversationIds: [activeConversation.id, completeOldConversation.id, completeLegacyGroupConversation.id]
    }));
    const writeChatState = vi.fn();
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState,
      readChatArchiveState: vi.fn(async () => null),
      readChatState: vi.fn(async () => ({
        conversations: [],
        activeConversationId: null,
        loadedConversationIds: []
      })),
      readLiveChatStateWithOptions: vi.fn(async () => ({
        conversations: [activeConversation, unloadedConversation, legacyGroupConversation],
        activeConversationId: activeConversation.id,
        loadedConversationIds: [activeConversation.id, legacyGroupConversation.id],
        recoveredConversationIds: [activeConversation.id, unloadedConversation.id, legacyGroupConversation.id],
        shouldCommitSnapshot: true
      })),
      copyArchivedConversationToLocalDataRepository: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState
    }));

    const { useChatStore } = await import('./chatStore');

    await useChatStore.getState().hydrateFromDb();

    expect(useChatStore.getState().hydrated).toBe(true);
    expect(useChatStore.getState().conversations).toEqual([activeConversation, unloadedConversation]);
    expect(readCompleteLiveChatState).not.toHaveBeenCalled();
    expect(writeChatState).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(readCompleteLiveChatState).toHaveBeenCalledWith({ throwOnReadFailure: true });
    expect(writeChatState).toHaveBeenCalledWith({
      conversations: [activeConversation, completeOldConversation],
      activeConversationId: activeConversation.id,
      activeGroupRoomId: null,
      groupRooms: [],
      dirtyConversationIds: [activeConversation.id, completeOldConversation.id],
      loadedConversationIds: [activeConversation.id, completeOldConversation.id],
      deletedConversationIds: [completeLegacyGroupConversation.id],
      quarantinedConversationIds: []
    });
  });

  it('drops legacy archive shells from normal chat hydration when live chat is empty', async () => {
    vi.useFakeTimers();
    const archivedConversation = {
      id: 'c-archive',
      title: '旧标题',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(async () => ({
        conversations: [archivedConversation],
        activeConversationId: null,
        loadedConversationIds: [],
        legacyLifecycleByConversationId: { 'c-archive': { state: 'archive', reason: null } }
      })),
      recoverArchivedChatConversation: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');

    await useChatStore.getState().hydrateFromDb();

    expect(useChatStore.getState().hydrated).toBe(true);
    expect(useChatStore.getState().activeConversationId).toBeNull();
    expect(useChatStore.getState().conversations).toEqual([]);
    expect(useChatStore.getState().loadedMessageConversationIds).toEqual([]);
    expect(useChatStore.getState().conversationBodyStatuses).toEqual({});
  });

  it('drops legacy archive shells from normal chat hydration when live chat exists', async () => {
    const liveConversation = {
      id: 'c-live',
      title: '当前',
      collaboratorId: 'pharos',
      draft: 'live draft',
      pinnedAt: null,
      updatedAt: 2,
      messages: [{
        id: 'm-live',
        role: 'user',
        content: 'live',
        timestamp: 2
      }]
    };
    const archivedShell = {
      id: 'c-archive',
      title: '旧标题',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    const recoverArchivedChatConversation = vi.fn();
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(async () => ({
        conversations: [liveConversation, archivedShell],
        activeConversationId: liveConversation.id,
        loadedConversationIds: [liveConversation.id],
        legacyLifecycleByConversationId: { [archivedShell.id]: { state: 'archive', reason: null } }
      })),
      recoverArchivedChatConversation,
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');

    await useChatStore.getState().hydrateFromDb();

    expect(useChatStore.getState().activeConversationId).toBe(liveConversation.id);
    expect(recoverArchivedChatConversation).not.toHaveBeenCalled();
    expect(useChatStore.getState().inputDraft).toBe(liveConversation.draft);
    expect(useChatStore.getState().loadedMessageConversationIds).toEqual([liveConversation.id]);
    expect(useChatStore.getState().conversations).toEqual([liveConversation]);
  });

  it('does not accept an archive-only active pointer as live chat truth', async () => {
    const liveConversation = {
      id: 'c-live',
      title: '当前',
      collaboratorId: 'pharos',
      draft: 'live draft',
      pinnedAt: null,
      updatedAt: 2,
      messages: [{
        id: 'm-live',
        role: 'user',
        content: 'live',
        timestamp: 2
      }]
    };
    const archivedShell = {
      id: 'c-archive',
      title: '旧标题',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(async () => ({
        conversations: [liveConversation, archivedShell],
        activeConversationId: archivedShell.id,
        loadedConversationIds: [liveConversation.id],
        legacyLifecycleByConversationId: { [archivedShell.id]: { state: 'archive', reason: null } }
      })),
      recoverArchivedChatConversation: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');

    await useChatStore.getState().hydrateFromDb();

    expect(useChatStore.getState().activeConversationId).toBe(liveConversation.id);
    expect(useChatStore.getState().inputDraft).toBe(liveConversation.draft);
    expect(useChatStore.getState().loadedMessageConversationIds).toEqual([liveConversation.id]);
    expect(useChatStore.getState().conversations).toEqual([liveConversation]);
    expect(useChatStore.getState().conversationBodyStatuses[archivedShell.id]).toBeUndefined();
  });

  it('keeps chat unhydrated when the active pointer is missing from normal live conversations', async () => {
    const liveConversation = {
      id: 'c-live',
      title: 'Live',
      collaboratorId: 'pharos',
      draft: 'live draft',
      pinnedAt: null,
      updatedAt: 2,
      messages: [{
        id: 'm-live',
        role: 'user',
        content: 'live',
        timestamp: 2
      }]
    };
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(async () => ({
        conversations: [liveConversation],
        activeConversationId: 'c-missing',
        loadedConversationIds: [liveConversation.id],
        legacyLifecycleByConversationId: {}
      })),
      recoverArchivedChatConversation: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');

    await expect(useChatStore.getState().hydrateFromDb())
      .rejects.toThrow('Active chat state points at a missing conversation: c-missing');

    expect(useChatStore.getState().hydrated).toBe(false);
    expect(useChatStore.getState().conversations).toEqual([]);
    expect(useChatStore.getState().activeConversationId).toBeNull();
  });

  it('keeps normal chat empty when only archive lifecycle rows are available', async () => {
    const archivedShell = {
      id: 'c-archive',
      title: '旧标题',
      collaboratorId: 'pharos',
      draft: '',
      pinnedAt: null,
      updatedAt: 1,
      messages: []
    };
    mockChatPersistence(() => ({
      readCompleteChatState: vi.fn(),
      readCompleteLiveChatState: vi.fn(),
      readChatState: vi.fn(),
      readLiveChatStateWithOptions: vi.fn(async () => ({
        conversations: [archivedShell],
        activeConversationId: archivedShell.id,
        loadedConversationIds: [],
        legacyLifecycleByConversationId: { [archivedShell.id]: { state: 'archive', reason: null } }
      })),
      recoverArchivedChatConversation: vi.fn(),
      readConversationMessages: vi.fn(),
      sortConversations: vi.fn((conversations) => conversations),
      writeChatState: vi.fn()
    }));

    const { useChatStore } = await import('./chatStore');

    await useChatStore.getState().hydrateFromDb();

    expect(useChatStore.getState().activeConversationId).toBeNull();
    expect(useChatStore.getState().inputDraft).toBe('');
    expect(useChatStore.getState().conversations).toEqual([]);
    expect(useChatStore.getState().loadedMessageConversationIds).toEqual([]);
    expect(useChatStore.getState().conversationBodyStatuses[archivedShell.id]).toBeUndefined();
  });

  it('keeps collection unhydrated when strict collection persistence read fails', async () => {
    vi.doMock('./collectionStorePersistence', () => ({
      readCollectionState: vi.fn(async () => {
        throw new Error('db unavailable');
      }),
      writeCollectionState: vi.fn()
    }));

    const { useCollectionStore } = await import('./collectionStore');

    await useCollectionStore.getState().hydrateFromDb();

    expect(useCollectionStore.getState().hydrated).toBe(false);
  });

  it('keeps runtime unhydrated when strict runtime persistence read fails', async () => {
    vi.doMock('./runtimeStorePersistence', () => ({
      hydrateFromDb: vi.fn(async () => {
        throw new Error('db unavailable');
      }),
      persistToDb: vi.fn()
    }));

    const { useRuntimeStore } = await import('./runtimeStore');

    await useRuntimeStore.getState().hydrateFromDb();

    expect(useRuntimeStore.getState().hydrated).toBe(false);
  });
});
