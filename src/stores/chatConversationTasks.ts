import {
  createConversationTaskShell,
  isConversationTaskTerminal
} from '../engines/conversationTask';
import type {
  ChatMessage,
  Conversation,
  ConversationTaskMode,
  ConversationTaskState
} from '../types/domain';

export type ConversationTaskResolution = {
  task: ConversationTaskState | null;
  shouldPersist: boolean;
};

function findLatestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user') ?? null;
}

function canReuseConversationTask(args: {
  existingTask: ConversationTaskState;
  latestUserMessage: ChatMessage;
  expectedMode: ConversationTaskMode;
}) {
  const { existingTask, latestUserMessage, expectedMode } = args;
  if (
    existingTask.mode === 'active'
    && expectedMode === 'seed'
    && !isConversationTaskTerminal(existingTask.status)
  ) {
    return true;
  }

  if (
    existingTask.sourceMessageId === latestUserMessage.id
    && existingTask.goal === latestUserMessage.content.trim()
    && existingTask.mode === 'active'
    && expectedMode === 'seed'
  ) {
    return true;
  }

  return (
    existingTask.sourceMessageId === latestUserMessage.id
    && existingTask.goal === latestUserMessage.content.trim()
    && existingTask.mode === expectedMode
  );
}

export function resolveConversationTaskForMessages(args: {
  existingTask: ConversationTaskState | null;
  messages: ChatMessage[];
  mode?: ConversationTaskMode;
}): ConversationTaskResolution {
  const latestUserMessage = findLatestUserMessage(args.messages);
  if (!latestUserMessage) {
    return {
      task: args.existingTask,
      shouldPersist: false
    };
  }

  const expectedMode = args.mode ?? 'seed';
  if (
    args.existingTask
    && canReuseConversationTask({
      existingTask: args.existingTask,
      latestUserMessage,
      expectedMode
    })
  ) {
    return {
      task: args.existingTask,
      shouldPersist: false
    };
  }

  return {
    task: createConversationTaskShell({
      sourceMessage: latestUserMessage,
      createdAt: Date.now(),
      mode: expectedMode
    }),
    shouldPersist: true
  };
}

export function getConversationTaskFromRecords(
  conversations: Conversation[],
  conversationId: string
): ConversationTaskState | null {
  return conversations.find((conversation) => conversation.id === conversationId)?.task ?? null;
}

export function resolveConversationTaskForConversation(args: {
  conversations: Conversation[];
  conversationId: string;
  messages: ChatMessage[];
  mode?: ConversationTaskMode;
}): ConversationTaskResolution {
  return resolveConversationTaskForMessages({
    existingTask: getConversationTaskFromRecords(args.conversations, args.conversationId),
    messages: args.messages,
    mode: args.mode
  });
}

export function applySeededConversationTask(args: {
  conversations: Conversation[];
  conversationId: string;
  task: ConversationTaskState;
  updatedAt: number;
}): Conversation[] {
  return args.conversations.map((conversation) =>
    conversation.id === args.conversationId
      ? {
          ...conversation,
          task: args.task,
          updatedAt: args.updatedAt
        }
      : conversation
  );
}

export function setConversationTaskOnRecords(args: {
  conversations: Conversation[];
  conversationId: string;
  task: ConversationTaskState | null;
}): Conversation[] {
  return args.conversations.map((conversation) =>
    conversation.id === args.conversationId
      ? {
          ...conversation,
          task: args.task,
          updatedAt: args.task
            ? Math.max(conversation.updatedAt, args.task.updatedAt)
            : conversation.updatedAt
        }
      : conversation
  );
}
