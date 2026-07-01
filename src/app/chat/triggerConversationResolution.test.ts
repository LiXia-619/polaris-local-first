import { describe, expect, it } from 'vitest';
import type { Conversation, PolarisTriggerTarget } from '../../types/domain';
import { resolveTriggerConversationForTarget } from './triggerConversationResolution';

function conversation(patch: Partial<Conversation> & Pick<Conversation, 'id' | 'collaboratorId'>): Conversation {
  return {
    id: patch.id,
    title: patch.title ?? patch.id,
    collaboratorId: patch.collaboratorId,
    activeProjectId: patch.activeProjectId ?? null,
    toolLedger: undefined,
    draft: '',
    pinnedAt: null,
    updatedAt: patch.updatedAt ?? 1,
    messages: patch.messages ?? []
  };
}

function target(patch: Partial<PolarisTriggerTarget> = {}): PolarisTriggerTarget {
  return {
    collaboratorId: 'nova',
    conversationMode: 'follow-latest',
    conversationId: null,
    ...patch
  };
}

describe('resolveTriggerConversationForTarget', () => {
  it('uses a valid fixed conversation when the rule explicitly selected one', () => {
    const conversations = [
      conversation({ id: 'latest', collaboratorId: 'nova' }),
      conversation({ id: 'fixed', collaboratorId: 'nova' })
    ];

    expect(resolveTriggerConversationForTarget(
      target({ conversationMode: 'fixed', conversationId: 'fixed' }),
      { conversations, activeConversationId: 'latest' },
      {
        createConversation: () => 'unused',
        getConversations: () => conversations
      }
    )?.id).toBe('fixed');
  });

  it('follows the active ordinary collaborator conversation when no fixed target is selected', () => {
    const conversations = [
      conversation({ id: 'latest', collaboratorId: 'nova' }),
      conversation({ id: 'active', collaboratorId: 'nova' })
    ];

    expect(resolveTriggerConversationForTarget(
      target(),
      { conversations, activeConversationId: 'active' },
      {
        createConversation: () => 'unused',
        getConversations: () => conversations
      }
    )?.id).toBe('active');
  });

  it('falls back to the latest ordinary collaborator conversation and skips project threads', () => {
    const conversations = [
      conversation({ id: 'workspace', collaboratorId: 'nova', activeProjectId: 'project-1' }),
      conversation({ id: 'ordinary', collaboratorId: 'nova' }),
      conversation({ id: 'other', collaboratorId: 'pharos' })
    ];

    expect(resolveTriggerConversationForTarget(
      target(),
      { conversations, activeConversationId: 'workspace' },
      {
        createConversation: () => 'unused',
        getConversations: () => conversations
      }
    )?.id).toBe('ordinary');
  });

  it('creates a collaborator conversation when there is no matching ordinary conversation', () => {
    let conversations = [conversation({ id: 'other', collaboratorId: 'pharos' })];

    expect(resolveTriggerConversationForTarget(
      target(),
      { conversations, activeConversationId: null },
      {
        createConversation: (collaboratorId) => {
          conversations = [conversation({ id: `new-${collaboratorId}`, collaboratorId: collaboratorId ?? null }), ...conversations];
          return `new-${collaboratorId}`;
        },
        getConversations: () => conversations
      }
    )?.id).toBe('new-nova');
  });
});
