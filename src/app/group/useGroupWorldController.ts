import { useCallback, useMemo, useState } from 'react';
import type {
  Conversation,
  Persona
} from '../../types/domain';
import { createChatReplyRunner } from '../chat/chatReplyFlow';
import {
  createChatReplyStoreBindings,
  createChatToolStoreBindings,
  useChatStoreBindings
} from '../chat/useChatStoreBindings';
import { createChatToolActions } from '../chat/chatToolActions';
import { useI18n } from '../../i18n';
import type { ChatUiState } from '../../ui/worlds/chat/context/ChatUiState';
import { useChatStore } from '../../stores/chatStore';
import { messageGeneratedImageAttachments } from './groupActivity';
import {
  buildGroupFamilies,
  groupConversations,
  groupLineageId,
  groupTitleFromMembers
} from './groupConversationModel';
import {
  buildGroupDerived,
  buildGroupMemberSystemMessage,
  buildGroupToolPreferences,
  buildGroupTurnAnchorMessage,
  buildLaneDigestMessage,
  GROUP_LANE_TOOL_SETTINGS,
  groupMemoryRecallEnabled,
  labelRequestMessagesForMember
} from './groupRequestModel';
import {
  groupGenerationKey,
  type GroupArtifactItem,
  type GroupBackgroundId,
  type GroupCardItem,
  type GroupImageItem,
  type GroupOwnedItem,
  type GroupWorldTab,
  type GroupWorldView
} from './groupTypes';
import { useGroupLaneController } from './useGroupLaneController';
import { useGroupReplyController } from './useGroupReplyController';

export { GROUP_BACKGROUND_IDS, groupGenerationKey, laneGenerationKey } from './groupTypes';
export type { GroupArtifactItem, GroupBackgroundId, GroupCardItem, GroupImageItem, GroupMemberLiveState, GroupWorldTab, GroupWorldView } from './groupTypes';
export { groupLineageId } from './groupConversationModel';
export type { GroupLaneEntry, GroupLaneItem } from './groupLaneModel';

type UseGroupWorldControllerArgs = {
  ui: ChatUiState;
};

