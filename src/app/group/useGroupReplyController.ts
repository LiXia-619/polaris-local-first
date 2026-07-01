import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createMessage } from '../../engines/chatMessageFactory';
import { useChatStore } from '../../stores/chatStore';
import type { ChatAttachment, Conversation, Persona } from '../../types/domain';
import type { ChatUiState } from '../../ui/worlds/chat/context/ChatUiState';
import { createChatReplyRunner } from '../chat/chatReplyFlow';
import type { useChatStoreBindings } from '../chat/useChatStoreBindings';
import { memberRunningActivityKey } from './groupActivity';
import { extractMentions } from './groupMentions';
import { GROUP_SILENCE_SENTINEL } from './groupRequestModel';
import {
  insertRelayTargets,
  orderGroupRoundRespondents,
  planGroupRandomRespondents
} from './groupTurnTaking';
import {
  groupGenerationKey,
  type GroupMemberLiveState
} from './groupTypes';

type GroupStoreBindings = ReturnType<typeof useChatStoreBindings>;
type GroupReplyRunner = ReturnType<typeof createChatReplyRunner>;

type GroupRoundSession = {
  queue: Persona[];
  spokenIds: Set<string>;
  currentMemberId: string | null;
  running: boolean;
  stopped: boolean;
  token: number;
};

type UseGroupReplyControllerArgs = {
  activeGroup: Conversation | null;
  memberPersonas: Persona[];
  ui: ChatUiState;
  store: GroupStoreBindings;
  runGroupReply: GroupReplyRunner;
  noMembersMessage: string;
};

