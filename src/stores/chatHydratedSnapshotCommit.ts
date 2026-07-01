import { isRetiredGroupConversation } from '../engines/conversationOwnership';
import { reportPersistenceError } from '../infrastructure/persistenceDiagnostics';
import type { Conversation } from '../types/domain';
import {
  readCompleteLiveChatState,
  type PersistedChatState,
  writeChatState
} from './chatCurrentPersistence';

function uniqueConversationIds(ids: Array<string | undefined> = []) {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
}

export function filterRetiredGroupConversations(conversations: Conversation[]) {
  return conversations.filter((conversation) => !isRetiredGroupConversation(conversation));
}

function retiredGroupConversationIds(conversations: Conversation[]) {
  return conversations
    .filter(isRetiredGroupConversation)
    .map((conversation) => conversation.id);
}

function resolveWritableActiveConversationId(activeConversationId: string | null, conversations: Conversation[]) {
  if (activeConversationId === null) return null;
  if (activeConversationId && conversations.some((conversation) => conversation.id === activeConversationId)) {
    return activeConversationId;
  }
  throw new Error(`Active chat state points at a missing conversation: ${activeConversationId}`);
}

export function resolveHydratedActiveConversationId(
  activeConversationId: string | null,
  conversations: Conversation[],
  lifecycleConversationIds: ReadonlySet<string>
) {
  if (activeConversationId === null) return null;
  if (conversations.some((conversation) => conversation.id === activeConversationId)) {
    return activeConversationId;
  }
  if (lifecycleConversationIds.has(activeConversationId)) {
    return conversations[0]?.id ?? null;
  }
  throw new Error(`Active chat state points at a missing conversation: ${activeConversationId}`);
}

function hasCompleteConversationBodies(payload: PersistedChatState) {
  const loadedConversationIds = new Set(payload.loadedConversationIds ?? []);
  return payload.conversations.every((conversation) => loadedConversationIds.has(conversation.id));
}

function shouldCommitHydratedSnapshot(payload: PersistedChatState) {
  return Boolean(
    payload.shouldCommitSnapshot
    || payload.recoveredConversationIds?.length
    || payload.prunedConversationIds?.length
  );
}

type CompleteChatStateReader = typeof readCompleteLiveChatState;
type ChatStateWriter = typeof writeChatState;

async function readHydratedSnapshotPayload(
  payload: PersistedChatState,
  readCompleteState: CompleteChatStateReader = readCompleteLiveChatState
): Promise<PersistedChatState | null> {
  if (!shouldCommitHydratedSnapshot(payload)) return null;
  if (hasCompleteConversationBodies(payload)) return payload;

  try {
    const completePayload = await readCompleteState({ throwOnReadFailure: true });
    if (!completePayload) return null;
    return {
      ...completePayload,
      prunedConversationIds: uniqueConversationIds([
        ...(payload.prunedConversationIds ?? []),
        ...(completePayload.prunedConversationIds ?? [])
      ]),
      quarantinedConversationIds: uniqueConversationIds([
        ...(payload.quarantinedConversationIds ?? []),
        ...(completePayload.quarantinedConversationIds ?? [])
      ])
    };
  } catch {
    return null;
  }
}

async function commitHydratedSnapshotPayload(
  payload: PersistedChatState,
  options: {
    readCompleteState?: CompleteChatStateReader;
    writeState?: ChatStateWriter;
  } = {}
) {
  const snapshotPayload = await readHydratedSnapshotPayload(payload, options.readCompleteState);
  if (!snapshotPayload) return;
  const snapshotConversations = filterRetiredGroupConversations(snapshotPayload.conversations);
  const snapshotConversationIds = snapshotConversations.map((conversation) => conversation.id);
  await (options.writeState ?? writeChatState)({
    conversations: snapshotConversations,
    activeConversationId: resolveWritableActiveConversationId(snapshotPayload.activeConversationId, snapshotConversations),
    groupRooms: [],
    activeGroupRoomId: null,
    dirtyConversationIds: snapshotConversationIds,
    loadedConversationIds: snapshotConversationIds,
    deletedConversationIds: uniqueConversationIds([
      ...(snapshotPayload.prunedConversationIds ?? []),
      ...retiredGroupConversationIds(snapshotPayload.conversations)
    ]),
    quarantinedConversationIds: snapshotPayload.quarantinedConversationIds ?? []
  });
}

export function scheduleHydratedSnapshotCommit(
  payload: PersistedChatState,
  options: {
    readCompleteState?: CompleteChatStateReader;
    writeState?: ChatStateWriter;
    schedule?: (run: () => Promise<void>) => void;
    reportError?: (error: unknown) => void;
  } = {}
) {
  if (!shouldCommitHydratedSnapshot(payload)) return false;

  const run = async () => {
    try {
      await commitHydratedSnapshotPayload(payload, options);
    } catch (error) {
      (options.reportError ?? ((caught) => {
        reportPersistenceError({ label: '[store:persist]', store: 'chat', operation: 'background-recovery-write' }, caught);
      }))(error);
    }
  };

  const schedule = options.schedule ?? ((task: () => Promise<void>) => {
    const start = () => {
      void task();
    };
    if (typeof window !== 'undefined') {
      window.setTimeout(start, 0);
      return;
    }
    globalThis.setTimeout(start, 0);
  });
  schedule(run);
  return true;
}
