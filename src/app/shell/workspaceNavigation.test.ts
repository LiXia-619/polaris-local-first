import { describe, expect, it, vi } from 'vitest';
import {
  closeCollectionWorkspaceFileView,
  closeCollectionWorkspaceView,
  enterConversationWorkspaceScope,
  exitConversationWorkspaceScope,
  openWorkspaceInCollectionFromChat,
  resolvePendingWorkspaceCollectionOpen
} from './workspaceNavigation';

describe('workspaceNavigation', () => {
  it('enters a conversation workspace scope', () => {
    const setConversationActiveProject = vi.fn();

    enterConversationWorkspaceScope({
      conversationId: 'conversation-1',
      projectId: 'workspace-mini-phone',
      setConversationActiveProject
    });

    expect(setConversationActiveProject).toHaveBeenCalledWith('conversation-1', 'workspace-mini-phone');
  });

  it('exits a conversation workspace scope', () => {
    const setConversationActiveProject = vi.fn();

    exitConversationWorkspaceScope({
      conversationId: 'conversation-1',
      setConversationActiveProject
    });

    expect(setConversationActiveProject).toHaveBeenCalledWith('conversation-1', null);
  });

  it('opens the current workspace in collection through the chat return bridge', () => {
    const setPendingProjectOpenId = vi.fn();
    const setPendingProjectOpenSource = vi.fn();
    const setCollectionShelf = vi.fn();
    const setWorld = vi.fn();

    openWorkspaceInCollectionFromChat({
      projectId: 'workspace-mini-phone',
      conversationId: 'conversation-1',
      setPendingProjectOpenId,
      setPendingProjectOpenSource,
      setCollectionShelf,
      setWorld
    });

    expect(setPendingProjectOpenId).toHaveBeenCalledWith('workspace-mini-phone');
    expect(setPendingProjectOpenSource).toHaveBeenCalledWith({
      world: 'chat',
      conversationId: 'conversation-1'
    });
    expect(setCollectionShelf).toHaveBeenCalledWith('project');
    expect(setWorld).toHaveBeenCalledWith('collection');
  });

  it('resolves a pending collection open request only when the workspace still exists', () => {
    expect(resolvePendingWorkspaceCollectionOpen({
      pendingProjectOpenId: 'workspace-mini-phone',
      pendingProjectOpenSource: {
        world: 'chat',
        conversationId: 'conversation-1'
      },
      hasWorkspace: (projectId) => projectId === 'workspace-mini-phone'
    })).toEqual({
      kind: 'ready',
      projectId: 'workspace-mini-phone',
      returnTarget: {
        world: 'chat',
        conversationId: 'conversation-1'
      }
    });

    expect(resolvePendingWorkspaceCollectionOpen({
      pendingProjectOpenId: 'workspace-missing',
      pendingProjectOpenSource: {
        world: 'chat',
        conversationId: 'conversation-1'
      },
      hasWorkspace: () => false
    })).toEqual({
      kind: 'stale',
      projectId: 'workspace-missing'
    });
  });

  it('closes a collection workspace view back to chat when it was opened from chat', () => {
    const setCollectionProjectId = vi.fn();
    const setActiveConversation = vi.fn();
    const setWorld = vi.fn();

    closeCollectionWorkspaceView({
      returnTarget: {
        world: 'chat',
        conversationId: 'conversation-1'
      },
      setCollectionProjectId,
      setActiveConversation,
      setWorld
    });

    expect(setActiveConversation).toHaveBeenCalledWith('conversation-1');
    expect(setWorld).toHaveBeenCalledWith('chat');
    expect(setCollectionProjectId).toHaveBeenCalledWith(null);
  });

  it('clears the collection workspace selection when closing a native collection view', () => {
    const setCollectionProjectId = vi.fn();
    const setActiveConversation = vi.fn();
    const setWorld = vi.fn();

    closeCollectionWorkspaceView({
      returnTarget: null,
      setCollectionProjectId,
      setActiveConversation,
      setWorld
    });

    expect(setCollectionProjectId).toHaveBeenCalledWith(null);
    expect(setActiveConversation).not.toHaveBeenCalled();
    expect(setWorld).not.toHaveBeenCalled();
  });

  it('closes a workspace file view back to chat when the workspace came from chat', () => {
    const setCollectionProjectId = vi.fn();
    const setActiveConversation = vi.fn();
    const setWorld = vi.fn();

    closeCollectionWorkspaceFileView({
      projectId: 'workspace-mini-phone',
      returnTarget: {
        world: 'chat',
        conversationId: 'conversation-1'
      },
      setCollectionProjectId,
      setActiveConversation,
      setWorld
    });

    expect(setActiveConversation).toHaveBeenCalledWith('conversation-1');
    expect(setCollectionProjectId).toHaveBeenCalledWith(null);
    expect(setWorld).toHaveBeenCalledWith('chat');
  });

  it('closes a workspace file view back to its project when browsing natively in collection', () => {
    const setCollectionProjectId = vi.fn();
    const setActiveConversation = vi.fn();
    const setWorld = vi.fn();

    closeCollectionWorkspaceFileView({
      projectId: 'workspace-mini-phone',
      returnTarget: null,
      setCollectionProjectId,
      setActiveConversation,
      setWorld
    });

    expect(setCollectionProjectId).toHaveBeenCalledWith('workspace-mini-phone');
    expect(setActiveConversation).not.toHaveBeenCalled();
    expect(setWorld).not.toHaveBeenCalled();
  });
});
