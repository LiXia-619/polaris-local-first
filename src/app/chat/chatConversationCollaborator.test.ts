import { describe, expect, it } from 'vitest';
import {
  toActiveConversationCollaborator,
  toActiveConversationCollaboratorSession
} from './chatConversationCollaborator';

describe('toActiveConversationCollaborator', () => {
  it('maps a conversation into collaborator-focused shape', () => {
    expect(toActiveConversationCollaborator({
      id: 'conv-1',
      collaboratorId: 'lyra'
    })).toEqual({
      id: 'conv-1',
      collaboratorId: 'lyra'
    });
  });

  it('returns null when there is no active conversation', () => {
    expect(toActiveConversationCollaborator(null)).toBeNull();
  });

  it('preserves orphaned ownership as null', () => {
    expect(toActiveConversationCollaborator({
      id: 'conv-1',
      collaboratorId: null
    })).toEqual({
      id: 'conv-1',
      collaboratorId: null
    });
  });

  it('keeps messages when mapping an active conversation session', () => {
    expect(toActiveConversationCollaboratorSession({
      id: 'conv-1',
      collaboratorId: 'lyra',
      messages: [{ id: 'm1' }] as never[]
    })).toEqual({
      id: 'conv-1',
      collaboratorId: 'lyra',
      messages: [{ id: 'm1' }]
    });
  });
});
