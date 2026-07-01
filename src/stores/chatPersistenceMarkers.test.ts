import { describe, expect, it } from 'vitest';
import {
  appendConversationId,
  markChatIndexDirty,
  markConversationDirty,
  markConversationsDirty
} from './chatPersistenceMarkers';

describe('chat persistence markers', () => {
  it('appends conversation ids without duplicating existing entries', () => {
    const existing = ['c-1'];

    expect(appendConversationId(existing, 'c-1')).toBe(existing);
    expect(appendConversationId(existing, 'c-2')).toEqual(['c-1', 'c-2']);
  });

  it('bumps the persistence version when the chat index changes', () => {
    expect(markChatIndexDirty({ conversationPersistVersion: 4 })).toEqual({
      conversationPersistVersion: 5
    });
  });

  it('marks one conversation dirty and bumps the version once', () => {
    expect(markConversationDirty({
      dirtyConversationIds: ['c-1'],
      conversationPersistVersion: 4
    }, 'c-2')).toEqual({
      dirtyConversationIds: ['c-1', 'c-2'],
      conversationPersistVersion: 5
    });
  });

  it('marks multiple conversations dirty and keeps existing order stable', () => {
    expect(markConversationsDirty({
      dirtyConversationIds: ['c-1'],
      conversationPersistVersion: 4
    }, ['c-2', 'c-1', 'c-3'])).toEqual({
      dirtyConversationIds: ['c-1', 'c-2', 'c-3'],
      conversationPersistVersion: 5
    });
  });
});
