import { describe, expect, it } from 'vitest';
import { deriveWorkspaceBannerState } from './workspaceBannerState';

describe('deriveWorkspaceBannerState', () => {
  it('stays hidden when there is neither workspace scope nor proposal', () => {
    expect(deriveWorkspaceBannerState({
      activeWorkspace: null,
      pendingWorkspaceProposal: null
    })).toEqual({ mode: 'hidden' });
  });

  it('shows the active workspace when no proposal is waiting', () => {
    expect(deriveWorkspaceBannerState({
      activeWorkspace: {
        projectId: 'workspace-mini-phone',
        title: 'Mini Phone',
        fileCount: 3
      },
      pendingWorkspaceProposal: null
    })).toEqual({
      mode: 'active',
      workspace: {
        projectId: 'workspace-mini-phone',
        title: 'Mini Phone',
        fileCount: 3
      }
    });
  });

  it('treats a pending new-workspace proposal without current scope as a create decision', () => {
    expect(deriveWorkspaceBannerState({
      activeWorkspace: null,
      pendingWorkspaceProposal: {
        id: 'proposal-1',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Mini Phone',
        requestedActionKinds: ['createRoomProject'],
        requestedFilePaths: ['index.html'],
        draftProjectId: 'workspace-mini-phone',
        status: 'pending',
        createdAt: 1
      }
    })).toEqual({
      mode: 'proposal',
      intent: 'create',
      proposal: {
        id: 'proposal-1',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Mini Phone',
        requestedActionKinds: ['createRoomProject'],
        requestedFilePaths: ['index.html'],
        draftProjectId: 'workspace-mini-phone',
        status: 'pending',
        createdAt: 1
      },
      currentWorkspace: null
    });
  });

  it('treats a pending existing-workspace proposal without current scope as an enter decision', () => {
    expect(deriveWorkspaceBannerState({
      activeWorkspace: null,
      pendingWorkspaceProposal: {
        id: 'proposal-enter',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Mini Phone',
        requestedActionKinds: ['createProjectFile'],
        requestedFilePaths: ['script.js'],
        draftProjectId: 'workspace-mini-phone',
        status: 'pending',
        createdAt: 3
      }
    })).toEqual({
      mode: 'proposal',
      intent: 'enter',
      proposal: {
        id: 'proposal-enter',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Mini Phone',
        requestedActionKinds: ['createProjectFile'],
        requestedFilePaths: ['script.js'],
        draftProjectId: 'workspace-mini-phone',
        status: 'pending',
        createdAt: 3
      },
      currentWorkspace: null
    });
  });

  it('treats a pending proposal over an active workspace as a switch decision', () => {
    expect(deriveWorkspaceBannerState({
      activeWorkspace: {
        projectId: 'workspace-mini-phone',
        title: 'Mini Phone',
        fileCount: 3
      },
      pendingWorkspaceProposal: {
        id: 'proposal-2',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Docs Refresh',
        requestedActionKinds: ['createRoomProject'],
        requestedFilePaths: ['docs/index.md'],
        draftProjectId: 'workspace-docs',
        status: 'pending',
        createdAt: 2
      }
    })).toEqual({
      mode: 'proposal',
      intent: 'switch',
      proposal: {
        id: 'proposal-2',
        conversationId: 'conversation-1',
        source: 'model-proposed',
        requestedProjectTitle: 'Docs Refresh',
        requestedActionKinds: ['createRoomProject'],
        requestedFilePaths: ['docs/index.md'],
        draftProjectId: 'workspace-docs',
        status: 'pending',
        createdAt: 2
      },
      currentWorkspace: {
        projectId: 'workspace-mini-phone',
        title: 'Mini Phone',
        fileCount: 3
      }
    });
  });
});
