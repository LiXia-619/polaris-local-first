import { useCallback, useMemo, useRef, useState } from 'react';
import { createMessage } from '../../engines/chatMessageFactory';
import { createUid } from '../../engines/id';
import { useChatStore } from '../../stores/chatStore';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ChatMessage, Conversation, GroupConversationPrivateEntry, Persona } from '../../types/domain';
import type { ChatUiState } from '../../ui/worlds/chat/context/ChatUiState';
import { createChatReplyRunner } from '../chat/chatReplyFlow';
import { createChatToolActions } from '../chat/chatToolActions';
import type { ChatReplyStoreBindings } from '../chat/chatPorts';
import type { useChatStoreBindings } from '../chat/useChatStoreBindings';
import { buildGroupLaneEntries, buildGroupLaneTimeline } from './groupLaneModel';
import {
  buildGroupDerived,
  buildGroupToolPreferences,
  buildWhisperSystemMessage,
  GROUP_LANE_TOOL_SETTINGS,
  groupMemoryRecallEnabled,
  labelRequestMessagesForMember,
  laneWhisperEntries
} from './groupRequestModel';
import { laneGenerationKey } from './groupTypes';

type GroupStoreBindings = ReturnType<typeof useChatStoreBindings>;
type GroupToolActions = ReturnType<typeof createChatToolActions>;

type UseGroupLaneControllerArgs = {
  activeGroup: Conversation | null;
  memberPersonas: Persona[];
  ui: ChatUiState;
  store: GroupStoreBindings;
  replyStore: ChatReplyStoreBindings;
  baseToolActions: GroupToolActions;
};

