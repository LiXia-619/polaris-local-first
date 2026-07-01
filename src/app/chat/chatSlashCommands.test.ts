import { describe, expect, it, vi } from 'vitest';
import { createChatSlashCommandHandler } from './chatSlashCommands';

function createHarness(options?: {
  writableActiveMessages?: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }>;
}) {
  const userMessage = { id: 'user-1', role: 'user', content: '写一个按钮', timestamp: 1 };
  const assistantMessage = {
    id: 'assistant-1',
    role: 'assistant',
    content: '可以这样：\n\n```tsx\n<button>ok</button>\n```',
    timestamp: 2
  };
  const activeConversation = {
    id: 'conversation-1',
    title: '按钮',
    collaboratorId: 'pharos',
    activeProjectId: null,
    pinnedAt: null,
    messages: [userMessage, assistantMessage]
  };
  const setCommandStatus = vi.fn();
  const setInputDraft = vi.fn();
  const createConversation = vi.fn(() => 'conversation-fork');
  const replaceConversationMessages = vi.fn();
  const setActiveConversation = vi.fn();
  const createCard = vi.fn(() => 'card-1');
  const addMessage = vi.fn();
  const ensureConversationWritable = vi.fn(async (conversationId: string) => ({
    conversationId,
    conversation: conversationId === activeConversation.id
      ? activeConversation
      : { ...activeConversation, id: conversationId, messages: [] },
    messages: conversationId === activeConversation.id
      ? (options?.writableActiveMessages ?? activeConversation.messages)
      : []
  }));
  const setConversationActiveProject = vi.fn();
  const setConversationTask = vi.fn();
  const setTaskModeEnabled = vi.fn();
  const setActiveProvider = vi.fn();
  const updateProvider = vi.fn();
  const setActiveCollaborator = vi.fn();
  const setFrontstageCollaboratorId = vi.fn();
  const renameConversation = vi.fn();
  const toggleConversationPinned = vi.fn();
  let triggerRules: any[] = [];
  const createTriggerRule = vi.fn((seed) => {
    const rule = {
      id: 'trigger-1',
      name: seed.name,
      enabled: true,
      source: 'schedule',
      ...seed,
      createdAt: 1,
      updatedAt: 1,
      lastRunAt: null,
      nextRunAt: 2000,
      lastError: null
    };
    triggerRules = [...triggerRules, rule];
    return rule.id;
  });
  const updateTriggerRule = vi.fn((ruleId, patch) => {
    triggerRules = triggerRules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule);
  });
  const deleteTriggerRule = vi.fn((ruleId) => {
    triggerRules = triggerRules.filter((rule) => rule.id !== ruleId);
  });
  const runReply = vi.fn(() => Promise.resolve({ status: 'completed' as const }));
  const saveMessageCodeCard = vi.fn();
  const submitToolAction = vi.fn();

  const handler = createChatSlashCommandHandler({
    ui: {
      sending: false,
      setCommandStatus
    },
    store: {
      chat: {
        conversations: [activeConversation],
        activeConversationId: activeConversation.id,
        inputDraft: '',
        pendingWorkspaceProposals: [],
        createConversation,
        ensureConversationWritable,
        addMessage,
        orphanConversation: vi.fn(),
        deleteConversation: vi.fn(),
        setInputDraft,
        replaceConversationMessages,
        setConversationActiveProject,
        upsertPendingWorkspaceProposal: vi.fn(),
        removePendingWorkspaceProposal: vi.fn(),
        appendRuntimeFeedbackEvent: vi.fn(),
        getRuntimeFeedbackEvents: vi.fn(() => []),
        setActiveConversation,
        renameConversation,
        toggleConversationPinned,
        readLatestState: vi.fn(() => ({
          inputDraft: '',
          conversations: [activeConversation],
          activeConversationId: activeConversation.id
        })),
        getConversationMessages: vi.fn(() => activeConversation.messages),
        findConversation: vi.fn(() => activeConversation),
        getConversationTask: vi.fn(() => null),
        setConversationTask
      },
      persona: {
        activeCollaboratorId: 'pharos',
        personas: [{ id: 'pharos', name: 'Pharos' }, { id: 'nova', name: 'Nova' }],
        setActiveCollaborator,
        deleteCollaborator: vi.fn(),
        findCollaborator: vi.fn(),
        updateCollaborator: vi.fn(),
        readLatestState: vi.fn(() => ({
          activeCollaboratorId: 'pharos',
          personas: [{ id: 'pharos', name: 'Pharos' }, { id: 'nova', name: 'Nova' }]
        }))
      },
      collection: {
        cards: [],
        projectFiles: [],
        roomProjects: [{ id: 'project-1', title: '画册', slug: 'album' }],
        imageCards: [],
        createCard,
        createProjectFile: vi.fn(),
        createProject: vi.fn(),
        promoteCardToProject: vi.fn(),
        saveCardFromChat: vi.fn(),
        saveImageCardFromChat: vi.fn(),
        updateCard: vi.fn(),
        updateProjectFile: vi.fn(),
        readLatestState: vi.fn(() => ({ cards: [], imageCards: [], projectFiles: [], roomProjects: [] }))
      },
      runtime: {
        toolPromptPreferences: { theme: true, cards: true, workspace: true, memory: true, attachments: true, web: false, mcp: false },
        taskModeEnabled: false,
        setTaskModeEnabled,
        mcpServers: [],
        mcpToolTimeoutSeconds: 30,
        api: { id: 'provider-openrouter', name: 'OpenRouter', model: 'old-model', baseUrl: 'https://openrouter.ai/api/v1' } as never,
        providers: [
          { id: 'provider-openrouter', name: 'OpenRouter', model: 'old-model', baseUrl: 'https://openrouter.ai/api/v1' },
          { id: 'provider-moonshot', name: 'Moonshot', model: 'kimi-k2', baseUrl: 'https://api.moonshot.cn/v1' }
        ] as never,
        hydrated: true,
        companionConnections: [],
        companionSnapshots: [],
        deleteCompanionConnection: vi.fn(),
        setActiveProvider,
        updateProvider,
        setToolPromptGroupEnabled: vi.fn(),
        triggerRules,
        createTriggerRule,
        updateTriggerRule,
        deleteTriggerRule,
        markTriggerFired: vi.fn(),
        markTriggerFailed: vi.fn(),
        readLatestState: vi.fn(() => ({
          api: { id: 'provider-openrouter', name: 'OpenRouter', model: 'old-model', baseUrl: 'https://openrouter.ai/api/v1' },
          providers: [
            { id: 'provider-openrouter', name: 'OpenRouter', model: 'old-model', baseUrl: 'https://openrouter.ai/api/v1' },
            { id: 'provider-moonshot', name: 'Moonshot', model: 'kimi-k2', baseUrl: 'https://api.moonshot.cn/v1' }
          ],
          triggerRules
        }))
      },
      space: {
        frontstageCollaboratorId: 'pharos',
        setFrontstageCollaboratorId,
        editingCollaboratorId: null,
        setEditingCollaboratorId: vi.fn(),
        pendingCardReference: null,
        pendingAttachments: [],
        setPendingCardReference: vi.fn(),
        clearPendingCardReference: vi.fn(),
        addPendingAttachments: vi.fn(),
        removePendingAttachment: vi.fn(),
        clearPendingAttachments: vi.fn(),
        activeWorld: 'chat',
        collectionShelf: 'code',
        focusedMessageTarget: null,
        activeCardId: null,
        activeThemePreview: null,
        currentThemeFrame: {} as never,
        themeToolMode: 'stable',
        selectedSurfaceCodes: [],
        setWorld: vi.fn(),
        setCollectionShelf: vi.fn(),
        setActiveCard: vi.fn(),
        spotlightCard: vi.fn(),
        setPendingProjectOpenId: vi.fn(),
        setPendingProjectOpenSource: vi.fn(),
        clearSpotlightCard: vi.fn(),
        rollbackPreviewForConversationDeletion: vi.fn(),
        readLatestState: vi.fn(() => ({
          frontstageCollaboratorId: 'pharos',
          pendingCardReference: null,
          pendingAttachments: []
        }))
      }
    } as never,
    derived: {
      activeConversation,
      activeCollaboratorSourceId: 'pharos',
      persona: { id: 'pharos', name: 'Pharos' },
      messages: activeConversation.messages,
      hasUnsupportedPendingImages: false,
      codeCardActionModeByMessageId: {},
      codeCardProgressByMessageId: {},
      displayStreaming: null,
      focusedMessageId: null,
      showThinking: false,
      showLiveThinking: false,
      showEmptyState: false,
      latestRetryableAssistantId: assistantMessage.id,
      activePreviewMessage: null
    } as never,
    toolActions: {
      submitToolAction,
      submitToolCommand: vi.fn(() => Promise.resolve(true)),
      saveMessageCodeCard
    } as never,
    runReply
  });

  return {
    addMessage,
    createCard,
    createConversation,
    handler,
    replaceConversationMessages,
    runReply,
    saveMessageCodeCard,
    setActiveConversation,
    setActiveCollaborator,
    setConversationActiveProject,
    setInputDraft,
    setFrontstageCollaboratorId,
    renameConversation,
    toggleConversationPinned,
    setTaskModeEnabled,
    setConversationTask,
    setActiveProvider,
    updateProvider,
    createTriggerRule,
    updateTriggerRule,
    deleteTriggerRule
  };
}

