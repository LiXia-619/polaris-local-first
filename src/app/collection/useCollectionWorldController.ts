import { useEffect, useMemo, useState } from 'react';
import { filterCodeCardsForCollaboratorScope, resolveOwnerCollaboratorId } from '../../engines/collectionOwnership';
import { createCompanionPersonaProjection, isCompanionCollaboratorId } from '../../engines/companion';
import { enterChatWorld, enterGroupWorld } from '../shell/frontstageNavigation';
import {
  copyAutomationTriggerUrl,
  createAutomationRuleForCollaborator,
  deleteAutomationRuleWithConfirmation,
  updateAutomationRuleForCollaborator
} from '../shell/automationRuleActions';
import { useThemeSessionActions } from '../theme/useThemeSessionActions';
import { buildCollaboratorInfoOverview } from './buildCollaboratorInfoOverview';
import {
  conversationMatchesCollaboratorScope,
  resolveConversationCollaboratorId,
  resolveConversationCollaboratorName
} from '../../engines/conversationOwnership';
import { createStoredAttachment } from '../../infrastructure/assetStore';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useI18n } from '../../i18n';
import { usePersonaStore } from '../../stores/personaStore';
import { selectRuntimeApi, selectVisibleProviders, useRuntimeStore } from '../../stores/runtimeStore';
import { useSpaceFrontstageBindings } from '../../stores/spaceStoreFrontstageBindings';
import { useSpaceStore } from '../../stores/spaceStore';
import type { McpServerConfig, PolarisTriggerRule, PolarisTriggerSchedule } from '../../types/domain';
import { hasArchivedConversationContent } from './conversationArchiveVisibility';
import { enterCollaboratorCollectionScope } from '../shell/frontstageNavigation';

type CollectionWorldUiPorts = {
  confirm: (message: string) => boolean;
  alert: (message: string) => void;
};

