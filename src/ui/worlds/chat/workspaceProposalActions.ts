import type { ToolActions } from '../../../app/chat/chatToolActions';
import {
  isConversationTaskTerminal,
  resolveConversationTaskMode
} from '../../../engines/conversationTask';
import { resolveConversationTaskWorkspaceProposal } from '../../../app/chat/chatTaskSettlement';
import {
  createResolvedWorkspaceProposalFeedbackEvent,
  type RuntimeFeedbackEvent
} from '../../../engines/runtime-feedback/runtimeFeedbackEvents';
import { enterConversationWorkspaceScope } from '../../../app/shell/workspaceNavigation';
import type { PendingWorkspaceProposalRecord } from '../../../engines/workspaceBinding';
import { resolveWorkspaceProposalIntent, resolveWorkspaceProposalLabel } from '../../../engines/workspaceBinding';
import type { ToolAction } from '../../../engines/toolExecutor';
import type { I18nTranslator } from '../../../i18n';
import type { ConversationTaskState } from '../../../types/domain';

type WorkspaceReference = {
  id: string;
  title: string;
};

type ConversationReference = {
  id: string;
  activeProjectId?: string | null;
};

type Translate = I18nTranslator['t'];

function localizeCommandStatus(
  t: Translate | undefined,
  key: Parameters<Translate>[0],
  fallback: string,
  values?: Parameters<Translate>[1]
) {
  return t ? t(key, values) : fallback;
}

function resolveWorkspaceTitle(projectId: string, workspaces: WorkspaceReference[]) {
  return workspaces.find((workspace) => workspace.id === projectId)?.title ?? projectId;
}

function includesCreateRoomProject(actions: ToolAction[]) {
  return actions.some((action) => action.kind === 'createRoomProject');
}

function shouldPrebindDraftWorkspace(proposal: PendingWorkspaceProposalRecord) {
  return Boolean(proposal.draftProjectId) && !includesCreateRoomProject(proposal.requestedActions);
}