export function useGroupWorldController({ ui }: UseGroupWorldControllerArgs) {
  const store = useChatStoreBindings();
  const { t } = useI18n();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GroupWorldTab>('dialogue');
  const [laneMemberId, setLaneMemberId] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [conversationSheetOpen, setConversationSheetOpen] = useState(false);

  const ready = store.chat.hydrated && store.persona.hydrated && store.runtime.hydrated && store.collection.hydrated;
  const groups = useMemo(() => groupConversations(store.chat.conversations), [store.chat.conversations]);
  const families = useMemo(() => buildGroupFamilies(groups), [groups]);
  const activeGroup = useMemo(
    () => (openGroupId ? groups.find((conversation) => conversation.id === openGroupId) ?? null : null),
    [groups, openGroupId]
  );
  const view: GroupWorldView = activeGroup ? 'room' : 'home';

  // 当前群（场所）名下的所有子对话，最近的在前
  const familyConversations = useMemo(() => {
    if (!activeGroup) return [];
    const lineage = groupLineageId(activeGroup);
    return families.find((family) => family.lineageId === lineage)?.conversations ?? [activeGroup];
  }, [activeGroup, families]);

  const lineageConversationIds = useMemo(
    () => new Set(familyConversations.map((conversation) => conversation.id)),
    [familyConversations]
  );

  const memberPersonas = useMemo(() => {
    if (!activeGroup?.group) return [];
    const byId = new Map(store.persona.personas.map((persona) => [persona.id, persona]));
    return activeGroup.group.memberIds
      .map((memberId) => byId.get(memberId) ?? null)
      .filter((member): member is Persona => Boolean(member));
  }, [activeGroup, store.persona.personas]);

  const replyStore = createChatReplyStoreBindings(store, { includeGroupConversations: true });
  const toolStore = createChatToolStoreBindings(store, { includeGroupConversations: true });
  const baseDerived = buildGroupDerived(activeGroup, memberPersonas[0] ?? null);
  const baseToolActions = useMemo(() => createChatToolActions({
    ui: {
      setCommandStatus: ui.setCommandStatus
    },
    store: toolStore,
    derived: baseDerived
  }), [baseDerived, toolStore, ui.setCommandStatus]);
  const laneController = useGroupLaneController({
    activeGroup,
    memberPersonas,
    ui,
    store,
    replyStore,
    baseToolActions
  });

  const groupToolSettings = activeGroup?.group?.toolSettings ?? GROUP_LANE_TOOL_SETTINGS;
  const groupRecallEnabled = groupMemoryRecallEnabled(activeGroup);

  const runGroupReply = useMemo(() => createChatReplyRunner({
    ui: {
      themeToolModeSwitchRef: ui.themeToolModeSwitchRef,
      getConversationGenerationControls: ui.getConversationGenerationControls,
      toolPromptPreferences: buildGroupToolPreferences(store.runtime.toolPromptPreferences, groupToolSettings, {
        memoryRecallEnabled: groupRecallEnabled
      }),
      taskModeEnabled: false
    },
    store: replyStore,
    derived: baseDerived,
    toolActions: baseToolActions,
    includeGroupConversations: true,
    createToolActions: (scopedDerived) => createChatToolActions({
      ui: {
        setCommandStatus: ui.setCommandStatus
      },
      store: toolStore,
      derived: scopedDerived
    }),
    disableTaskState: true,
    resolveGenerationKey: ({ conversationId, collaboratorId }) =>
      groupGenerationKey(conversationId, collaboratorId),
    resolveSemanticRecallEnabled: ({ conversationId, defaultEnabled }) => {
      const latestGroup = useChatStore.getState().conversations.find((conversation) => conversation.id === conversationId);
      return defaultEnabled && groupMemoryRecallEnabled(latestGroup);
    },
    buildRequestMessages: ({ messages, activeCollaborator }) => {
      if (!activeGroup || !activeCollaborator) return messages;
      const laneDigest = buildLaneDigestMessage({
        conversation: activeGroup,
        member: activeCollaborator
      });
      return [
        buildGroupMemberSystemMessage({
          conversation: activeGroup,
          member: activeCollaborator,
          members: memberPersonas
        }),
        ...(laneDigest ? [laneDigest] : []),
        ...labelRequestMessagesForMember({
          messages,
          member: activeCollaborator,
          members: memberPersonas
        }),
        // 近因锚：紧贴生成点再钉一次身份，压住人格 compiledPrompt 的"回到私聊"滑坡
        buildGroupTurnAnchorMessage({
          conversation: activeGroup,
          member: activeCollaborator
        })
      ];
    },
    overrideRequestSource: ({ conversationId, source }) => {
      const memoryRecallEnabled = source.semanticRecallEnabled !== false
        && groupMemoryRecallEnabled(source.conversations.find((conversation) => conversation.id === conversationId) ?? activeGroup);
      return {
        ...source,
        activeWorld: 'group',
        collectionShelf: 'dialogue',
        enabledToolGroups: buildGroupToolPreferences(source.enabledToolGroups, groupToolSettings, {
          memoryRecallEnabled
        }),
        semanticRecallEnabled: memoryRecallEnabled,
        semanticRecallConversations: memoryRecallEnabled ? source.semanticRecallConversations : [],
        themeToolMode: 'off',
        // MCP 由全局服务器/工具设置细控；群聊只决定这类能力是否进入房间。
        mcpServers: groupToolSettings.mcp === true ? source.mcpServers : [],
        activeCardId: null,
        activeProjectId: null,
        currentTask: null,
        pendingWorkspaceProposal: null,
        selectedSurfaceCodes: [],
        collectionCards: groupToolSettings.cards
          ? source.collectionCards.filter((card) =>
              card.originConversationId && lineageConversationIds.has(card.originConversationId))
          : [],
        imageCards: groupToolSettings.images
          ? source.imageCards.filter((card) =>
              card.originConversationId && lineageConversationIds.has(card.originConversationId))
          : [],
        projectFiles: [],
        workspaceReferenceDocs: [],
        roomProjects: [],
        currentCollaboratorId: source.currentCollaboratorId
      };
    }
  }), [
    activeGroup,
    baseDerived,
    baseToolActions,
    groupRecallEnabled,
    groupToolSettings,
    lineageConversationIds,
    memberPersonas,
    replyStore,
    store.runtime.toolPromptPreferences,
    toolStore,
    ui.getConversationGenerationControls,
    ui.setCommandStatus,
    ui.themeToolModeSwitchRef
  ]);
  const replyController = useGroupReplyController({
    activeGroup,
    memberPersonas,
    ui,
    store,
    runGroupReply,
    noMembersMessage: t('group.composer.noMembers')
  });

  const enterGroup = useCallback((conversationId: string) => {
    // 不动全局 activeConversationId：那是单聊世界的状态，群有自己的 openGroupId
    void store.chat.ensureConversationMessagesLoaded?.(conversationId);
    setOpenGroupId(conversationId);
    setActiveTab('dialogue');
    setLaneMemberId(null);
  }, [store.chat]);

  const exitToHome = useCallback(() => {
    setOpenGroupId(null);
    setLaneMemberId(null);
  }, []);

  // 同一个群（同成员、同设置、同产物池）开一场全新上下文的对话
  const createSubConversation = useCallback(() => {
    if (!activeGroup?.group) return null;
    const settings = activeGroup.group;
    const conversationId = store.chat.createGroupConversation({
      title: settings.title,
      memberIds: settings.memberIds,
      lineageId: groupLineageId(activeGroup)
    });
    store.chat.updateGroupConversation(conversationId, {
      background: settings.background,
      backgroundAssetId: settings.backgroundAssetId ?? null,
      backgroundVeil: settings.backgroundVeil,
      replyMode: settings.replyMode,
      allowMemberSilence: settings.allowMemberSilence,
      toolSettings: { ...settings.toolSettings }
    });
    setConversationSheetOpen(false);
    enterGroup(conversationId);
    return conversationId;
  }, [activeGroup, enterGroup, store.chat]);

  const switchConversation = useCallback((conversationId: string) => {
    setConversationSheetOpen(false);
    enterGroup(conversationId);
  }, [enterGroup]);

  // 修剪上下文：报错消息、认知跑偏的发言，可以单独改掉或拿走
  const editMemberMessage = useCallback(async (messageId: string, content: string) => {
    if (!activeGroup) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const writableConversation = await store.chat.ensureConversationWritable(activeGroup.id);
    if (!writableConversation) return;
    store.chat.updateMessage(writableConversation, messageId, { content: trimmed });
  }, [activeGroup, store.chat]);

  const deleteMemberMessage = useCallback(async (messageId: string) => {
    if (!activeGroup) return;
    const writableConversation = await store.chat.ensureConversationWritable(activeGroup.id);
    if (!writableConversation) return;
    store.chat.replaceConversationMessages(
      writableConversation,
      writableConversation.messages.filter((message) => message.id !== messageId)
    );
  }, [activeGroup, store.chat]);

  const createGroup = useCallback((options: { title?: string; memberIds: string[] }) => {
    const members = store.persona.personas.filter((persona) => options.memberIds.includes(persona.id));
    if (members.length === 0) return null;
    const title = options.title?.trim() || groupTitleFromMembers(members);
    const conversationId = store.chat.createGroupConversation({
      title,
      memberIds: members.map((member) => member.id)
    });
    setCreateSheetOpen(false);
    enterGroup(conversationId);
    return conversationId;
  }, [enterGroup, store.chat, store.persona.personas]);

  const updateDraft = useCallback((value: string) => {
    if (!activeGroup) return;
    store.chat.setConversationDraft(activeGroup.id, value);
  }, [activeGroup, store.chat]);

  const toggleMember = useCallback((memberId: string) => {
    if (!activeGroup?.group) return;
    const memberSet = new Set(activeGroup.group.memberIds);
    if (memberSet.has(memberId)) {
      memberSet.delete(memberId);
    } else {
      memberSet.add(memberId);
    }
    store.chat.updateGroupConversation(activeGroup.id, {
      memberIds: Array.from(memberSet)
    });
  }, [activeGroup, store.chat]);

  const renameGroup = useCallback((title: string) => {
    if (!activeGroup?.group) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    store.chat.updateGroupConversation(activeGroup.id, { title: trimmed });
  }, [activeGroup, store.chat]);

  const setReplyMode = useCallback((replyMode: NonNullable<Conversation['group']>['replyMode']) => {
    if (!activeGroup?.group) return;
    replyController.resetReplySession(activeGroup.id);
    store.chat.updateGroupConversation(activeGroup.id, { replyMode });
  }, [activeGroup, replyController, store.chat]);

  const setAllowMemberSilence = useCallback((allowMemberSilence: boolean) => {
    if (!activeGroup?.group) return;
    store.chat.updateGroupConversation(activeGroup.id, { allowMemberSilence });
  }, [activeGroup, store.chat]);

  const setMemoryRecallEnabled = useCallback((memoryRecallEnabled: boolean) => {
    if (!activeGroup?.group) return;
    store.chat.updateGroupConversation(activeGroup.id, { memoryRecallEnabled });
  }, [activeGroup, store.chat]);

  const setToolSetting = useCallback((tool: 'cards' | 'images' | 'attachments' | 'web' | 'mcp', enabled: boolean) => {
    if (!activeGroup?.group) return;
    store.chat.updateGroupConversation(activeGroup.id, {
      toolSettings: { ...activeGroup.group.toolSettings, [tool]: enabled }
    });
  }, [activeGroup, store.chat]);

  const setBackground = useCallback((background: GroupBackgroundId) => {
    if (!activeGroup?.group) return;
    store.chat.updateGroupConversation(activeGroup.id, { background });
  }, [activeGroup, store.chat]);

  const setBackgroundImage = useCallback((backgroundAssetId: string | null) => {
    if (!activeGroup?.group) return;
    store.chat.updateGroupConversation(activeGroup.id, { backgroundAssetId });
  }, [activeGroup, store.chat]);

  const setBackgroundVeil = useCallback((backgroundVeil: number) => {
    if (!activeGroup?.group) return;
    store.chat.updateGroupConversation(activeGroup.id, {
      backgroundVeil: Math.min(1, Math.max(0.05, backgroundVeil))
    });
  }, [activeGroup, store.chat]);

  const deleteGroupCard = useCallback((cardId: string) => {
    store.collection.deleteCard(cardId);
  }, [store.collection]);

  // 同一张图可能同时活在消息附件和图片卡两处：两边一起收走才算删干净
  const deleteGroupImage = useCallback((item: GroupImageItem) => {
    for (const imageCard of store.collection.imageCards) {
      if (imageCard.assetId !== item.assetId) continue;
      if (!imageCard.originConversationId || !lineageConversationIds.has(imageCard.originConversationId)) continue;
      store.collection.deleteImageCard(imageCard.id);
    }
    store.chat.clearConversationAttachmentsByAssetIds([item.assetId]);
  }, [lineageConversationIds, store.chat, store.collection]);

  const deleteGroup = useCallback((conversationId: string) => {
    store.chat.deleteConversation(conversationId);
    if (openGroupId === conversationId) {
      exitToHome();
    }
  }, [exitToHome, openGroupId, store.chat]);

  const openPrivateChat = useCallback((memberId: string) => {
    const existing = store.chat.conversations.find((conversation) => (
      conversation.kind !== 'group' && conversation.collaboratorId === memberId
    ));
    const conversationId = existing?.id ?? store.chat.createConversation(memberId);
    store.space.setFrontstageCollaboratorId(memberId);
    store.chat.setActiveConversation(conversationId);
    store.space.setWorld('chat');
  }, [store.chat, store.space]);

  const exitWorld = useCallback(() => {
    // 抽屉（CollaboratorScopeStrip）住在收藏世界；从群里出门回到走廊，不是被传送进谁的房间
    store.space.setWorld('collection');
  }, [store.space]);

  const personaNameById = useMemo(
    () => new Map(store.persona.personas.map((persona) => [persona.id, persona.name])),
    [store.persona.personas]
  );

  const resolveItemOwner = useCallback((item: GroupOwnedItem) => {
    if (item.ownerCollaboratorId) {
      return {
        ownerId: item.ownerCollaboratorId,
        ownerName: personaNameById.get(item.ownerCollaboratorId) ?? null
      };
    }
    if (item.originMessageId) {
      // 血缘内任意一场子对话里都可能是出生地
      for (const conversation of familyConversations) {
        const originMessage = conversation.messages.find((message) => message.id === item.originMessageId);
        if (!originMessage) continue;
        const speakerId = originMessage.speakerCollaboratorId ?? null;
        if (speakerId) {
          return { ownerId: speakerId, ownerName: personaNameById.get(speakerId) ?? originMessage.assistantName ?? null };
        }
        break;
      }
    }
    return { ownerId: null, ownerName: null };
  }, [familyConversations, personaNameById]);

  const groupCards: GroupCardItem[] = useMemo(() => {
    if (!activeGroup) return [];
    return store.collection.cards
      .filter((card) => card.originConversationId && lineageConversationIds.has(card.originConversationId))
      .map((card) => ({ card, ...resolveItemOwner(card) }))
      .sort((a, b) => b.card.updatedAt - a.card.updatedAt);
  }, [activeGroup, lineageConversationIds, resolveItemOwner, store.collection.cards]);

  // 附件架：卡片 + 大家发的/做出来的文件，混着按时间收
  const groupArtifacts: GroupArtifactItem[] = useMemo(() => {
    if (!activeGroup) return [];
    const items: GroupArtifactItem[] = groupCards.map((entry) => ({
      type: 'card' as const,
      ...entry,
      timestamp: entry.card.updatedAt
    }));
    for (const conversation of familyConversations) {
      for (const message of conversation.messages) {
        const fromUser = message.role === 'user';
        if (!fromUser) {
          if (message.origin !== 'tool-runtime') continue;
          const invocation = message.toolInvocation;
          if (!invocation || invocation.status === 'failed' || invocation.status === 'running') continue;
        }
        for (const attachment of message.attachments ?? []) {
          if (attachment.kind !== 'file' || !attachment.assetId || attachment.clearedAt) continue;
          const ownerId = fromUser ? null : message.speakerCollaboratorId ?? null;
          items.push({
            type: 'file',
            id: `file-${attachment.id}`,
            assetId: attachment.assetId,
            name: attachment.name,
            ownerId,
            ownerName: ownerId ? personaNameById.get(ownerId) ?? null : null,
            fromUser,
            timestamp: message.timestamp
          });
        }
      }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [activeGroup, familyConversations, groupCards, personaNameById]);

  const deleteGroupFile = useCallback((assetId: string) => {
    store.chat.clearConversationAttachmentsByAssetIds([assetId]);
  }, [store.chat]);

  const groupImages: GroupImageItem[] = useMemo(() => {
    if (!activeGroup) return [];
    const items: GroupImageItem[] = [];
    const seenAssetIds = new Set<string>();
    for (const conversation of familyConversations) {
      for (const message of conversation.messages) {
        if (message.role === 'user') {
          for (const attachment of message.attachments ?? []) {
            if (attachment.kind !== 'image' || !attachment.assetId || attachment.clearedAt) continue;
            seenAssetIds.add(attachment.assetId);
            items.push({
              id: `attachment-${attachment.id}`,
              assetId: attachment.assetId,
              ownerId: null,
              ownerName: null,
              fromUser: true,
              timestamp: message.timestamp
            });
          }
          continue;
        }
        // 成员在私域里生成的图片成果，自动落进群的图片区
        for (const attachment of messageGeneratedImageAttachments(message)) {
          if (seenAssetIds.has(attachment.assetId)) continue;
          seenAssetIds.add(attachment.assetId);
          const ownerId = message.speakerCollaboratorId ?? null;
          items.push({
            id: `attachment-${attachment.id}`,
            assetId: attachment.assetId,
            ownerId,
            ownerName: ownerId ? personaNameById.get(ownerId) ?? null : null,
            fromUser: false,
            timestamp: message.timestamp
          });
        }
      }
    }
    for (const imageCard of store.collection.imageCards) {
      if (!imageCard.originConversationId || !lineageConversationIds.has(imageCard.originConversationId)) continue;
      if (seenAssetIds.has(imageCard.assetId)) continue;
      seenAssetIds.add(imageCard.assetId);
      const owner = resolveItemOwner(imageCard);
      items.push({
        id: `image-card-${imageCard.id}`,
        assetId: imageCard.assetId,
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        fromUser: false,
        timestamp: imageCard.createdAt
      });
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [activeGroup, familyConversations, lineageConversationIds, personaNameById, resolveItemOwner, store.collection.imageCards]);

  return {
    ready,
    view,
    groups,
    families,
    familyConversations,
    activeGroup,
    activeTab,
    setActiveTab,
    createSheetOpen,
    setCreateSheetOpen,
    conversationSheetOpen,
    setConversationSheetOpen,
    createSubConversation,
    switchConversation,
    editMemberMessage,
    deleteMemberMessage,
    laneMemberId,
    setLaneMemberId,
    personas: store.persona.personas,
    memberPersonas,
    memberLiveStates: replyController.memberLiveStates,
    sending: replyController.sending,
    enterGroup,
    exitToHome,
    exitWorld,
    createGroup,
    updateDraft,
    submit: replyController.submit,
    retryMember: replyController.retryMember,
    stopAll: replyController.stopAll,
    toggleMember,
    renameGroup,
    setReplyMode,
    setAllowMemberSilence,
    setMemoryRecallEnabled,
    setToolSetting,
    mcpServers: store.runtime.mcpServers,
    setBackground,
    setBackgroundImage,
    setBackgroundVeil,
    deleteGroup,
    openPrivateChat,
    groupArtifacts,
    groupImages,
    deleteGroupCard,
    deleteGroupFile,
    deleteGroupImage,
    laneForMember: laneController.laneForMember,
    laneTimelineFor: laneController.laneTimelineFor,
    laneReplyingMemberIds: laneController.laneReplyingMemberIds,
    laneFailedMemberIds: laneController.laneFailedMemberIds,
    whisper: laneController.whisper,
    retryWhisper: laneController.retryWhisper,
    commandStatus: ui.commandStatus,
    setCommandStatus: ui.setCommandStatus
  };
}
