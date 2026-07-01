import { revealCollectionShelf } from './frontstageNavigation';
import type { CollectionShelf, WorkspaceViewReturnTarget, World } from '../../types/domain';

export function enterConversationWorkspaceScope(args: {
  conversationId: string;
  projectId: string;
  setConversationActiveProject: (conversationId: string, projectId: string | null) => void;
}) {
  args.setConversationActiveProject(args.conversationId, args.projectId);
}

export function exitConversationWorkspaceScope(args: {
  conversationId: string;
  setConversationActiveProject: (conversationId: string, projectId: string | null) => void;
}) {
  args.setConversationActiveProject(args.conversationId, null);
}

export function openWorkspaceInCollectionFromChat(args: {
  projectId: string;
  conversationId: string;
  setPendingProjectOpenId: (projectId: string | null) => void;
  setPendingProjectOpenSource: (source: WorkspaceViewReturnTarget) => void;
  setCollectionShelf: (shelf: CollectionShelf) => void;
  setWorld: (world: World) => void;
}) {
  args.setPendingProjectOpenId(args.projectId);
  args.setPendingProjectOpenSource({
    world: 'chat',
    conversationId: args.conversationId
  });
  revealCollectionShelf({
    setCollectionShelf: args.setCollectionShelf,
    setWorld: args.setWorld
  }, 'project');
}

export function resolvePendingWorkspaceCollectionOpen(args: {
  pendingProjectOpenId: string | null;
  pendingProjectOpenSource: WorkspaceViewReturnTarget;
  hasWorkspace: (projectId: string) => boolean;
}):
  | {
      kind: 'ready';
      projectId: string;
      returnTarget: WorkspaceViewReturnTarget;
    }
  | {
      kind: 'stale';
      projectId: string;
    }
  | null {
  if (!args.pendingProjectOpenId) return null;
  if (!args.hasWorkspace(args.pendingProjectOpenId)) {
    return {
      kind: 'stale',
      projectId: args.pendingProjectOpenId
    };
  }

  return {
    kind: 'ready',
    projectId: args.pendingProjectOpenId,
    returnTarget: args.pendingProjectOpenSource
  };
}

export function closeCollectionWorkspaceView(args: {
  returnTarget: WorkspaceViewReturnTarget;
  setCollectionProjectId: (projectId: string | null) => void;
  setActiveConversation: (conversationId: string) => void;
  setWorld: (world: World) => void;
}) {
  args.setCollectionProjectId(null);

  if (args.returnTarget?.world === 'chat') {
    args.setActiveConversation(args.returnTarget.conversationId);
    args.setWorld('chat');
    return;
  }
}

export function closeCollectionWorkspaceFileView(args: {
  projectId: string;
  returnTarget: WorkspaceViewReturnTarget;
  setCollectionProjectId: (projectId: string | null) => void;
  setActiveConversation: (conversationId: string) => void;
  setWorld: (world: World) => void;
}) {
  if (args.returnTarget?.world === 'chat') {
    closeCollectionWorkspaceView({
      returnTarget: args.returnTarget,
      setCollectionProjectId: args.setCollectionProjectId,
      setActiveConversation: args.setActiveConversation,
      setWorld: args.setWorld
    });
    return;
  }

  args.setCollectionProjectId(args.projectId);
}
