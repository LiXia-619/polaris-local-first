import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types/domain';
import {
  assertWritableConversationBody,
  createBodyStatus,
  getConversationBodyState,
  getConversationWritableFromState,
  hydrateConversationBodyStatuses,
  loadedConversationIdsFromBodyStatuses,
  withConversationBodyStatus,
  withoutConversationBodyStatus
} from './chatConversationBodyStatus';

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

describe('chat conversation body status', () => {
  it('uses explicit status before loaded/loading list fallbacks', () => {
    const state = {
      conversationBodyStatuses: {
        'c-1': createBodyStatus('missing', { reason: 'missing body', updatedAt: 1 })
      },
      loadedMessageConversationIds: ['c-1', 'c-2'],
      loadingMessageConversationIds: ['c-3']
    };

    expect(getConversationBodyState(state, 'c-1')).toBe('missing');
    expect(getConversationBodyState(state, 'c-2')).toBe('loaded');
    expect(getConversationBodyState(state, 'c-3')).toBe('loading');
    expect(getConversationBodyState(state, 'c-4')).toBe('notLoaded');
  });

  it('keeps loaded and loading id lists aligned with the status map', () => {
    const base = {
      conversationBodyStatuses: {},
      loadedMessageConversationIds: [],
      loadingMessageConversationIds: []
    };

    const loading = withConversationBodyStatus(base, 'c-1', createBodyStatus('loading', { updatedAt: 1 }));
    expect(loading.loadingMessageConversationIds).toEqual(['c-1']);
    expect(loading.loadedMessageConversationIds).toEqual([]);

    const loaded = withConversationBodyStatus(loading, 'c-1', createBodyStatus('loaded', { updatedAt: 2 }));
    expect(loaded.loadingMessageConversationIds).toEqual([]);
    expect(loaded.loadedMessageConversationIds).toEqual(['c-1']);
    expect(() => assertWritableConversationBody(loaded, 'c-1', 'edit')).not.toThrow();

    const removed = withoutConversationBodyStatus(loaded, 'c-1');
    expect(removed.conversationBodyStatuses).toEqual({});
    expect(removed.loadedMessageConversationIds).toEqual([]);
    expect(() => assertWritableConversationBody(removed, 'c-1', 'edit'))
      .toThrow('Cannot edit before conversation body is loaded: c-1 (notLoaded)');
  });

  it('hydrates body statuses and projects loaded ids from conversations', () => {
    const conversations = [conversation('c-loaded'), conversation('c-cold')];
    const conversationBodyStatuses = hydrateConversationBodyStatuses(conversations, ['c-loaded']);
    const loadedIds = loadedConversationIdsFromBodyStatuses({
      conversations,
      conversationBodyStatuses,
      loadedMessageConversationIds: [],
      loadingMessageConversationIds: []
    });

    expect(conversationBodyStatuses['c-loaded']?.state).toBe('loaded');
    expect(conversationBodyStatuses['c-cold']?.state).toBe('notLoaded');
    expect(loadedIds).toEqual(['c-loaded']);
  });

  it('exposes writable targets only for loaded conversation bodies', () => {
    const loadedConversation = {
      ...conversation('c-loaded'),
      messages: [{
        id: 'm-1',
        role: 'user' as const,
        content: 'hello',
        timestamp: 1
      }]
    };
    const state = {
      conversations: [loadedConversation, conversation('c-cold')],
      conversationBodyStatuses: {
        'c-loaded': createBodyStatus('loaded', { updatedAt: 1 }),
        'c-cold': createBodyStatus('notLoaded', { updatedAt: 1 })
      },
      loadedMessageConversationIds: [],
      loadingMessageConversationIds: []
    };

    expect(getConversationWritableFromState(state, 'c-loaded')).toEqual({
      conversationId: 'c-loaded',
      conversation: loadedConversation,
      messages: loadedConversation.messages
    });
    expect(getConversationWritableFromState(state, 'c-cold')).toBeNull();
    expect(getConversationWritableFromState(state, 'missing')).toBeNull();
  });
});
