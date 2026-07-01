import { describe, expect, it } from 'vitest';
import { buildConversationTaskExecution } from './conversationTaskExecution';

describe('buildConversationTaskExecution', () => {
  it('collects tool ledger pairings and pending workspace proposals for one assistant turn', () => {
    const execution = buildConversationTaskExecution({
      assistantMessageId: 'assistant-1',
      toolLedger: [
        {
          id: 'ledger-1',
          toolCallId: 'tool-call-1',
          assistantMessageId: 'assistant-1',
          order: 0,
          toolName: 'createProjectFile',
          argumentsText: '{}',
          resultMessageId: 'tool-message-1'
        },
        {
          id: 'ledger-2',
          toolCallId: 'tool-call-2',
          assistantMessageId: 'assistant-2',
          order: 0,
          toolName: 'readProjectFile',
          argumentsText: '{}',
          resultMessageId: 'tool-message-2'
        }
      ],
      outcomes: [{
        path: 'workspace',
        proposalId: 'proposal-1'
      }],
      updatedAt: 20
    });

    expect(execution).toEqual({
      id: 'assistant-1',
      assistantMessageId: 'assistant-1',
      toolCallIds: ['tool-call-1'],
      resultMessageIds: ['tool-message-1'],
      pendingProposalIds: ['proposal-1'],
      updatedAt: 20
    });
  });
});
