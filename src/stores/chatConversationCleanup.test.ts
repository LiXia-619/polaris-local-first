import { describe, expect, it } from 'vitest';
import type { ChatMessage, Conversation } from '../types/domain';
import {
  clearConversationAttachmentsByAssetIds,
  deleteConversationFromState,
  type ChatConversationDeletionState
} from './chatConversationCleanup';
import { createBodyStatus } from './chatConversationBodyStatus';

function message(id: string, attachments: NonNullable<ChatMessage['attachments']> = []): ChatMessage {
  return {
    id,
    role: 'user',
    content: id,
    timestamp: 1,
    attachments
  };
}

function conversation(id: string, patch: Partial<Conversation> = {}): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    ...patch
  };
}

function deletionState(patch: Partial<ChatConversationDeletionState> = {}): ChatConversationDeletionState {
  const first = conversation('c-1', { draft: 'first draft' });
  const second = conversation('c-2', { draft: 'second draft' });
  return {
    conversations: [first, second],
    activeConversationId: 'c-2',
    inputDraft: 'second draft',
    conversationBodyStatuses: {
      'c-1': createBodyStatus('loaded'),
      'c-2': createBodyStatus('loaded')
    },
    loadedMessageConversationIds: ['c-1', 'c-2'],
    loadingMessageConversationIds: [],
    dirtyConversationIds: ['c-2'],
    deletedConversationIds: [],
    conversationPersistVersion: 3,
    pendingWorkspaceProposals: [{
      id: 'proposal-1',
      conversationId: 'c-2',
      source: 'model-proposed',
      requestedProjectTitle: 'Mini Phone',
      requestedActions: [],
      requestedActionKinds: ['createRoomProject'],
      requestedFilePaths: ['index.html'],
      draftProjectId: 'workspace-mini',
      status: 'pending',
      createdAt: 1
    }],
    transientRuntimeFeedbackEventsByConversationId: {
      'c-2': [{
        id: 'rtf-1',
        kind: 'assistant_tool_preparation_failed',
        createdAt: 2,
        status: 'parse_failed',
        summary: 'failed'
      }]
    },
    workspaceScopeEventsByConversationId: {
      'c-2': [{
        conversationId: 'c-2',
        previousProjectId: null,
        nextProjectId: 'workspace-mini',
        kind: 'entered',
        timestamp: 3
      }]
    },
    ...patch
  };
}

describe('chat conversation cleanup', () => {
  it('clears matching attachment copies and removes private text content', () => {
    const conversations = [
      conversation('c-1', {
        messages: [
          message('m-1', [
            {
              id: 'a-1',
              assetId: 'asset-temp',
              kind: 'file',
              name: 'notes.txt',
              mimeType: 'text/plain',
              size: 12,
              textContent: 'private notes'
            },
            {
              id: 'a-2',
              assetId: 'asset-keep',
              kind: 'file',
              name: 'keep.txt',
              mimeType: 'text/plain',
              size: 8,
              textContent: 'keep'
            }
          ])
        ]
      })
    ];

    const result = clearConversationAttachmentsByAssetIds({
      conversations,
      assetIds: ['asset-temp'],
      clearedAt: 42,
      canWriteConversationBody: () => true
    });

    expect(result?.dirtyConversationIds).toEqual(['c-1']);
    expect(result?.conversations[0]?.messages[0]?.attachments?.[0]).toEqual(expect.objectContaining({
      id: 'a-1',
      assetId: 'asset-temp',
      clearedAt: 42
    }));
    expect(result?.conversations[0]?.messages[0]?.attachments?.[0]?.textContent).toBeUndefined();
    expect(result?.conversations[0]?.messages[0]?.attachments?.[1]?.textContent).toBe('keep');
  });

  it('does not clear attachments for unloaded or already cleared conversations', () => {
    const conversations = [
      conversation('c-1', {
        messages: [
          message('m-1', [{
            id: 'a-1',
            assetId: 'asset-temp',
            kind: 'file',
            name: 'notes.txt',
            mimeType: 'text/plain',
            size: 12,
            textContent: 'private notes'
          }])
        ]
      })
    ];

    expect(clearConversationAttachmentsByAssetIds({
      conversations,
      assetIds: ['asset-temp'],
      clearedAt: 42,
      canWriteConversationBody: () => false
    })).toBeNull();
    expect(clearConversationAttachmentsByAssetIds({
      conversations,
      assetIds: ['  '],
      clearedAt: 42,
      canWriteConversationBody: () => true
    })).toBeNull();
  });

  it('removes deleted conversation state and restores the next active draft', () => {
    const next = deleteConversationFromState(deletionState(), 'c-2');

    expect(next.conversations.map((entry) => entry.id)).toEqual(['c-1']);
    expect(next.activeConversationId).toBe('c-1');
    expect(next.inputDraft).toBe('first draft');
    expect(next.dirtyConversationIds).toEqual([]);
    expect(next.deletedConversationIds).toEqual(['c-2']);
    expect(next.conversationPersistVersion).toBe(4);
    expect(next.pendingWorkspaceProposals).toEqual([]);
    expect(next.transientRuntimeFeedbackEventsByConversationId).toEqual({});
    expect(next.workspaceScopeEventsByConversationId).toEqual({});
    expect(next.loadedMessageConversationIds).toEqual(['c-1']);
  });
});