export async function acceptPendingWorkspaceProposal(args: {
  activeConversation: ConversationReference;
  proposal: PendingWorkspaceProposalRecord;
  workspaces: WorkspaceReference[];
  setConversationActiveProject: (conversationId: string, projectId: string | null) => void;
  removePendingWorkspaceProposal: (proposalId: string) => void;
  submitAssistantToolActions: ToolActions['submitAssistantToolActions'];
  findConversation: (conversationId: string) => ConversationReference | null;
  appendRuntimeFeedbackEvent: (conversationId: string, event: RuntimeFeedbackEvent) => void;
  getConversationTask?: (conversationId: string) => ConversationTaskState | null | undefined;
  setConversationTask?: (conversationId: string, task: ConversationTaskState | null) => void;
  continueAfterAccept?: (conversationId: string) => Promise<void>;
  setCommandStatus: (text: string, isError?: boolean) => void;
  t?: Translate;
}) {
  const proposalLabel = resolveWorkspaceProposalLabel(args.proposal);
  const currentWorkspaceLabel = args.activeConversation.activeProjectId
    ? resolveWorkspaceTitle(args.activeConversation.activeProjectId, args.workspaces)
    : null;
  const proposalIntent = resolveWorkspaceProposalIntent({
    proposal: args.proposal,
    currentProjectId: args.activeConversation.activeProjectId
  });

  if (shouldPrebindDraftWorkspace(args.proposal) && args.proposal.draftProjectId) {
    enterConversationWorkspaceScope({
      conversationId: args.activeConversation.id,
      projectId: args.proposal.draftProjectId,
      setConversationActiveProject: args.setConversationActiveProject
    });
  }

  args.removePendingWorkspaceProposal(args.proposal.id);
  const currentTask = args.getConversationTask?.(args.activeConversation.id) ?? null;
  if (currentTask) {
    args.setConversationTask?.(
      args.activeConversation.id,
      resolveConversationTaskWorkspaceProposal({
        currentTask,
        proposalId: args.proposal.id,
        decision: 'accepted'
      })
    );
  }
  args.setCommandStatus(
    currentWorkspaceLabel
      ? localizeCommandStatus(args.t, 'chat.workspaceProposal.switching', `正在切到 ${proposalLabel}…`, { workspace: proposalLabel })
      : proposalIntent === 'create'
        ? localizeCommandStatus(args.t, 'chat.workspaceProposal.creating', `正在创建 ${proposalLabel}…`, { workspace: proposalLabel })
        : localizeCommandStatus(args.t, 'chat.workspaceProposal.entering', `正在进入 ${proposalLabel}…`, { workspace: proposalLabel })
  );
  const outcomes = await args.submitAssistantToolActions(args.activeConversation.id, args.proposal.requestedActions, {
    workspaceExecutionMode: 'execute-approved'
  });

  let resolvedProjectId = args.findConversation(args.activeConversation.id)?.activeProjectId ?? null;
  const shouldBindCreatedWorkspaceAfterExecution = !shouldPrebindDraftWorkspace(args.proposal)
    && Boolean(args.proposal.draftProjectId)
    && includesCreateRoomProject(args.proposal.requestedActions)
    && outcomes.some((outcome) => outcome.path === 'direct' && outcome.status === 'executed' && outcome.action.kind === 'createRoomProject');

  if (!resolvedProjectId && shouldBindCreatedWorkspaceAfterExecution && args.proposal.draftProjectId) {
    enterConversationWorkspaceScope({
      conversationId: args.activeConversation.id,
      projectId: args.proposal.draftProjectId,
      setConversationActiveProject: args.setConversationActiveProject
    });
    resolvedProjectId = args.proposal.draftProjectId;
  }

  args.appendRuntimeFeedbackEvent(
    args.activeConversation.id,
    createResolvedWorkspaceProposalFeedbackEvent({
      proposal: args.proposal,
      decision: 'accepted',
      currentWorkspaceLabel,
      resolvedWorkspaceLabel: resolvedProjectId
        ? resolveWorkspaceTitle(resolvedProjectId, args.workspaces)
        : proposalLabel
    })
  );

  if (!resolvedProjectId) return;

  args.setCommandStatus(
    localizeCommandStatus(
      args.t,
      'chat.workspaceProposal.continuing',
      `继续在 ${resolveWorkspaceTitle(resolvedProjectId, args.workspaces)} 里处理…`,
      { workspace: resolveWorkspaceTitle(resolvedProjectId, args.workspaces) }
    )
  );

  const taskAfterResolution = args.getConversationTask?.(args.activeConversation.id) ?? null;
  if (
    taskAfterResolution
    && resolveConversationTaskMode(taskAfterResolution) === 'active'
    && !isConversationTaskTerminal(taskAfterResolution.status)
  ) {
    await args.continueAfterAccept?.(args.activeConversation.id);
  }
}

export function rejectPendingWorkspaceProposal(args: {
  activeConversation: ConversationReference;
  proposal: PendingWorkspaceProposalRecord;
  workspaces: WorkspaceReference[];
  removePendingWorkspaceProposal: (proposalId: string) => void;
  appendRuntimeFeedbackEvent: (conversationId: string, event: RuntimeFeedbackEvent) => void;
  getConversationTask?: (conversationId: string) => ConversationTaskState | null | undefined;
  setConversationTask?: (conversationId: string, task: ConversationTaskState | null) => void;
  setCommandStatus: (text: string, isError?: boolean) => void;
  t?: Translate;
}) {
  const currentProjectId = args.activeConversation.activeProjectId ?? null;
  const currentWorkspaceLabel = currentProjectId
    ? resolveWorkspaceTitle(currentProjectId, args.workspaces)
    : null;

  args.removePendingWorkspaceProposal(args.proposal.id);
  const currentTask = args.getConversationTask?.(args.activeConversation.id) ?? null;
  if (currentTask) {
    args.setConversationTask?.(
      args.activeConversation.id,
      resolveConversationTaskWorkspaceProposal({
        currentTask,
        proposalId: args.proposal.id,
        decision: 'rejected'
      })
    );
  }
  args.appendRuntimeFeedbackEvent(
    args.activeConversation.id,
    createResolvedWorkspaceProposalFeedbackEvent({
      proposal: args.proposal,
      decision: 'rejected',
      currentWorkspaceLabel
    })
  );
  args.setCommandStatus(currentWorkspaceLabel
    ? localizeCommandStatus(args.t, 'chat.workspaceProposal.stayingInWorkspace', `继续留在 ${currentWorkspaceLabel}。`, { workspace: currentWorkspaceLabel })
    : localizeCommandStatus(args.t, 'chat.workspaceProposal.stayingInChat', '先留在当前对话。'));
}
