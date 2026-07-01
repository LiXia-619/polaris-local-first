import {
  resolveWorkspaceProposalIntent,
  type PendingWorkspaceProposal,
  type WorkspaceProposalIntent
} from './workspaceBinding';

export type ActiveWorkspaceBannerState = {
  projectId: string;
  title: string;
  fileCount: number;
};

export type PendingWorkspaceBannerProposal = PendingWorkspaceProposal & {
  requestedProjectTitle: string;
};

export type WorkspaceBannerState =
  | {
      mode: 'hidden';
    }
  | {
      mode: 'active';
      workspace: ActiveWorkspaceBannerState;
    }
  | {
      mode: 'proposal';
      intent: WorkspaceProposalIntent;
      proposal: PendingWorkspaceBannerProposal;
      currentWorkspace: ActiveWorkspaceBannerState | null;
    };

export function deriveWorkspaceBannerState(args: {
  activeWorkspace: ActiveWorkspaceBannerState | null;
  pendingWorkspaceProposal: PendingWorkspaceBannerProposal | null;
}): WorkspaceBannerState {
  if (args.pendingWorkspaceProposal) {
    return {
      mode: 'proposal',
      intent: resolveWorkspaceProposalIntent({
        proposal: args.pendingWorkspaceProposal,
        currentProjectId: args.activeWorkspace?.projectId ?? null
      }),
      proposal: args.pendingWorkspaceProposal,
      currentWorkspace: args.activeWorkspace
    };
  }

  if (args.activeWorkspace) {
    return {
      mode: 'active',
      workspace: args.activeWorkspace
    };
  }

  return {
    mode: 'hidden'
  };
}