describe('createChatSlashCommandHandler', () => {
  it('forks the active conversation into a new active thread', async () => {
    const harness = createHarness();

    await harness.handler('/fork');

    expect(harness.createConversation).toHaveBeenCalledWith('pharos', { activeProjectId: null });
    expect(harness.replaceConversationMessages).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-fork'
    }), expect.arrayContaining([
      expect.objectContaining({ content: '写一个按钮' }),
      expect.objectContaining({ content: expect.stringContaining('<button>ok</button>') })
    ]));
    expect(harness.setActiveConversation).toHaveBeenCalledWith('conversation-fork');
    expect(harness.setInputDraft).toHaveBeenCalledWith('');
  });

  it('retries the latest assistant response with an optional instruction', async () => {
    const harness = createHarness();

    await harness.handler('/retry 短一点');

    expect(harness.replaceConversationMessages).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-1'
    }), [
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ role: 'user', content: '重新生成上一条回复，要求：短一点' })
    ]);
    expect(harness.runReply).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-1',
      collaboratorId: 'pharos'
    }));
  });

  it('retries from the writable conversation body instead of stale derived messages', async () => {
    const harness = createHarness({
      writableActiveMessages: [
        { id: 'user-live', role: 'user', content: '用事实源重跑', timestamp: 10 },
        { id: 'assistant-1', role: 'assistant', content: 'live answer', timestamp: 11 }
      ]
    });

    await harness.handler('/retry');

    expect(harness.replaceConversationMessages).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-1'
    }), [
      expect.objectContaining({ id: 'user-live', content: '用事实源重跑' })
    ]);
    expect(harness.runReply).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        expect.objectContaining({ id: 'user-live', content: '用事实源重跑' })
      ]
    }));
  });

  it('undoes the latest user turn and clears a task seeded by that turn', async () => {
    const harness = createHarness();

    await harness.handler('/undo');

    expect(harness.replaceConversationMessages).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-1'
    }), []);
    expect(harness.setInputDraft).toHaveBeenCalledWith('');
  });

  it('routes workspace, persona, pin, and export commands', async () => {
    const harness = createHarness();

    await harness.handler('/workspace 画册');
    await harness.handler('/persona Nova');
    await harness.handler('/pin');
    await harness.handler('/rename 新名字');
    await harness.handler('/export json');

    expect(harness.setConversationActiveProject).toHaveBeenCalledWith('conversation-1', 'project-1');
    expect(harness.setActiveCollaborator).toHaveBeenCalledWith('nova');
    expect(harness.setFrontstageCollaboratorId).toHaveBeenCalledWith('nova');
    expect(harness.toggleConversationPinned).toHaveBeenCalledWith('conversation-1');
    expect(harness.renameConversation).toHaveBeenCalledWith('conversation-1', '新名字');
    expect(harness.createCard).toHaveBeenCalledWith(expect.objectContaining({
      title: '按钮 导出',
      language: 'json',
      code: expect.stringContaining('"conversationId": "conversation-1"')
    }));
  });

  it('switches provider and active model from slash commands', async () => {
    const harness = createHarness();

    await harness.handler('/provider moonshot');
    await harness.handler('/model claude-sonnet-4-5');

    expect(harness.setActiveProvider).toHaveBeenCalledWith('provider-moonshot');
    expect(harness.updateProvider).toHaveBeenCalledWith('provider-openrouter', {
      model: 'claude-sonnet-4-5'
    });
    expect(harness.setInputDraft).toHaveBeenCalledWith('');
  });

  it('routes save and task commands to their product actions', async () => {
    const harness = createHarness();

    await harness.handler('/save card');
    await harness.handler('/save note');
    await harness.handler('/task 整理这个按钮组件');

    expect(harness.saveMessageCodeCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'assistant-1' }));
    expect(harness.createCard).toHaveBeenCalledWith(expect.objectContaining({
      title: '上一条回复笔记',
      code: expect.stringContaining('<button>ok</button>')
    }));
    expect(harness.setTaskModeEnabled).toHaveBeenCalledWith(true);
    expect(harness.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-1'
    }), expect.objectContaining({
      role: 'user',
      content: '整理这个按钮组件'
    }));
    expect(harness.setConversationTask).toHaveBeenCalledWith('conversation-1', expect.objectContaining({
      goal: '整理这个按钮组件'
    }));
  });

});
