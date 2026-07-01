import { describe, expect, it } from 'vitest';
import type { ChatMessage, Conversation, ConversationTaskState } from '../types/domain';
import {
  applySeededConversationTask,
  getConversationTaskFromRecords,
  resolveConversationTaskForConversation,
  resolveConversationTaskForMessages,
  setConversationTaskOnRecords
} from './chatConversationTasks';

function userMessage(id: string, content: string, timestamp: number): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    timestamp
  };
}

function task(patch: Partial<ConversationTaskState> = {}): ConversationTaskState {
  return {
    id: 'task-1',
    sourceMessageId: 'user-1',
    goal: '做完这件事',
    title: '做完这件事',
    mode: 'active',
    status: 'running',
    stage: 'running',
    steps: [],
    executions: [],
    createdAt: 10,
    updatedAt: 20,
    ...patch
  };
}

function conversation(patch: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c-1',
    title: '新对话',
    kind: 'direct',
    collaboratorId: null,
    groupRoomId: null,
    activeProjectId: null,
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    ...patch
  };
}

describe('resolveConversationTaskForMessages', () => {
  it('returns the existing task when there is no user message to seed from', () => {
    const existingTask = resolveConversationTaskForMessages({
      existingTask: null,
      messages: [],
      mode: 'seed'
    });

    expect(existingTask).toEqual({
      task: null,
      shouldPersist: false
    });
  });

  it('creates a seed task from the latest user message', () => {
    const resolved = resolveConversationTaskForMessages({
      existingTask: null,
      messages: [
        userMessage('user-1', '先做页面结构', 1),
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '',
          timestamp: 2
        },
        userMessage('user-2', '再调亮一点', 3)
      ]
    });

    expect(resolved.shouldPersist).toBe(true);
    expect(resolved.task).toEqual(expect.objectContaining({
      sourceMessageId: 'user-2',
      goal: '再调亮一点',
      mode: 'seed',
      status: 'running'
    }));
  });

  it('keeps a non-terminal active task when a seed continuation arrives', () => {
    const first = resolveConversationTaskForMessages({
      existingTask: null,
      messages: [userMessage('user-1', '给这个房间换肤', 1)],
      mode: 'active'
    });

    const continued = resolveConversationTaskForMessages({
      existingTask: first.task,
      messages: [userMessage('user-2', '再把气泡调亮一点', 2)],
      mode: 'seed'
    });

    expect(continued).toEqual({
      task: first.task,
      shouldPersist: false
    });
  });

  it('reuses a same-turn task only when the mode and source stay aligned', () => {
    const first = resolveConversationTaskForMessages({
      existingTask: null,
      messages: [userMessage('user-1', '继续工作区任务', 1)],
      mode: 'active'
    });

    const sameTurn = resolveConversationTaskForMessages({
      existingTask: first.task,
      messages: [userMessage('user-1', '继续工作区任务', 1)],
      mode: 'active'
    });
    const seedContinuation = resolveConversationTaskForMessages({
      existingTask: first.task,
      messages: [userMessage('user-1', '继续工作区任务', 1)],
      mode: 'seed'
    });

    expect(sameTurn.shouldPersist).toBe(false);
    expect(sameTurn.task).toBe(first.task);
    expect(seedContinuation.shouldPersist).toBe(false);
    expect(seedContinuation.task).toBe(first.task);
  });
});

describe('conversation task record state', () => {
  it('reads a task from the matching conversation record', () => {
    const existingTask = task();
    const conversations = [
      conversation({ id: 'c-1' }),
      conversation({ id: 'c-2', task: existingTask })
    ];

    expect(getConversationTaskFromRecords(conversations, 'c-2')).toBe(existingTask);
    expect(getConversationTaskFromRecords(conversations, 'missing')).toBeNull();
  });

  it('resolves a task using the conversation record task as the existing state', () => {
    const existingTask = task({
      sourceMessageId: 'user-1',
      goal: '继续工作区任务',
      mode: 'active'
    });

    const resolved = resolveConversationTaskForConversation({
      conversations: [conversation({ task: existingTask })],
      conversationId: 'c-1',
      messages: [userMessage('user-1', '继续工作区任务', 1)],
      mode: 'active'
    });

    expect(resolved).toEqual({
      task: existingTask,
      shouldPersist: false
    });
  });

  it('applies a seeded task with the explicit conversation updatedAt', () => {
    const nextTask = task({ id: 'task-2', updatedAt: 50 });
    const original = conversation({ updatedAt: 3 });

    const updated = applySeededConversationTask({
      conversations: [original],
      conversationId: 'c-1',
      task: nextTask,
      updatedAt: 100
    });

    expect(updated[0]).toEqual(expect.objectContaining({
      task: nextTask,
      updatedAt: 100
    }));
    expect(original.task).toBeUndefined();
    expect(original.updatedAt).toBe(3);
  });

  it('sets an explicit task without moving the conversation timestamp backwards', () => {
    const nextTask = task({ updatedAt: 50 });

    expect(setConversationTaskOnRecords({
      conversations: [conversation({ updatedAt: 80 })],
      conversationId: 'c-1',
      task: nextTask
    })[0]).toEqual(expect.objectContaining({
      task: nextTask,
      updatedAt: 80
    }));

    expect(setConversationTaskOnRecords({
      conversations: [conversation({ updatedAt: 10 })],
      conversationId: 'c-1',
      task: nextTask
    })[0]).toEqual(expect.objectContaining({
      task: nextTask,
      updatedAt: 50
    }));
  });

  it('clears an explicit task without touching the conversation timestamp', () => {
    const updated = setConversationTaskOnRecords({
      conversations: [conversation({ task: task(), updatedAt: 80 })],
      conversationId: 'c-1',
      task: null
    });

    expect(updated[0]).toEqual(expect.objectContaining({
      task: null,
      updatedAt: 80
    }));
  });
});
