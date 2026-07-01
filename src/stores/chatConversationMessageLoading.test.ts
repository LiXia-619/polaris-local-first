import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, Conversation } from '../types/domain';
import { ensureConversationMessagesLoadedFromState } from './chatConversationMessageLoading';
import type { ChatConversationBodyStatus } from './chatConversationBodyStatus';

type TestState = {
  conversations: Conversation[];
  conversationBodyStatuses: Record<string, ChatConversationBodyStatus>;
  loadedMessageConversationIds: string[];
  loadingMessageConversationIds: string[];
};

function conversation(id: string): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    messages: [],
    pinnedAt: null,
    updatedAt: 1
  };
}

function createPort(options: {
  state?: Partial<TestState>;
  readMessages: (conversationId: string) => Promise<ChatMessage[]>;
}) {
  let state: TestState = {
    conversations: [conversation('c-1')],
    conversationBodyStatuses: {},
    loadedMessageConversationIds: [],
    loadingMessageConversationIds: [],
    ...options.state
  };

  return {
    getState: () => state,
    setState: (updater: (current: TestState) => Partial<TestState>) => {
      state = {
        ...state,
        ...updater(state)
      };
    },
    readMessages: options.readMessages,
    applyLoadedMessages: (entry: Conversation, messages: ChatMessage[]) => ({
      ...entry,
      title: messages[0]?.content ?? entry.title,
      messages
    })
  };
}

describe('ensureConversationMessagesLoadedFromState', () => {
  it('coalesces concurrent body reads and marks the conversation loaded', async () => {
    const messages: ChatMessage[] = [{
      id: 'm-1',
      role: 'user',
      content: 'loaded title',
      timestamp: 1
    }];
    let releaseRead: (value: ChatMessage[]) => void = () => {};
    const readMessages = vi.fn(() => new Promise<ChatMessage[]>((resolve) => {
      releaseRead = resolve;
    }));
    const port = createPort({ readMessages });

    const firstLoad = ensureConversationMessagesLoadedFromState(port, 'c-1');
    const secondLoad = ensureConversationMessagesLoadedFromState(port, 'c-1');

    expect(readMessages).toHaveBeenCalledTimes(1);
    expect(port.getState().conversationBodyStatuses['c-1']?.state).toBe('loading');

    releaseRead(messages);

    await expect(firstLoad).resolves.toMatchObject({ id: 'c-1', title: 'loaded title', messages });
    await expect(secondLoad).resolves.toMatchObject({ id: 'c-1', title: 'loaded title', messages });
    expect(port.getState().conversationBodyStatuses['c-1']?.state).toBe('loaded');
    expect(port.getState().loadedMessageConversationIds).toEqual(['c-1']);
    expect(port.getState().loadingMessageConversationIds).toEqual([]);
  });

  it('marks missing chunks as missing instead of retryable failed reads', async () => {
    const port = createPort({
      readMessages: async (conversationId) => {
        throw new Error(`Conversation message chunk is missing: ${conversationId}`);
      }
    });

    await expect(ensureConversationMessagesLoadedFromState(port, 'c-1'))
      .rejects.toThrow('Conversation message chunk is missing: c-1');

    expect(port.getState().conversationBodyStatuses['c-1']).toEqual(expect.objectContaining({
      state: 'missing',
      reason: 'Conversation message chunk is missing: c-1'
    }));
    expect(port.getState().loadedMessageConversationIds).toEqual([]);
    expect(port.getState().loadingMessageConversationIds).toEqual([]);
  });
});
