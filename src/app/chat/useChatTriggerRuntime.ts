import { useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getDueTriggerRules } from '../../engines/triggers';
import type { ChatMessage, PolarisTriggerRule } from '../../types/domain';
import type { ChatStoreBindings } from './useChatStoreBindings';
import { createTriggerMessage } from './triggerMessage';
import { resolveTriggerConversationForTarget } from './triggerConversationResolution';
import { buildProactiveReplyNotification } from './proactiveReplyNotification';
import { postNativeProactiveReplyNotification } from '../../native/localTriggerNotifications';
import { selectChatConversations } from './liveConversationCatalog';

type TriggerGenerationState = {
  sending: boolean;
};

type UseChatTriggerRuntimeArgs = {
  startupReady: boolean;
  generationByConversationId: Record<string, TriggerGenerationState | undefined>;
  store: ChatStoreBindings;
  runReply: (params: {
    conversationId: string;
    collaboratorId: string;
    messages: ChatMessage[];
  }) => Promise<{ status: 'completed' | 'aborted' | 'failed' }>;
  setCommandStatus: (text: string, isError?: boolean) => void;
};

function resolveTriggerConversation(args: {
  rule: PolarisTriggerRule;
  store: ChatStoreBindings;
}) {
  const chatState = args.store.chat.readLatestState();
  const liveConversations = selectChatConversations(chatState.conversations);
  return resolveTriggerConversationForTarget(args.rule.target, {
    conversations: liveConversations,
    activeConversationId: chatState.activeConversationId
  }, {
    createConversation: (collaboratorId) => args.store.chat.createConversation(collaboratorId),
    getConversations: () => {
      const latest = args.store.chat.readLatestState();
      return selectChatConversations(latest.conversations);
    }
  });
}

export function useChatTriggerRuntime({
  startupReady,
  generationByConversationId,
  store,
  runReply,
  setCommandStatus
}: UseChatTriggerRuntimeArgs) {
  const runningRuleIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const generationByConversationIdRef = useRef(generationByConversationId);
  const [wakeTick, setWakeTick] = useState(0);

  useEffect(() => {
    generationByConversationIdRef.current = generationByConversationId;
  }, [generationByConversationId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!startupReady || typeof window === 'undefined') return;

    const wake = () => setWakeTick((current) => current + 1);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') wake();
    };

    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let cancelled = false;
    let removeResumeListener: (() => void) | null = null;

    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
      void CapacitorApp.addListener('resume', wake).then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }
        removeResumeListener = () => {
          void listener.remove();
        };
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeResumeListener?.();
    };
  }, [startupReady]);

  useEffect(() => {
    if (!startupReady) return;
    const nextRunAt = store.runtime.triggerRules
      .filter((rule) => rule.enabled && rule.nextRunAt !== null)
      .map((rule) => rule.nextRunAt!)
      .sort((left, right) => left - right)[0];
    if (!nextRunAt) return;

    const delay = Math.max(0, nextRunAt - Date.now());
    const timer = window.setTimeout(
      () => setWakeTick((current) => current + 1),
      Math.min(delay, 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [startupReady, store.runtime.triggerRules]);

  useEffect(() => {
    if (!startupReady || runningRuleIdRef.current) return;

    const runtimeState = store.runtime.readLatestState();
    const [rule] = getDueTriggerRules(runtimeState.triggerRules);
    if (!rule) return;

    runningRuleIdRef.current = rule.id;

    void (async () => {
      try {
        const persona = store.persona.readLatestState().personas.find((entry) => entry.id === rule.target.collaboratorId) ?? null;
        if (!persona) {
          store.runtime.markTriggerFailed(rule.id, `目标人格不存在：${rule.target.collaboratorId}`);
          return;
        }

        const conversation = resolveTriggerConversation({ rule, store });
        if (!conversation) {
          store.runtime.markTriggerFailed(rule.id, '无法创建触发器对话');
          return;
        }
        if (generationByConversationIdRef.current[conversation.id]?.sending) {
          return;
        }

        const writableConversation = await store.chat.ensureConversationWritable(conversation.id);
        if (!writableConversation) {
          store.runtime.markTriggerFailed(rule.id, '触发器对话历史还没准备好');
          return;
        }
        const triggerEvent = store.runtime.consumeTriggerEvent(rule.id);
        const triggerMessage = createTriggerMessage(rule, triggerEvent);
        const nextMessages = [...writableConversation.messages, triggerMessage];
        const messageCountBeforeReply = nextMessages.length;
        store.chat.addMessage(writableConversation, triggerMessage);
        store.runtime.markTriggerFired(rule.id);
        setCommandStatus(`触发器已投递：${rule.name}`);

        const result = await runReply({
          conversationId: writableConversation.conversationId,
          collaboratorId: rule.target.collaboratorId,
          messages: nextMessages
        });

        if (result.status !== 'aborted' && mountedRef.current) {
          const latestChatState = store.chat.readLatestState();
          const latestSpaceState = store.space.readLatestState();
          const latestConversation = latestChatState.conversations.find((entry) => entry.id === writableConversation.conversationId) ?? null;
          const notification = buildProactiveReplyNotification({
            conversation: latestConversation,
            collaboratorId: rule.target.collaboratorId,
            collaboratorName: persona.name,
            messageCountBeforeReply,
            currentView: {
              activeWorld: latestSpaceState.activeWorld,
              activeConversationId: latestChatState.activeConversationId
            }
          });
          if (notification) {
            store.space.enqueueReplyNotification(notification);
            void postNativeProactiveReplyNotification(notification);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '触发器执行失败';
        store.runtime.markTriggerFailed(rule.id, message);
        setCommandStatus(`触发器失败：${message}`, true);
      } finally {
        if (runningRuleIdRef.current === rule.id) {
          runningRuleIdRef.current = null;
        }
      }
    })();
  }, [runReply, setCommandStatus, startupReady, store, wakeTick]);
}
