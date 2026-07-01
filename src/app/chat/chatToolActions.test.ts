import { describe, expect, it, vi } from 'vitest';
import { createChatToolActions } from './chatToolActions';

function createToolActionsHarness() {
  const setCommandStatus = vi.fn();
  const openProviderSettings = vi.fn();
  const setTaskModeEnabled = vi.fn();
  const setThemeToolMode = vi.fn();
  const setConversationActiveProject = vi.fn();
  const setWorld = vi.fn();
  const setCollectionShelf = vi.fn();

  const actions = createChatToolActions({
    ui: {
      setCommandStatus,
      openProviderSettings
    },
    store: {
      chat: {
        conversations: [],
        pendingWorkspaceProposals: [],
        addMessage: vi.fn(),
        insertMessageBefore: vi.fn(),
        insertMessageAfter: vi.fn(),
        createConversation: vi.fn(() => 'conversation-created'),
        findConversation: vi.fn(),
        getConversationMessages: vi.fn(() => []),
        getConversationTask: vi.fn(() => null),
        setConversationTask: vi.fn(),
        updateMessage: vi.fn(),
        setConversationActiveProject,
        upsertPendingWorkspaceProposal: vi.fn(),
        removePendingWorkspaceProposal: vi.fn(),
        appendRuntimeFeedbackEvent: vi.fn(),
        getRuntimeFeedbackEvents: vi.fn(() => [])
      },
      persona: {
        activeCollaboratorId: 'pharos',
        personas: [{ id: 'pharos' }],
        findCollaborator: vi.fn(),
        updateCollaborator: vi.fn()
      },
      collection: {
        cards: [],
        projectFiles: [],
        roomProjects: [],
        readLatestState: vi.fn(() => ({ cards: [], imageCards: [], projectFiles: [], roomProjects: [] })),
        createCard: vi.fn(),
        createProjectFile: vi.fn(),
        createProject: vi.fn(),
        promoteCardToProject: vi.fn(),
        saveCardFromChat: vi.fn(),
        saveImageCardFromChat: vi.fn(),
        updateCard: vi.fn(),
        updateProjectFile: vi.fn()
      },
      runtime: {
        mcpServers: [],
        mcpToolTimeoutSeconds: 30,
        setTaskModeEnabled
      },
      space: {
        activeThemePreview: null,
        activeWorld: 'chat',
        activeCardId: null,
        applyThemePatch: vi.fn(),
        applyThemePreset: vi.fn(),
        beginThemePreview: vi.fn(),
        collectionShelf: 'code',
        commitThemePreview: vi.fn(),
        currentThemeFrame: {
          activePresetId: 'base',
          activeSavedSkinId: null,
          cssVariables: {},
          presetCSS: '',
          customCSS: '',
          generatedCSS: '',
          recipe: null
        },
        frontstageCollaboratorId: 'pharos',
        getActiveThemePreview: vi.fn(() => null),
        getCurrentThemeFrame: vi.fn(),
        rollbackThemePreview: vi.fn(),
        saveCurrentSkin: vi.fn(() => null),
        setActiveCard: vi.fn(),
        setCollectionShelf,
        setThemeToolMode,
        setWorld,
        spotlightCard: vi.fn(),
        themeToolMode: 'stable'
      }
    } as never,
    derived: {
      activeConversation: {
        id: 'conversation-1',
        title: '现在',
        collaboratorId: 'pharos',
        activeProjectId: 'project-1',
        messages: []
      },
      activeCollaboratorSourceId: 'pharos',
      codeCardActionModeByMessageId: {}
    }
  });

  return {
    actions,
    openProviderSettings,
    setCollectionShelf,
    setCommandStatus,
    setConversationActiveProject,
    setTaskModeEnabled,
    setThemeToolMode,
    setWorld
  };
}

describe('createChatToolActions command shortcuts', () => {
  it('keeps the direct workspace command available for fallback callers', async () => {
    const harness = createToolActionsHarness();

    await harness.actions.submitToolCommand('/workspace exit');

    expect(harness.setConversationActiveProject).toHaveBeenCalledWith('conversation-1', null);
  });

  it('opens provider settings from model commands without changing provider state', async () => {
    const harness = createToolActionsHarness();

    await harness.actions.submitToolCommand('/model');

    expect(harness.openProviderSettings).toHaveBeenCalledTimes(1);
    expect(harness.setCommandStatus).toHaveBeenCalledWith('已打开模型和供应商设置');
  });

  it('consumes unknown commands with an actionable status', async () => {
    const harness = createToolActionsHarness();

    const consumed = await harness.actions.submitToolCommand('/不存在');

    expect(consumed).toBe(true);
    expect(harness.setCommandStatus).toHaveBeenCalledWith(expect.stringContaining('输入 /'), true);
  });
});
