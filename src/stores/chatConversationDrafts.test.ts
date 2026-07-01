import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types/domain';
import {
  activateConversation,
  updateActiveConversationDraft,
  updateConversationDraft
} from './chatConversationDrafts';

function conversation(id: string, draft = ''): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    draft
  };
}

describe('chat conversation drafts', () => {
  it('keeps standalone input draft when there is no active conversation', () => {
    expect(updateActiveConversationDraft({
      conversations: [],
      activeConversationId: null,
      inputDraft: ''
    }, 'loose draft')).toEqual({
      patch: { inputDraft: 'loose draft' },
      dirtyConversationId: null
    });

    expect(updateActiveConversationDraft({
      conversations: [],
      activeConversationId: null,
      inputDraft: 'same'
    }, 'same')).toBeNull();
  });

  it('writes active input drafts into the active conversation', () => {
    const result = updateActiveConversationDraft({
      conversations: [conversation('c-1'), conversation('c-2')],
      activeConversationId: 'c-2',
      inputDraft: ''
    }, 'second draft');

    expect(result?.dirtyConversationId).toBe('c-2');
    expect(result?.patch.inputDraft).toBe('second draft');
    expect(result?.patch.conversations?.find((entry) => entry.id === 'c-2')?.draft).toBe('second draft');
    expect(result?.patch.conversations?.find((entry) => entry.id === 'c-1')?.draft).toBe('');
  });

  it('updates non-active drafts without stealing the active input', () => {
    const result = updateConversationDraft({
      conversations: [conversation('c-1', 'old'), conversation('c-2', 'active')],
      activeConversationId: 'c-2',
      inputDraft: 'active'
    }, 'c-1', 'new');

    expect(result?.dirtyConversationId).toBe('c-1');
    expect(result?.patch.inputDraft).toBe('active');
    expect(result?.patch.conversations?.find((entry) => entry.id === 'c-1')?.draft).toBe('new');
  });

  it('restores draft when activating another conversation', () => {
    expect(activateConversation({
      conversations: [conversation('c-1', 'first draft'), conversation('c-2', 'second draft')],
      activeConversationId: 'c-2',
      inputDraft: 'second draft'
    }, 'c-1')).toEqual({
      activeConversationId: 'c-1',
      inputDraft: 'first draft'
    });
  });
});
