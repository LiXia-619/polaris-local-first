import {
  reduceConversationTaskEvent,
  type ConversationTaskUpdateInput,
  type ConversationTaskToolOutcomeInput,
  type ConversationTaskWorkspaceStage
} from '../../engines/conversationTask';
import type { ConversationTaskExecution, ConversationTaskState } from '../../types/domain';
import type { ToolActionRunOutcome } from './chatToolOutcome';

function summarizeTaskToolOutcome(outcome: ToolActionRunOutcome): ConversationTaskToolOutcomeInput {
  return {
    path: outcome.path,
    status: outcome.status,
    actionKind: outcome.action.kind,
    proposalId: outcome.path === 'workspace' ? outcome.proposalId : undefined,
    projectPreviewRunnable: outcome.path === 'direct' ? outcome.projectPreviewRunnable : undefined
  };
}

export function settleConversationTaskAfterToolOutcomes(args: {
  currentTask: ConversationTaskState;
  execution?: ConversationTaskExecution | null;
  outcomes: ToolActionRunOutcome[];
  workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
  updatedAt?: number;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'tool_outcomes_settled',
      execution: args.execution,
      outcomes: args.outcomes.map(summarizeTaskToolOutcome),
      workspaceSessionStage: args.workspaceSessionStage ?? null,
      updatedAt: args.updatedAt
    }
  });
}

export function settleConversationTaskAfterStoppedAssistantTurn(args: {
  currentTask: ConversationTaskState;
  workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
  stage?: string;
  summary?: string;
  assistantMessageId?: string;
  updatedAt?: number;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'assistant_turn_stopped',
      workspaceSessionStage: args.workspaceSessionStage ?? null,
      stage: args.stage,
      summary: args.summary,
      assistantMessageId: args.assistantMessageId,
      updatedAt: args.updatedAt
    }
  });
}

export function completeConversationTaskForAppliedToolMessage(args: {
  currentTask: ConversationTaskState;
  resultMessageId: string;
  stage?: string;
  summary?: string;
  updatedAt?: number;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'result_message_confirmed',
      resultMessageId: args.resultMessageId,
      stage: args.stage,
      summary: args.summary,
      updatedAt: args.updatedAt
    }
  });
}

export function recordConversationTaskExecution(args: {
  currentTask: ConversationTaskState;
  execution: ConversationTaskExecution;
  updatedAt?: number;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'tool_execution_recorded',
      execution: args.execution,
      updatedAt: args.updatedAt
    }
  });
}

export function applyConversationTaskModelUpdate(args: {
  currentTask: ConversationTaskState;
  update: ConversationTaskUpdateInput;
  updatedAt?: number;
  assistantMessageId?: string;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'model_update',
      update: args.update,
      assistantMessageId: args.assistantMessageId,
      updatedAt: args.updatedAt
    }
  });
}

export function resolveConversationTaskWorkspaceProposal(args: {
  currentTask: ConversationTaskState;
  proposalId: string;
  decision: 'accepted' | 'rejected';
  updatedAt?: number;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'workspace_proposal_resolved',
      proposalId: args.proposalId,
      decision: args.decision,
      updatedAt: args.updatedAt
    }
  });
}
