import { describe, expect, it } from 'vitest';
import type { ChatMessage, CodeCard, Conversation, Persona } from '../types/domain';
import { formatActorMark, formatTraceContextLabel, traceAttributionForCollectionItem, traceAttributionForMessage } from './traceAttribution';

const personas = [
  { id: 'pharos', name: 'Pharos' },
  { id: 'lyra', name: 'Lyra' }
] as Persona[];

describe('traceAttributionForMessage', () => {
  it('formats a group member message as an actor mark', () => {
    const message = {
      id: 'message-1',
      role: 'assistant',
      content: '我在。',
      timestamp: 1,
      speakerCollaboratorId: 'pharos'
    } satisfies ChatMessage;

    const attribution = traceAttributionForMessage(message, {
      personas,
      scopeId: 'group-1',
      scopeName: '抹茶拿铁',
      scopeKind: 'group-room'
    });

    expect(formatActorMark(attribution)).toBe('✦ Pharos · 群聊「抹茶拿铁」');
    expect(formatActorMark(attribution, { includeScope: false })).toBe('✦ Pharos');
  });

  it('keeps unknown assistant messages legible', () => {
    const message = {
      id: 'message-1',
      role: 'assistant',
      content: '继续。',
      timestamp: 1
    } satisfies ChatMessage;

    const attribution = traceAttributionForMessage(message, {
      personas,
      scopeName: '群聊',
      scopeKind: 'group-room'
    });

    expect(attribution.actorKind).toBe('unknown');
    expect(formatActorMark(attribution)).toBe('✦ 协作者 · 群聊「群聊」');
  });
});

describe('traceAttributionForCollectionItem', () => {
  it('separates the producing actor from the group scope', () => {
    const card = {
      id: 'card-1',
      title: '任务清单',
      language: 'markdown',
      code: '- done',
      tags: [],
      source: 'chat-generated',
      ownerCollaboratorId: 'lyra',
      originConversationId: 'conversation-group',
      createdAt: 1,
      updatedAt: 1
    } satisfies CodeCard;
    const conversations = [
      {
        id: 'conversation-group',
        title: '抹茶拿铁',
        collaboratorId: null,
        groupRoomId: 'group-1',
        messages: [],
        pinnedAt: null,
        updatedAt: 1
      }
    ] satisfies Conversation[];

    const attribution = traceAttributionForCollectionItem(card, {
      personas,
      conversations
    });

    expect(attribution).toMatchObject({
      actorId: 'lyra',
      actorName: 'Lyra',
      actorKind: 'collaborator',
      scopeId: 'group-1',
      scopeName: '抹茶拿铁',
      scopeKind: 'group-room'
    });
    expect(formatTraceContextLabel('group-card', attribution)).toBe('[group-card] ✦ Lyra · 群聊「抹茶拿铁」');
  });
});