export function useCollectionWorldController(ui: CollectionWorldUiPorts) {
  const copy = useI18n();
  const frontstage = useSpaceFrontstageBindings();

  const conversations = useChatStore((state) => state.conversations);
  const loadedMessageConversationIds = useChatStore((state) => state.loadedMessageConversationIds);
  const chatHydrated = useChatStore((state) => state.hydrated);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const toggleConversationPinned = useChatStore((state) => state.toggleConversationPinned);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const collectionHydrated = useCollectionStore((state) => state.hydrated);
  const cards = useCollectionStore((state) => state.cards);
  const imageCards = useCollectionStore((state) => state.imageCards);
  const roomProjects = useCollectionStore((state) => state.roomProjects);

  const personas = usePersonaStore((state) => state.personas);
  const personaHydrated = usePersonaStore((state) => state.hydrated);
  const createPersona = usePersonaStore((state) => state.createPersona);
  const setActiveCollaborator = usePersonaStore((state) => state.setActiveCollaborator);
  const updateCollaborator = usePersonaStore((state) => state.updateCollaborator);
  const toggleCollaboratorPinned = usePersonaStore((state) => state.toggleCollaboratorPinned);
  const companionConnections = useRuntimeStore((state) => state.companionConnections);
  const companionSnapshots = useRuntimeStore((state) => state.companionSnapshots);
  const companionHost = useRuntimeStore((state) => state.companionHost);
  const triggerRules = useRuntimeStore((state) => state.triggerRules);
  const createTriggerRule = useRuntimeStore((state) => state.createTriggerRule);
  const updateTriggerRule = useRuntimeStore((state) => state.updateTriggerRule);
  const deleteTriggerRule = useRuntimeStore((state) => state.deleteTriggerRule);
  const mcpServers = useRuntimeStore((state) => state.mcpServers);
  const mcpToolTimeoutSeconds = useRuntimeStore((state) => state.mcpToolTimeoutSeconds);
  const createMcpServer = useRuntimeStore((state) => state.createMcpServer);
  const updateMcpServer = useRuntimeStore((state) => state.updateMcpServer);
  const deleteMcpServer = useRuntimeStore((state) => state.deleteMcpServer);
  const providers = useRuntimeStore(selectVisibleProviders);
  const activeProviderId = useRuntimeStore((state) => selectRuntimeApi(state).id);
  const showChatAvatars = useSpaceStore((state) => state.customization.showChatAvatars);
  const themeSession = useThemeSessionActions();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [codeWorkshopOpen, setCodeWorkshopOpen] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();
  const loadedConversationIdSet = useMemo(
    () => new Set(loadedMessageConversationIds),
    [loadedMessageConversationIds]
  );
  const ready = chatHydrated && collectionHydrated && personaHydrated;
  const collaboratorScopeId = frontstage.frontstageCollaboratorId;
  const collectionShelf = frontstage.collectionShelf;
  const setCollectionShelf = frontstage.setCollectionShelf;
  const collaborators = useMemo(
    () => [
      ...personas,
      ...companionConnections.map((connection) =>
        createCompanionPersonaProjection(connection, companionSnapshots[connection.id] ?? null)
      )
    ],
    [companionConnections, companionSnapshots, personas]
  );
  const hasPersistedCollaborator = (collaboratorId: string) =>
    personas.some((persona) => persona.id === collaboratorId);
  const shouldForceInfoShelf = ready && collaboratorScopeId === null && collaborators.length === 0;
  const currentCollaborator = useMemo(
    () => collaboratorScopeId ? collaborators.find((persona) => persona.id === collaboratorScopeId) ?? null : null,
    [collaboratorScopeId, collaborators]
  );

  useEffect(() => {
    if (!shouldForceInfoShelf || collectionShelf === 'info') return;
    setCollectionShelf('info');
  }, [collectionShelf, setCollectionShelf, shouldForceInfoShelf]);

  const collaboratorIds = useMemo(() => collaborators.map((collaborator) => collaborator.id), [collaborators]);
  const collaboratorOverviewItems = useMemo(
    () => buildCollaboratorInfoOverview({
      personas: collaborators,
      conversations,
      loadedMessageConversationIds: loadedConversationIdSet,
      cards,
      imageCards
    }),
    [collaborators, conversations, loadedConversationIdSet, cards, imageCards]
  );
  const collaboratorConversationCounts = useMemo(() => {
    const byCollaboratorId: Record<string, number> = {};
    let total = 0;

    conversations.forEach((conversation) => {
      if (!hasArchivedConversationContent(conversation, { loadedMessageConversationIds: loadedConversationIdSet })) return;
      total += 1;
      const collaboratorId = resolveConversationCollaboratorId(conversation);
      if (!collaboratorId) return;
      byCollaboratorId[collaboratorId] = (byCollaboratorId[collaboratorId] ?? 0) + 1;
    });

    return { byCollaboratorId, total };
  }, [conversations, loadedConversationIdSet]);
  const hasScopedImageCards = useMemo(
    () =>
      imageCards.some((card) => {
        if (!collaboratorScopeId) return true;
        return resolveOwnerCollaboratorId(card, conversations) === collaboratorScopeId;
      }),
    [collaboratorScopeId, conversations, imageCards]
  );
  const scopedCodeCards = useMemo(
    () => filterCodeCardsForCollaboratorScope(cards, conversations, collaboratorScopeId),
    [cards, collaboratorScopeId, conversations]
  );
  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        if (!hasArchivedConversationContent(conversation, { loadedMessageConversationIds: loadedConversationIdSet })) {
          return false;
        }
        if (!conversationMatchesCollaboratorScope(conversation, collaboratorScopeId, collaboratorIds)) return false;
        if (!normalizedSearch) return true;

        const collaboratorName = resolveConversationCollaboratorName(conversation, collaborators);
        const searchBody = [
          conversation.title,
          collaboratorName,
          ...conversation.messages.map((message) => message.content)
        ]
          .join('\n')
          .toLowerCase();
        return searchBody.includes(normalizedSearch);
      }),
    [collaboratorIds, collaboratorScopeId, collaborators, conversations, loadedConversationIdSet, normalizedSearch]
  );
  const codeSearchTagSuggestions = useMemo(() => {
    if (frontstage.collectionShelf !== 'code') return [];
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return [];

    return Array.from(new Set(
      scopedCodeCards
        .filter((card) => card.kind !== 'room-rule')
        .flatMap((card) => card.tags.map((tag) => tag.trim()).filter(Boolean))
    ))
      .filter((tag) => tag.toLowerCase().includes(needle) && tag.toLowerCase() !== needle)
      .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
      .slice(0, 8);
  }, [frontstage.collectionShelf, scopedCodeCards, searchTerm]);

  const testAutomationRule = (ruleId: string) => {
    updateTriggerRule(ruleId, {
      enabled: true,
      nextRunAt: Date.now()
    });
    useSpaceStore.getState().setWorld('chat');
  };

  return {
    collectionShelf: frontstage.collectionShelf,
    setCollectionShelf: frontstage.setCollectionShelf,
    searchTerm,
    setSearchTerm,
    ready,
    personas: collaborators,
    providers,
    activeProviderId,
    collaboratorConversationCounts,
    hasScopedImageCards,
    activeConversationId,
    conversations,
    filteredConversations,
    roomProjects,
    codeSearchTagSuggestions,
    editingConversationId,
    conversationTitleDraft,
    codeWorkshopOpen,
    setCodeWorkshopOpen,
    onConversationTitleDraftChange: setConversationTitleDraft,
    onStartConversationRename: (conversationId: string, title: string) => {
      setEditingConversationId(conversationId);
      setConversationTitleDraft(title);
    },
    onCommitConversationRename: (conversationId: string) => {
      const nextTitle = conversationTitleDraft.trim();
      if (!nextTitle) return;
      renameConversation(conversationId, nextTitle);
      setEditingConversationId(null);
      setConversationTitleDraft('');
    },
    onCancelConversationRename: () => {
      setEditingConversationId(null);
      setConversationTitleDraft('');
    },
    onConversationPinToggle: (conversationId: string) => toggleConversationPinned(conversationId),
    onConversationDelete: (conversationId: string, title: string) => {
      if (!ui.confirm(`要删除“${title}”吗？`)) return;
      themeSession.rollbackPreviewForConversationDeletion(conversationId);
      deleteConversation(conversationId);
      if (activeConversationId === conversationId) {
        frontstage.clearPendingAttachments();
        frontstage.clearPendingCardReference();
      }
      if (editingConversationId === conversationId) {
        setEditingConversationId(null);
        setConversationTitleDraft('');
      }
    },
    onOpenConversation: (conversationId: string) => {
      if (conversationId !== activeConversationId) {
        frontstage.clearPendingAttachments();
        frontstage.clearPendingCardReference();
      }
      setActiveConversation(conversationId);
      enterChatWorld(frontstage);
    },
    onOpenGroupWorld: () => {
      enterGroupWorld(frontstage);
    },
    onCreateConversation: () => {
      const conversationId = createConversation(collaboratorScopeId ?? undefined, {
        activeProjectId: frontstage.collectionProjectId
      });
      frontstage.clearPendingAttachments();
      frontstage.clearPendingCardReference();
      setActiveConversation(conversationId);
      enterChatWorld(frontstage);
    },
    isAggregateScope: collaboratorScopeId === null,
    collaboratorScopeId,
    currentCollaboratorId: collaboratorScopeId,
    currentCollaborator,
    showChatAvatars,
    triggerRules,
    mcpServers,
    mcpToolTimeoutSeconds,
    collaboratorOverviewItems,
    onCreateAutomationRule: (seed: {
      collaboratorId: string;
      conversationMode?: PolarisTriggerRule['target']['conversationMode'];
      conversationId?: string | null;
      schedule: PolarisTriggerSchedule;
      prompt: string;
      name?: string;
    }) => createAutomationRuleForCollaborator({
      seed,
      personas: collaborators,
      createTriggerRule,
      ui,
      copy
    }),
    onUpdateAutomationRule: (ruleId: string, patch: Partial<PolarisTriggerRule>) => updateAutomationRuleForCollaborator({
      ruleId,
      patch,
      triggerRules,
      personas: collaborators,
      updateTriggerRule,
      ui,
      copy
    }),
    onDeleteAutomationRule: (ruleId: string) => deleteAutomationRuleWithConfirmation({
      ruleId,
      triggerRules,
      deleteTriggerRule,
      ui,
      copy
    }),
    onTestAutomationRule: testAutomationRule,
    onCopyAutomationTriggerUrl: (ruleId: string) => {
      void copyAutomationTriggerUrl({
        ruleId,
        triggerRules,
        companionHost,
        ui,
        copy
      });
    },
    onCreateMcpServer: (seed?: Partial<McpServerConfig>) => createMcpServer(seed),
    onUpdateMcpServer: updateMcpServer,
    onDeleteMcpServer: deleteMcpServer,
    onCollaboratorPinToggle: (collaboratorId: string) => {
      if (!hasPersistedCollaborator(collaboratorId)) return;
      toggleCollaboratorPinned(collaboratorId);
    },
    onSelectCollaboratorScope: (collaboratorId: string | null) => {
      if (collaboratorId && !isCompanionCollaboratorId(collaboratorId) && !hasPersistedCollaborator(collaboratorId)) return;
      enterCollaboratorCollectionScope({
        activeWorld: frontstage.activeWorld,
        setFrontstageCollaboratorId: frontstage.setFrontstageCollaboratorId,
        setCollectionShelf: frontstage.setCollectionShelf,
        setWorld: frontstage.setWorld
      }, collaboratorId);
      if (collaboratorId && !isCompanionCollaboratorId(collaboratorId)) {
        setActiveCollaborator(collaboratorId);
        frontstage.setEditingCollaboratorId(collaboratorId);
      }
    },
    onUpdateCurrentCollaborator: (patch: Parameters<typeof updateCollaborator>[1]) => {
      const targetPersonaId = collaboratorScopeId;
      if (!targetPersonaId) return;
      if (!hasPersistedCollaborator(targetPersonaId)) return;
      updateCollaborator(targetPersonaId, patch);
    },
    onSelectCurrentCollaboratorAvatar: async (role: 'assistant' | 'user', files: FileList | File[]) => {
      const targetPersonaId = collaboratorScopeId;
      const [file] = Array.from(files);
      if (!targetPersonaId || !file) return;
      if (!hasPersistedCollaborator(targetPersonaId)) return;
      if (!file.type.startsWith('image/')) {
        ui.alert('这里只收图片，先从相册里挑一张。');
        return;
      }

      try {
        const attachment = await createStoredAttachment({
          kind: 'image',
          name: file.name,
          mimeType: file.type || 'image/*',
          blob: file
        });
        updateCollaborator(targetPersonaId, role === 'assistant'
          ? { assistantAvatarAssetId: attachment.assetId, assistantAvatarIconId: null }
          : { userAvatarAssetId: attachment.assetId, userAvatarIconId: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : '保存头像失败';
        ui.alert(message);
      }
    },
    onCreateCustomCollaborator: () => {
      const nextId = createPersona({ activate: false, template: 'custom' });
      setActiveCollaborator(nextId);
      frontstage.setEditingCollaboratorId(nextId);
      frontstage.setFrontstageCollaboratorId(nextId);
      frontstage.setCollectionShelf('info');
    }
  };
}
