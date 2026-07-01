import type { PendingWorkspaceProposal } from '../workspaceBinding';
import { createUid } from '../id';
import {
  resolveWorkspaceProposalIntent,
  resolveWorkspaceProposalLabel
} from '../workspaceBinding';

export type RuntimeFeedbackEvent =
  {
      id: string;
      kind: 'workspace_proposal_resolved';
      createdAt: number;
      proposalId: string;
      decision: 'accepted' | 'rejected';
      summary: string;
    }
  | {
      id: string;
      kind: 'workspace_scope_changed';
      createdAt: number;
      conversationId: string;
      change: 'entered' | 'exited' | 'switched';
      previousProjectId: string | null;
      nextProjectId: string | null;
      summary: string;
    }
  | {
      id: string;
      kind: 'assistant_tool_preparation_failed';
      createdAt: number;
      status: 'parse_failed' | 'resolution_failed' | 'missing_actions';
      summary: string;
      truncated?: boolean;
      reasons?: string[];
      declaredActionKinds?: string[];
      resolvedActionKinds?: string[];
    };

export function createResolvedWorkspaceProposalFeedbackEvent(args: {
  proposal: PendingWorkspaceProposal;
  decision: 'accepted' | 'rejected';
  createdAt?: number;
  currentWorkspaceLabel?: string | null;
  resolvedWorkspaceLabel?: string | null;
}): RuntimeFeedbackEvent {
  const createdAt = args.createdAt ?? Date.now();
  const currentWorkspaceLabel = args.currentWorkspaceLabel?.trim() || null;
  const resolvedWorkspaceLabel = args.resolvedWorkspaceLabel?.trim() || null;
  const proposalLabel = resolveWorkspaceProposalLabel(args.proposal);
  const intent = resolveWorkspaceProposalIntent({
    proposal: args.proposal,
    currentProjectId: currentWorkspaceLabel
  });

  const summary = args.decision === 'accepted'
    ? (
        currentWorkspaceLabel && resolvedWorkspaceLabel && currentWorkspaceLabel !== resolvedWorkspaceLabel
          ? `已同意从 ${currentWorkspaceLabel} 切到工作区 ${resolvedWorkspaceLabel}，相关工作区动作将继续执行。`
          : intent === 'create'
            ? `已同意新建工作区 ${resolvedWorkspaceLabel ?? proposalLabel}，相关工作区动作将继续执行。`
            : `已同意进入工作区 ${resolvedWorkspaceLabel ?? proposalLabel}，相关工作区动作将继续执行。`
      )
    : (
        currentWorkspaceLabel
          ? `已留在当前工作区 ${currentWorkspaceLabel}，没有切到 ${proposalLabel}。`
          : intent === 'create'
            ? `已留在散聊模式，没有新建 ${proposalLabel}。`
            : `已留在散聊模式，没有进入 ${proposalLabel}。`
      );

  return {
    id: createUid('rtf'),
    kind: 'workspace_proposal_resolved',
    createdAt,
    proposalId: args.proposal.id,
    decision: args.decision,
    summary
  };
}

export function createWorkspaceScopeChangedFeedbackEvent(args: {
  conversationId: string;
  previousProjectId: string | null;
  nextProjectId: string | null;
  change: 'entered' | 'exited' | 'switched';
  createdAt?: number;
}): RuntimeFeedbackEvent {
  const createdAt = args.createdAt ?? Date.now();
  const summary = args.change === 'entered'
    ? `当前对话已进入工作区 ${args.nextProjectId ?? '未命名工作区'}。`
    : args.change === 'exited'
      ? `当前对话已离开工作区 ${args.previousProjectId ?? '未命名工作区'}。`
      : `当前对话已从工作区 ${args.previousProjectId ?? '未命名工作区'} 切到 ${args.nextProjectId ?? '未命名工作区'}。`;

  return {
    id: createUid('rtf'),
    kind: 'workspace_scope_changed',
    createdAt,
    conversationId: args.conversationId,
    change: args.change,
    previousProjectId: args.previousProjectId,
    nextProjectId: args.nextProjectId,
    summary
  };
}