export function useGroupReplyController({
  activeGroup,
  memberPersonas,
  ui,
  store,
  runGroupReply,
  noMembersMessage
}: UseGroupReplyControllerArgs) {
  const [replyingKeys, setReplyingKeys] = useState<string[]>([]);
  const [failedKeys, setFailedKeys] = useState<string[]>([]);
  const [runningConversationIds, setRunningConversationIds] = useState<string[]>([]);
  const activeMemberKeysRef = useRef<Set<string>>(new Set());
  const roundSessionsRef = useRef<Record<string, GroupRoundSession>>({});
  const randomTimerIdsRef = useRef<Record<string, number[]>>({});
  const replyRunTokenRef = useRef<Record<string, number>>({});

  useEffect(() => () => {
    Object.values(randomTimerIdsRef.current)
      .flat()
      .forEach((timerId) => window.clearTimeout(timerId));
    randomTimerIdsRef.current = {};
    roundSessionsRef.current = {};
    activeMemberKeysRef.current.clear();
    replyRunTokenRef.current = {};
  }, []);

  const memberLiveStates: GroupMemberLiveState[] = useMemo(() => {
    if (!activeGroup) return [];
    return memberPersonas.map((member) => {
      const generation = ui.generationByConversationId[groupGenerationKey(activeGroup.id, member.id)] ?? null;
      return {
        member,
        typing: Boolean(generation?.sending || generation?.streaming),
        streamingMessageId: generation?.streaming?.messageId ?? null,
        failed: failedKeys.includes(groupGenerationKey(activeGroup.id, member.id)),
        activityKey: memberRunningActivityKey(activeGroup, member.id)
      };
    });
  }, [activeGroup, failedKeys, memberPersonas, ui.generationByConversationId]);

  const sending = useMemo(
    () => Boolean(activeGroup && (
      runningConversationIds.includes(activeGroup.id)
      || replyingKeys.some((key) => key.startsWith(`${activeGroup.id}::`))
    )),
    [activeGroup, replyingKeys, runningConversationIds]
  );

  const setConversationRunning = useCallback((conversationId: string, running: boolean) => {
    setRunningConversationIds((current) => {
      if (running) return current.includes(conversationId) ? current : [...current, conversationId];
      return current.filter((entry) => entry !== conversationId);
    });
  }, []);

  const bumpReplyRunToken = useCallback((conversationId: string) => {
    const next = (replyRunTokenRef.current[conversationId] ?? 0) + 1;
    replyRunTokenRef.current[conversationId] = next;
    return next;
  }, []);

  const currentReplyRunToken = useCallback((conversationId: string) => {
    return replyRunTokenRef.current[conversationId] ?? 0;
  }, []);

  const hasActiveMember = useCallback((conversationId: string) => {
    return Array.from(activeMemberKeysRef.current).some((key) => key.startsWith(`${conversationId}::`));
  }, []);

  const finishConversationIfIdle = useCallback((conversationId: string, token: number) => {
    if (currentReplyRunToken(conversationId) !== token) return;
    if ((randomTimerIdsRef.current[conversationId] ?? []).length > 0) return;
    if (hasActiveMember(conversationId)) return;
    setConversationRunning(conversationId, false);
  }, [currentReplyRunToken, hasActiveMember, setConversationRunning]);

  const clearRandomTimers = useCallback((conversationId: string) => {
    for (const timerId of randomTimerIdsRef.current[conversationId] ?? []) {
      window.clearTimeout(timerId);
    }
    delete randomTimerIdsRef.current[conversationId];
  }, []);

  const resetReplySession = useCallback((conversationId: string) => {
    bumpReplyRunToken(conversationId);
    const session = roundSessionsRef.current[conversationId];
    if (session) {
      session.stopped = true;
      session.queue = [];
    }
    clearRandomTimers(conversationId);
    delete roundSessionsRef.current[conversationId];
    setConversationRunning(conversationId, false);
  }, [bumpReplyRunToken, clearRandomTimers, setConversationRunning]);

  const collectSilence = useCallback(async (conversationId: string, memberId: string) => {
    const writableConversation = await store.chat.ensureConversationWritable(conversationId);
    if (!writableConversation) return;
    const silent = writableConversation.messages.filter((message) =>
      message.role === 'assistant'
      && message.speakerCollaboratorId === memberId
      && message.content.trim() === GROUP_SILENCE_SENTINEL
    );
    if (silent.length === 0) return;
    const silentIds = new Set(silent.map((message) => message.id));
    store.chat.replaceConversationMessages(
      writableConversation,
      writableConversation.messages.filter((message) => !silentIds.has(message.id))
    );
  }, [store.chat]);

  const runMember = useCallback(async (group: Conversation, member: Persona, token: number) => {
    const key = groupGenerationKey(group.id, member.id);
    if (activeMemberKeysRef.current.has(key)) return { status: 'aborted' as const };
    activeMemberKeysRef.current.add(key);
    setReplyingKeys((current) => (current.includes(key) ? current : [...current, key]));
    setFailedKeys((current) => current.filter((entry) => entry !== key));
    try {
      const latest = useChatStore.getState().conversations.find((conversation) => conversation.id === group.id);
      const result = await runGroupReply({
        conversationId: group.id,
        collaboratorId: member.id,
        messages: latest?.messages ?? group.messages
      });
      if (currentReplyRunToken(group.id) !== token) {
        return { status: 'aborted' as const };
      }
      if (result.status === 'failed') {
        setFailedKeys((current) => (current.includes(key) ? current : [...current, key]));
      } else if (result.status === 'completed' && group.group?.allowMemberSilence) {
        void collectSilence(group.id, member.id);
      }
      return result;
    } catch {
      if (currentReplyRunToken(group.id) === token) {
        setFailedKeys((current) => (current.includes(key) ? current : [...current, key]));
      }
      return { status: 'failed' as const };
    } finally {
      activeMemberKeysRef.current.delete(key);
      setReplyingKeys((current) => current.filter((entry) => entry !== key));
    }
  }, [collectSilence, currentReplyRunToken, runGroupReply]);

  const findLatestMemberReply = useCallback((conversationId: string, memberId: string, sinceTimestamp: number) => {
    const latest = useChatStore.getState().conversations.find((conversation) => conversation.id === conversationId);
    return [...(latest?.messages ?? [])]
      .reverse()
      .find((message) =>
        message.role === 'assistant'
        && message.speakerCollaboratorId === memberId
        && message.timestamp >= sinceTimestamp
        && message.content.trim());
  }, []);

  const runRoundSession = useCallback(async (conversationId: string): Promise<void> => {
    const session = roundSessionsRef.current[conversationId];
    if (!session || session.running) return;
    session.running = true;
    setConversationRunning(conversationId, true);

    while (!session.stopped && currentReplyRunToken(conversationId) === session.token && session.queue.length > 0) {
      const group = useChatStore.getState().conversations.find((conversation) => conversation.id === conversationId);
      if (!group) break;
      const member = session.queue.shift();
      if (!member) continue;
      session.currentMemberId = member.id;
      session.spokenIds.add(member.id);
      const sinceTimestamp = Date.now();
      const result = await runMember(group, member, session.token);
      session.currentMemberId = null;
      if (session.stopped || currentReplyRunToken(conversationId) !== session.token || result.status !== 'completed') continue;
      const reply = findLatestMemberReply(group.id, member.id, sinceTimestamp);
      if (!reply) continue;
      const targets = extractMentions(reply.content, memberPersonas, member.id);
      insertRelayTargets(session.queue, targets);
    }

    if (roundSessionsRef.current[conversationId] === session) {
      delete roundSessionsRef.current[conversationId];
    }
    if (currentReplyRunToken(conversationId) === session.token) {
      setConversationRunning(conversationId, false);
    }
  }, [currentReplyRunToken, findLatestMemberReply, memberPersonas, runMember, setConversationRunning]);

  const startOrRefreshRoundSession = useCallback((
    group: Conversation,
    nextQueue: Persona[],
    forceMentionedIds: Set<string>
  ) => {
    const current = roundSessionsRef.current[group.id];
    if (current) {
      current.queue = nextQueue.filter((member) =>
        member.id !== current.currentMemberId
        && (forceMentionedIds.has(member.id) || !current.spokenIds.has(member.id))
      );
      if (!current.running) void runRoundSession(group.id);
      return;
    }
    const token = bumpReplyRunToken(group.id);
    roundSessionsRef.current[group.id] = {
      queue: nextQueue,
      spokenIds: new Set(),
      currentMemberId: null,
      running: false,
      stopped: false,
      token
    };
    void runRoundSession(group.id);
  }, [bumpReplyRunToken, runRoundSession]);

  const scheduleRandomTurns = useCallback((group: Conversation, plan: ReturnType<typeof planGroupRandomRespondents<Persona>>) => {
    clearRandomTimers(group.id);
    const token = bumpReplyRunToken(group.id);
    setConversationRunning(group.id, true);
    randomTimerIdsRef.current[group.id] = [];
    const appendPlan = (
      sourceGroup: Conversation,
      nextPlan: ReturnType<typeof planGroupRandomRespondents<Persona>>
    ) => {
      const timerIds = nextPlan.map(({ member, delayMs }) => {
        let timerId = 0;
        timerId = window.setTimeout(async () => {
          randomTimerIdsRef.current[sourceGroup.id] = (randomTimerIdsRef.current[sourceGroup.id] ?? [])
            .filter((entry) => entry !== timerId);
          if (currentReplyRunToken(sourceGroup.id) !== token) return;
          const latest = useChatStore.getState().conversations.find((conversation) => conversation.id === sourceGroup.id);
          const currentGroup = latest ?? sourceGroup;
          const sinceTimestamp = Date.now();
          const result = await runMember(currentGroup, member, token);
          if (currentReplyRunToken(sourceGroup.id) !== token || result.status !== 'completed') {
            finishConversationIfIdle(sourceGroup.id, token);
            return;
          }
          const reply = findLatestMemberReply(sourceGroup.id, member.id, sinceTimestamp);
          if (!reply) {
            finishConversationIfIdle(sourceGroup.id, token);
            return;
          }
          const targets = extractMentions(reply.content, memberPersonas, member.id);
          if (targets.length === 0) {
            finishConversationIfIdle(sourceGroup.id, token);
            return;
          }
          appendPlan(
            useChatStore.getState().conversations.find((conversation) => conversation.id === sourceGroup.id) ?? sourceGroup,
            planGroupRandomRespondents(targets, targets)
          );
          finishConversationIfIdle(sourceGroup.id, token);
        }, delayMs);
        return timerId;
      });
      randomTimerIdsRef.current[sourceGroup.id] = [
        ...(randomTimerIdsRef.current[sourceGroup.id] ?? []),
        ...timerIds
      ];
    };
    appendPlan(group, plan);
    finishConversationIfIdle(group.id, token);
  }, [
    bumpReplyRunToken,
    clearRandomTimers,
    currentReplyRunToken,
    findLatestMemberReply,
    finishConversationIfIdle,
    memberPersonas,
    runMember,
    setConversationRunning
  ]);

  const submit = useCallback(async (attachments?: ChatAttachment[]) => {
    if (!activeGroup?.group) return;
    const content = (activeGroup.draft ?? '').trim();
    if (!content && (attachments?.length ?? 0) === 0) return;
    if (memberPersonas.length === 0) {
      ui.setCommandStatus(noMembersMessage, true);
      return;
    }

    const writableConversation = await store.chat.ensureConversationWritable(activeGroup.id);
    if (!writableConversation) {
      ui.setCommandStatus('读取当前群聊历史失败，先别发送。', true);
      return;
    }
    const userMessage = createMessage('user', content, attachments?.length ? attachments : undefined, 'user-input');
    store.chat.addMessage(writableConversation, userMessage);
    store.chat.setConversationDraft(activeGroup.id, '');
    ui.triggerSubmitFlight();

    const latestGroup = useChatStore.getState().conversations.find((conversation) => conversation.id === activeGroup.id);
    const messages = latestGroup?.messages ?? [...activeGroup.messages, userMessage];
    const mentioned = extractMentions(content, memberPersonas);

    if (activeGroup.group.replyMode === 'random') {
      scheduleRandomTurns(activeGroup, planGroupRandomRespondents(memberPersonas, mentioned));
      return;
    }

    startOrRefreshRoundSession(
      activeGroup,
      orderGroupRoundRespondents(memberPersonas, messages, mentioned),
      new Set(mentioned.map((member) => member.id))
    );
  }, [activeGroup, memberPersonas, noMembersMessage, scheduleRandomTurns, startOrRefreshRoundSession, store.chat, ui]);

  const retryMember = useCallback(async (memberId: string) => {
    if (!activeGroup) return;
    const member = memberPersonas.find((persona) => persona.id === memberId);
    if (!member) return;
    const token = bumpReplyRunToken(activeGroup.id);
    setConversationRunning(activeGroup.id, true);
    await runMember(activeGroup, member, token);
    finishConversationIfIdle(activeGroup.id, token);
  }, [activeGroup, bumpReplyRunToken, finishConversationIfIdle, memberPersonas, runMember, setConversationRunning]);

  const stopAll = useCallback(() => {
    if (!activeGroup) return;
    resetReplySession(activeGroup.id);
    for (const member of memberPersonas) {
      const controls = ui.getConversationGenerationControls(groupGenerationKey(activeGroup.id, member.id));
      controls.abortControllerRef.current?.abort();
    }
  }, [activeGroup, memberPersonas, resetReplySession, ui]);

  return {
    memberLiveStates,
    sending,
    submit,
    retryMember,
    stopAll,
    resetReplySession
  };
}