export function useGroupLaneController({
  activeGroup,
  memberPersonas,
  ui,
  store,
  replyStore,
  baseToolActions
}: UseGroupLaneControllerArgs) {
  const [laneReplyingKeys, setLaneReplyingKeys] = useState<string[]>([]);
  const [laneFailedKeys, setLaneFailedKeys] = useState<string[]>([]);
  const laneBufferRef = useRef<Record<string, ChatMessage[]>>({});
  const lastWhisperRef = useRef<Record<string, string>>({});

  const laneReplyingMemberIds = useMemo(
    () => (activeGroup
      ? memberPersonas
          .filter((member) => laneReplyingKeys.includes(laneGenerationKey(activeGroup.id, member.id)))
          .map((member) => member.id)
      : []),
    [activeGroup, laneReplyingKeys, memberPersonas]
  );

  const laneFailedMemberIds = useMemo(
    () => (activeGroup
      ? memberPersonas
          .filter((member) => laneFailedKeys.includes(laneGenerationKey(activeGroup.id, member.id)))
          .map((member) => member.id)
      : []),
    [activeGroup, laneFailedKeys, memberPersonas]
  );

  const laneForMember = useCallback((memberId: string) => {
    return buildGroupLaneEntries(activeGroup, memberId);
  }, [activeGroup]);

  const laneTimelineFor = useCallback((memberId: string) => {
    return buildGroupLaneTimeline(activeGroup, memberId);
  }, [activeGroup]);

  const appendLaneEntries = useCallback((conversationId: string, memberId: string, entries: GroupConversationPrivateEntry[]) => {
    const latest = useChatStore.getState().conversations.find((conversation) => conversation.id === conversationId);
    if (!latest?.group) return;
    const lanes = latest.group.privateLanes ?? {};
    store.chat.updateGroupConversation(conversationId, {
      privateLanes: {
        ...lanes,
        [memberId]: [...(lanes[memberId] ?? []), ...entries]
      }
    });
  }, [store.chat]);

  const createLaneChatPort = useCallback((bufferKey: string) => (chat: ChatReplyStoreBindings['chat']) => ({
    ...chat,
    addMessage: (_target: WritableConversationBody, message: ChatMessage) => {
      laneBufferRef.current[bufferKey] = [...(laneBufferRef.current[bufferKey] ?? []), message];
    },
    updateMessage: (_target: WritableConversationBody, messageId: string, patch: Partial<ChatMessage>) => {
      laneBufferRef.current[bufferKey] = (laneBufferRef.current[bufferKey] ?? []).map((message) =>
        message.id === messageId ? { ...message, ...patch } : message
      );
    },
    insertMessageBefore: (_target: WritableConversationBody, beforeMessageId: string, message: ChatMessage) => {
      const buffer = laneBufferRef.current[bufferKey] ?? [];
      const index = buffer.findIndex((entry) => entry.id === beforeMessageId);
      laneBufferRef.current[bufferKey] = index === -1
        ? [...buffer, message]
        : [...buffer.slice(0, index), message, ...buffer.slice(index)];
    },
    findConversationMessage: (conversationId: string, messageId: string) =>
      (laneBufferRef.current[bufferKey] ?? []).find((message) => message.id === messageId)
        ?? chat.findConversationMessage(conversationId, messageId),
    replaceConversationMessages: () => {},
    appendRuntimeFeedbackEvent: () => {},
    getConversationTask: () => null,
    setConversationTask: () => {}
  }), []);

  const whisper = useCallback(async (memberId: string, content: string) => {
    const group = activeGroup;
    if (!group?.group) return;
    const member = memberPersonas.find((persona) => persona.id === memberId);
    if (!member) return;
    const trimmed = content.trim();
    const laneKey = laneGenerationKey(group.id, memberId);
    if (!trimmed || laneReplyingKeys.includes(laneKey)) return;
    const memoryRecallEnabled = groupMemoryRecallEnabled(group);

    lastWhisperRef.current[laneKey] = trimmed;
    const priorLane = laneWhisperEntries(group, memberId);
    appendLaneEntries(group.id, memberId, [{
      id: createUid('lane'),
      kind: 'user-note',
      author: 'user',
      content: trimmed,
      createdAt: Date.now()
    }]);
    setLaneFailedKeys((current) => current.filter((entry) => entry !== laneKey));
    setLaneReplyingKeys((current) => (current.includes(laneKey) ? current : [...current, laneKey]));
    laneBufferRef.current[laneKey] = [];

    const runWhisperReply = createChatReplyRunner({
      ui: {
        themeToolModeSwitchRef: ui.themeToolModeSwitchRef,
        getConversationGenerationControls: ui.getConversationGenerationControls,
        toolPromptPreferences: buildGroupToolPreferences(store.runtime.toolPromptPreferences, GROUP_LANE_TOOL_SETTINGS, {
          memoryRecallEnabled
        }),
        taskModeEnabled: false
      },
      store: replyStore,
      derived: buildGroupDerived(group, member),
      toolActions: baseToolActions,
      includeGroupConversations: true,
      disableTaskState: true,
      resolveGenerationKey: () => laneKey,
      resolveSemanticRecallEnabled: ({ defaultEnabled }) => defaultEnabled && memoryRecallEnabled,
      overrideReplyChatPort: createLaneChatPort(laneKey),
      buildRequestMessages: ({ messages, activeCollaborator }) => {
        if (!activeCollaborator) return messages;
        const laneHistory: ChatMessage[] = priorLane.map((entry) => (
          entry.author === 'user'
            ? createMessage('user', entry.content, undefined, 'user-input', `lane-${entry.id}`)
            : {
                ...createMessage('assistant', entry.content, undefined, 'assistant-reply', `lane-${entry.id}`),
                speakerCollaboratorId: member.id,
                assistantName: member.name
              }
        ));
        return [
          buildWhisperSystemMessage({
            conversation: group,
            member: activeCollaborator,
            members: memberPersonas
          }),
          ...labelRequestMessagesForMember({
            messages,
            member: activeCollaborator,
            members: memberPersonas
          }),
          ...laneHistory,
          createMessage('user', trimmed, undefined, 'user-input', `lane-current-${createUid('lw')}`)
        ];
      },
      overrideRequestSource: ({ source }) => ({
        ...source,
        activeWorld: 'group',
        collectionShelf: 'dialogue',
        enabledToolGroups: buildGroupToolPreferences(source.enabledToolGroups, GROUP_LANE_TOOL_SETTINGS, {
          memoryRecallEnabled: source.semanticRecallEnabled !== false && memoryRecallEnabled
        }),
        semanticRecallEnabled: source.semanticRecallEnabled !== false && memoryRecallEnabled,
        semanticRecallConversations: source.semanticRecallEnabled !== false && memoryRecallEnabled
          ? source.semanticRecallConversations
          : [],
        themeToolMode: 'off',
        activeCardId: null,
        activeProjectId: null,
        currentTask: null,
        pendingWorkspaceProposal: null,
        selectedSurfaceCodes: [],
        collectionCards: [],
        imageCards: [],
        projectFiles: [],
        workspaceReferenceDocs: [],
        roomProjects: [],
        currentCollaboratorId: source.currentCollaboratorId
      })
    });

    try {
      const result = await runWhisperReply({
        conversationId: group.id,
        collaboratorId: memberId,
        messages: group.messages
      });
      if (result.status === 'completed') {
        const assistantText = (laneBufferRef.current[laneKey] ?? [])
          .filter((message) => message.role === 'assistant')
          .map((message) => message.content)
          .join('\n\n')
          .trim();
        if (assistantText) {
          appendLaneEntries(group.id, memberId, [{
            id: createUid('lane'),
            kind: 'assistant-note',
            author: 'collaborator',
            content: assistantText,
            createdAt: Date.now()
          }]);
        }
      } else if (result.status === 'failed') {
        setLaneFailedKeys((current) => (current.includes(laneKey) ? current : [...current, laneKey]));
      }
    } catch {
      setLaneFailedKeys((current) => (current.includes(laneKey) ? current : [...current, laneKey]));
    } finally {
      setLaneReplyingKeys((current) => current.filter((entry) => entry !== laneKey));
      delete laneBufferRef.current[laneKey];
    }
  }, [
    activeGroup,
    appendLaneEntries,
    baseToolActions,
    createLaneChatPort,
    laneReplyingKeys,
    memberPersonas,
    replyStore,
    store.runtime.toolPromptPreferences,
    ui
  ]);

  const retryWhisper = useCallback(async (memberId: string) => {
    if (!activeGroup?.group) return;
    const laneKey = laneGenerationKey(activeGroup.id, memberId);
    const lastContent = lastWhisperRef.current[laneKey];
    if (!lastContent) return;
    const group = activeGroup;
    const member = memberPersonas.find((persona) => persona.id === memberId);
    if (!member) return;
    setLaneFailedKeys((current) => current.filter((entry) => entry !== laneKey));
    const lanes = laneWhisperEntries(group, memberId);
    const lastEntry = lanes[lanes.length - 1];
    if (lastEntry?.author === 'user') {
      const latest = useChatStore.getState().conversations.find((conversation) => conversation.id === group.id);
      if (latest?.group?.privateLanes) {
        store.chat.updateGroupConversation(group.id, {
          privateLanes: {
            ...latest.group.privateLanes,
            [memberId]: (latest.group.privateLanes[memberId] ?? []).filter((entry) => entry.id !== lastEntry.id)
          }
        });
      }
    }
    await whisper(memberId, lastContent);
  }, [activeGroup, memberPersonas, store.chat, whisper]);

  return {
    laneForMember,
    laneTimelineFor,
    laneReplyingMemberIds,
    laneFailedMemberIds,
    whisper,
    retryWhisper
  };
}
