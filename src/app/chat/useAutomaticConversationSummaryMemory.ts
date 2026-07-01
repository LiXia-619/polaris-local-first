import { useEffect, useMemo } from 'react';
import { reportPersistenceError } from '../../infrastructure/persistenceDiagnostics';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useRuntimeStore } from '../../stores/runtimeStore';
import { MEMORY_RELEASE_GATES } from '../../config/memoryReleaseGates';
import type { Conversation, ConversationSummaryModelSettings, Persona } from '../../types/domain';
import { updateConversationSummaryMemoryForCollaborator } from './conversationSummaryMemoryActions';

const AUTO_CONVERSATION_SUMMARY_DELAY_MS = 5000;

type AutomaticConversationSummaryState = {
  settings: ConversationSummaryModelSettings;
  releaseEnabled?: boolean;
  startupReady: boolean;
  chatHydrated: boolean;
  personaHydrated: boolean;
  runtimeHydrated: boolean;
  collectionHydrated: boolean;
  dirtyConversationCount: number;
  deletedConversationCount: number;
  loadingConversationCount: number;
  personas: Persona[];
  conversations: Conversation[];
};

function getEligibleSummaryCollaboratorIds(personas: Persona[], conversations: Conversation[]) {
  const personaIds = new Set(
    personas
      .filter((persona) => persona.memory.crossConversationRecallEnabled !== false)
      .map((persona) => persona.id)
  );

  return Array.from(new Set(
    conversations
      .map((conversation) => conversation.collaboratorId)
      .filter((collaboratorId): collaboratorId is string => Boolean(collaboratorId && personaIds.has(collaboratorId)))
  ));
}

function getLatestConversationSummarySourceUpdatedAt(conversations: Conversation[], collaboratorIds: string[]) {
  const eligibleIds = new Set(collaboratorIds);
  return conversations.reduce((latest, conversation) => {
    if (!conversation.collaboratorId || !eligibleIds.has(conversation.collaboratorId)) return latest;
    return Math.max(latest, conversation.updatedAt);
  }, 0);
}

export function resolveAutomaticConversationSummaryPlan(state: AutomaticConversationSummaryState) {
  const collaboratorIds = getEligibleSummaryCollaboratorIds(state.personas, state.conversations);
  const latestSourceUpdatedAt = getLatestConversationSummarySourceUpdatedAt(state.conversations, collaboratorIds);
  const lastUpdatedAt = state.settings.lastUpdatedAt ?? 0;
  const releaseEnabled = state.releaseEnabled ?? MEMORY_RELEASE_GATES.enableAutomaticConversationSummary;
  const ready = (
    state.startupReady
    && state.chatHydrated
    && state.personaHydrated
    && state.runtimeHydrated
    && state.collectionHydrated
    && state.dirtyConversationCount === 0
    && state.deletedConversationCount === 0
    && state.loadingConversationCount === 0
  );

  return {
    ready,
    enabled: releaseEnabled && state.settings.enabled === true && state.settings.autoUpdateEnabled === true,
    collaboratorIds,
    latestSourceUpdatedAt,
    lastUpdatedAt,
    shouldRun: ready
      && releaseEnabled
      && state.settings.enabled === true
      && state.settings.autoUpdateEnabled === true
      && collaboratorIds.length > 0
      && latestSourceUpdatedAt > lastUpdatedAt
  };
}

async function runAutomaticConversationSummaryMemory(startupReady: boolean) {
  const runtime = useRuntimeStore.getState();
  const persona = usePersonaStore.getState();
  const chat = useChatStore.getState();
  const collection = useCollectionStore.getState();
  const plan = resolveAutomaticConversationSummaryPlan({
    settings: runtime.conversationSummaryModel,
    startupReady,
    chatHydrated: chat.hydrated,
    personaHydrated: persona.hydrated,
    runtimeHydrated: runtime.hydrated,
    collectionHydrated: collection.hydrated,
    dirtyConversationCount: chat.dirtyConversationIds.length,
    deletedConversationCount: chat.deletedConversationIds.length,
    loadingConversationCount: chat.loadingMessageConversationIds.length,
    personas: persona.personas,
    conversations: chat.conversations
  });

  if (!plan.shouldRun) return;

  for (const collaboratorId of plan.collaboratorIds) {
    const latestSettings = useRuntimeStore.getState().conversationSummaryModel;
    if (latestSettings.enabled !== true || latestSettings.autoUpdateEnabled !== true) return;
    await updateConversationSummaryMemoryForCollaborator(collaboratorId);
  }
}

type UseAutomaticConversationSummaryMemoryOptions = {
  startupReady: boolean;
};

export function useAutomaticConversationSummaryMemory({ startupReady }: UseAutomaticConversationSummaryMemoryOptions) {
  const settings = useRuntimeStore((state) => state.conversationSummaryModel);
  const runtimeHydrated = useRuntimeStore((state) => state.hydrated);
  const personas = usePersonaStore((state) => state.personas);
  const personaHydrated = usePersonaStore((state) => state.hydrated);
  const conversations = useChatStore((state) => state.conversations);
  const chatHydrated = useChatStore((state) => state.hydrated);
  const dirtyConversationCount = useChatStore((state) => state.dirtyConversationIds.length);
  const deletedConversationCount = useChatStore((state) => state.deletedConversationIds.length);
  const loadingConversationCount = useChatStore((state) => state.loadingMessageConversationIds.length);
  const collectionHydrated = useCollectionStore((state) => state.hydrated);

  const plan = useMemo(
    () => resolveAutomaticConversationSummaryPlan({
      settings,
      startupReady,
      chatHydrated,
      personaHydrated,
      runtimeHydrated,
      collectionHydrated,
      dirtyConversationCount,
      deletedConversationCount,
      loadingConversationCount,
      personas,
      conversations
    }),
    [
      settings,
      startupReady,
      chatHydrated,
      personaHydrated,
      runtimeHydrated,
      collectionHydrated,
      dirtyConversationCount,
      deletedConversationCount,
      loadingConversationCount,
      personas,
      conversations
    ]
  );

  useEffect(() => {
    if (!plan.shouldRun || typeof window === 'undefined') return undefined;

    const timeoutId = window.setTimeout(() => {
      void runAutomaticConversationSummaryMemory(startupReady).catch((error) => {
        reportPersistenceError({
          label: '[conversation-summary:auto]',
          store: 'runtime',
          operation: 'auto-update'
        }, error);
      });
    }, AUTO_CONVERSATION_SUMMARY_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [plan, startupReady]);
}
