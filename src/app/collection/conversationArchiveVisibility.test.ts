import { describe, expect, it } from 'vitest';
import { hasArchivedConversationContent } from './conversationArchiveVisibility';
import type { Conversation } from '../../types/domain';

function conversation(seed: Partial<Conversation> & Pick<Conversation, 'id'>): Conversation {
  return {
    title: seed.title ?? seed.id,
    collaboratorId: seed.collaboratorId ?? null,
    messages: seed.messages ?? [],
    pinnedAt: null,
    updatedAt: 1,
    ...seed
  };
}

describe('hasArchivedConversationContent', () => {
  it('keeps unloaded indexed conversations visible as archive entries', () => {
    const entry = conversation({ id: 'old-chat', messages: [] });

    expect(hasArchivedConversationContent(entry, {
      loadedMessageConversationIds: new Set(['active-chat'])
    })).toBe(true);
  });

  it('hides loaded empty conversations', () => {
    const entry = conversation({ id: 'empty-chat', messages: [] });

    expect(hasArchivedConversationContent(entry, {
      loadedMessageConversationIds: new Set(['empty-chat'])
    })).toBe(false);
  });

  it('counts loaded conversations with user-visible text or attachments', () => {
    const textEntry = conversation({
      id: 'text-chat',
      messages: [{
        id: 'message',
        role: 'user',
        origin: 'user-input',
        content: 'hello',
        timestamp: 1
      }]
    });
    const attachmentEntry = conversation({
      id: 'attachment-chat',
      messages: [{
        id: 'message',
        role: 'user',
        origin: 'user-input',
        content: '',
        timestamp: 1,
        attachments: [{
          id: 'file',
          assetId: 'asset',
          kind: 'file',
          name: 'note.md',
          mimeType: 'text/markdown',
          size: 10
        }]
      }]
    });

    expect(hasArchivedConversationContent(textEntry, {
      loadedMessageConversationIds: new Set(['text-chat'])
    })).toBe(true);
    expect(hasArchivedConversationContent(attachmentEntry, {
      loadedMessageConversationIds: new Set(['attachment-chat'])
    })).toBe(true);
  });

  it('hides loaded tool-only conversations', () => {
    const entry = conversation({
      id: 'tool-chat',
      messages: [{
        id: 'message',
        role: 'assistant',
        origin: 'tool-runtime',
        content: 'internal result',
        timestamp: 1,
        toolInvocation: {
          id: 'tool',
          kind: 'readProjectFile',
          title: 'Theme',
          summary: 'internal',
          status: 'executed'
        }
      }]
    });

    expect(hasArchivedConversationContent(entry, {
      loadedMessageConversationIds: new Set(['tool-chat'])
    })).toBe(false);
  });
});
