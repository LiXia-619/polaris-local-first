import { describe, expect, it } from 'vitest';
import {
  createConversationForCollaborator,
  ensureConversationSession,
  openConversationForCollaborator,
  orphanCollaboratorConversationSessions,
  resolveDefaultCollaboratorId
} from './chatConversationSession';

describe('chatConversationSession', () => {
  const personas = [
    { id: 'pharos' },
    { id: 'lyra' },
    { id: 'aster' }
  ] as never[];

  it('prefers the current collaborator when resolving defaults', () => {
    expect(resolveDefaultCollaboratorId(personas, 'lyra')).toBe('lyra');
  });

  it('does not synthesize Pharos when no collaborators remain', () => {
    expect(resolveDefaultCollaboratorId([], null)).toBeNull();
  });

  it('creates a new conversation for the resolved collaborator', () => {
    expect(createConversationForCollaborator(
      { createConversation: (collaboratorId) => collaboratorId ?? 'missing' },
      personas,
      'lyra'
    )).toBe('lyra');
  });

  it('returns collaboratorId from an active conversation session', () => {
    expect(ensureConversationSession({
      activeConversation: {
        id: 'conv-1',
        collaboratorId: 'aster',
        messages: []
      },
      activeCollaboratorId: 'pharos',
      personas
    }, {
      createConversation: () => 'unused'
    })).toEqual({
      conversationId: 'conv-1',
      collaboratorId: 'aster',
      messages: []
    });
  });

  it('starts a new conversation instead of continuing an orphaned thread', () => {
    expect(ensureConversationSession({
      activeConversation: {
        id: 'conv-orphan',
        collaboratorId: null,
        messages: [{ id: 'm-1' }] as never[]
      },
      activeCollaboratorId: 'pharos',
      personas
    }, {
      createConversation: () => 'conv-new'
    })).toEqual({
      conversationId: 'conv-new',
      collaboratorId: 'pharos',
      messages: []
    });
  });

  it('opens the latest existing conversation for a collaborator', () => {
    const setActiveConversationCalls: string[] = [];

    expect(openConversationForCollaborator({
      conversations: [
        { id: 'conv-2', collaboratorId: 'lyra' },
        { id: 'conv-1', collaboratorId: 'lyra' },
        { id: 'conv-3', collaboratorId: 'aster' }
      ],
      personas,
      activeCollaboratorId: 'pharos'
    }, {
      createConversation: () => 'unused',
      setActiveConversation: (conversationId) => {
        setActiveConversationCalls.push(conversationId);
      }
    }, 'lyra')).toEqual({
      conversationId: 'conv-2',
      collaboratorId: 'lyra',
      created: false
    });

    expect(setActiveConversationCalls).toEqual(['conv-2']);
  });

  it('creates a new conversation when the collaborator has no history', () => {
    const setActiveConversationCalls: string[] = [];

    expect(openConversationForCollaborator({
      conversations: [{ id: 'conv-1', collaboratorId: 'pharos' }],
      personas,
      activeCollaboratorId: 'pharos'
    }, {
      createConversation: (collaboratorId) => `new-${collaboratorId ?? 'missing'}`,
      setActiveConversation: (conversationId) => {
        setActiveConversationCalls.push(conversationId);
      }
    }, 'aster')).toEqual({
      conversationId: 'new-aster',
      collaboratorId: 'aster',
      created: true
    });

    expect(setActiveConversationCalls).toEqual([]);
  });

  it('prefers the matching workspace thread instead of reusing a generic collaborator thread', () => {
    const setActiveConversationCalls: string[] = [];

    expect(openConversationForCollaborator({
      conversations: [
        { id: 'conv-generic', collaboratorId: 'lyra', activeProjectId: null },
        { id: 'conv-workspace', collaboratorId: 'lyra', activeProjectId: 'workspace-7' }
      ],
      personas,
      activeCollaboratorId: 'pharos'
    }, {
      createConversation: () => 'unused',
      setActiveConversation: (conversationId) => {
        setActiveConversationCalls.push(conversationId);
      }
    }, 'lyra', {
      preferredProjectId: 'workspace-7'
    })).toEqual({
      conversationId: 'conv-workspace',
      collaboratorId: 'lyra',
      created: false
    });

    expect(setActiveConversationCalls).toEqual(['conv-workspace']);
  });

  it('creates a dedicated workspace thread instead of reusing a generic collaborator thread', () => {
    const setActiveConversationCalls: string[] = [];

    expect(openConversationForCollaborator({
      conversations: [
        { id: 'conv-generic', collaboratorId: 'lyra', activeProjectId: null }
      ],
      personas,
      activeCollaboratorId: 'pharos'
    }, {
      createConversation: (collaboratorId, options) => `new-${collaboratorId ?? 'missing'}-${options?.activeProjectId ?? 'generic'}`,
      setActiveConversation: (conversationId) => {
        setActiveConversationCalls.push(conversationId);
      }
    }, 'lyra', {
      preferredProjectId: 'workspace-7'
    })).toEqual({
      conversationId: 'new-lyra-workspace-7',
      collaboratorId: 'lyra',
      created: true
    });

    expect(setActiveConversationCalls).toEqual([]);
  });

  it('orphans collaborator conversations and opens a fallback conversation when the active one loses its owner', () => {
    const orphanedConversationIds: string[] = [];
    const setActiveConversationCalls: string[] = [];

    expect(orphanCollaboratorConversationSessions({
      collaboratorId: 'lyra',
      conversations: [
        { id: 'conv-1', collaboratorId: 'lyra' },
        { id: 'conv-2', collaboratorId: 'lyra' },
        { id: 'conv-3', collaboratorId: 'aster' }
      ],
      personas,
      activeCollaboratorId: 'lyra',
      activeConversationId: 'conv-1'
    }, {
      createConversation: (collaboratorId) => `new-${collaboratorId ?? 'missing'}`,
      setActiveConversation: (conversationId) => {
        setActiveConversationCalls.push(conversationId);
      },
      orphanConversation: (conversationId) => {
        orphanedConversationIds.push(conversationId);
      }
    })).toEqual({
      orphanedConversationIds: ['conv-1', 'conv-2'],
      nextCollaboratorId: 'pharos',
      nextConversationId: 'new-pharos'
    });

    expect(setActiveConversationCalls).toEqual([]);
    expect(orphanedConversationIds).toEqual(['conv-1', 'conv-2']);
  });

  it('creates a fallback conversation when the active orphaned thread has no remaining owner history to switch to', () => {
    const orphanedConversationIds: string[] = [];

    expect(orphanCollaboratorConversationSessions({
      collaboratorId: 'lyra',
      conversations: [
        { id: 'conv-1', collaboratorId: 'lyra' }
      ],
      personas,
      activeCollaboratorId: 'lyra',
      activeConversationId: 'conv-1'
    }, {
      createConversation: (collaboratorId) => `new-${collaboratorId ?? 'missing'}`,
      setActiveConversation: () => {
        throw new Error('should create a new conversation instead of switching to an existing one');
      },
      orphanConversation: (conversationId) => {
        orphanedConversationIds.push(conversationId);
      }
    })).toEqual({
      orphanedConversationIds: ['conv-1'],
      nextCollaboratorId: 'pharos',
      nextConversationId: 'new-pharos'
    });

    expect(orphanedConversationIds).toEqual(['conv-1']);
  });

  it('does not create a session when every collaborator has been deleted', () => {
    expect(ensureConversationSession({
      activeConversation: null,
      activeCollaboratorId: null,
      personas: []
    }, {
      createConversation: () => {
        throw new Error('should not create an orphan conversation without a collaborator');
      }
    })).toBeNull();
  });
});
