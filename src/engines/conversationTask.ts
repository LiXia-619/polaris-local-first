import { createUid } from './id';
import type {
  ChatMessage,
  ConversationTaskMode,
  ConversationTaskExecution,
  ConversationTaskState,
  ConversationTaskStatus,
  ConversationTaskStep,
  ConversationTaskStepStatus
} from '../types/domain';

const MAX_TASK_TITLE_LENGTH = 72;
export function resolveConversationTaskMode(task: Pick<ConversationTaskState, 'mode'> | null | undefined): ConversationTaskMode {
  return task?.mode ?? 'active';
}

function normalizeTaskText(value: string | undefined | null) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || '';
}

function buildDefaultTaskTitle(goal: string) {
  const normalizedGoal = normalizeTaskText(goal);
  if (!normalizedGoal) return '处理当前请求';
  if (normalizedGoal.length <= MAX_TASK_TITLE_LENGTH) return normalizedGoal;
  return `${normalizedGoal.slice(0, MAX_TASK_TITLE_LENGTH - 1).trim()}…`;
}

export function isConversationTaskTerminal(status: ConversationTaskStatus) {
  return status === 'completed' || status === 'cancelled';
}

export function createConversationTaskShell(args: {
  sourceMessage: Pick<ChatMessage, 'id' | 'content' | 'timestamp'>;
  createdAt?: number;
  mode?: ConversationTaskMode;
}): ConversationTaskState {
  const createdAt = args.createdAt ?? Date.now();
  const goal = normalizeTaskText(args.sourceMessage.content);
  const mode = args.mode ?? 'seed';

  return {
    id: createUid('task'),
    sourceMessageId: args.sourceMessage.id,
    goal,
    title: buildDefaultTaskTitle(goal),
    mode,
    status: 'running',
    stage: '开始处理',
    steps: [],
    executions: [],
    createdAt,
    updatedAt: createdAt
  };
}

export type ConversationTaskUpdateInput = {
  id?: string;
  title?: string;
  status?: ConversationTaskStatus;
  stage?: string;
  summary?: string;
  focus?: string;
  next?: string;
  steps?: Array<{
    id?: string;
    title?: string;
    status?: ConversationTaskStepStatus;
    detail?: string;
  }>;
};

type ConversationTaskStepUpdateInput = NonNullable<ConversationTaskUpdateInput['steps']>[number];
export type ConversationTaskExecutionInput = {
  id?: string;
  assistantMessageId: string;
  toolCallIds?: string[];
  resultMessageIds?: string[];
  pendingProposalIds?: string[];
};

export type ConversationTaskToolOutcomeInput = {
  path: 'preview' | 'workspace' | 'memory' | 'direct';
  status: 'previewed' | 'pending' | 'handled' | 'executed' | 'failed';
  actionKind?: string;
  proposalId?: string;
  projectPreviewRunnable?: boolean;
};

export type ConversationTaskWorkspaceStage = 'idle' | 'after-read' | 'after-write' | 'awaiting-proposal';

export type ConversationTaskEvent =
  | {
      type: 'model_update';
      update: ConversationTaskUpdateInput;
      assistantMessageId?: string;
      updatedAt?: number;
    }
  | {
      type: 'tool_execution_recorded';
      execution: ConversationTaskExecutionInput;
      updatedAt?: number;
    }
  | {
      type: 'tool_outcomes_settled';
      execution?: ConversationTaskExecutionInput | null;
      outcomes: ConversationTaskToolOutcomeInput[];
      workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
      updatedAt?: number;
    }
  | {
      type: 'workspace_proposal_resolved';
      proposalId: string;
      decision: 'accepted' | 'rejected';
      updatedAt?: number;
    }
  | {
      type: 'result_message_confirmed';
      resultMessageId: string;
      stage?: string;
      summary?: string;
      updatedAt?: number;
    }
  | {
      type: 'assistant_turn_stopped';
      assistantMessageId?: string;
      workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
      stage?: string;
      summary?: string;
      updatedAt?: number;
    };

const TASK_COMPLETING_DIRECT_ACTION_KINDS = new Set<string>([
  'createCodeCard',
  'patchCodeCard',
  'appendCodeCard',
  'editCodeCardText',
  'saveAttachmentToCollection',
  'saveAttachmentAsCodeCard',
  'saveArchiveEntryAsCodeCard',
  'createQrCode',
  'generateImage',
  'sendImageAttachment',
  'writeMemory',
  'writeMemoryDoc'
]);

function normalizeTaskStep(step: ConversationTaskStepUpdateInput, index: number): ConversationTaskStep | null {
  const title = normalizeTaskText(step?.title);
  if (!title) return null;

  const status = step?.status;
  if (
    status !== 'pending'
    && status !== 'in_progress'
    && status !== 'completed'
    && status !== 'blocked'
  ) {
    return null;
  }

  const detail = normalizeTaskText(step?.detail);

  return {
    id: normalizeTaskText(step?.id) || `step-${index + 1}`,
    title,
    status,
    detail: detail || undefined
  };
}

function applyModelTaskUpdate(args: {
  currentTask: ConversationTaskState;
  update: ConversationTaskUpdateInput;
  updatedAt?: number;
  assistantMessageId?: string;
}): ConversationTaskState {
  const updatedAt = args.updatedAt ?? Date.now();
  const nextTitle = normalizeTaskText(args.update.title);
  const nextStage = normalizeTaskText(args.update.stage);
  const nextSummary = normalizeTaskText(args.update.summary);
  const nextFocus = normalizeTaskText(args.update.focus);
  const nextNext = normalizeTaskText(args.update.next);
  const nextSteps = args.update.steps
    ?.map((step, index) => normalizeTaskStep(step, index))
    .filter((step): step is ConversationTaskStep => Boolean(step));

  return {
    ...args.currentTask,
    title: nextTitle || args.currentTask.title,
    mode: 'active',
    status: args.update.status ?? args.currentTask.status,
    stage: nextStage || args.currentTask.stage,
    summary: nextSummary || undefined,
    focus: nextFocus || undefined,
    next: nextNext || undefined,
    steps: nextSteps ?? args.currentTask.steps,
    executions: args.currentTask.executions,
    updatedAt,
    lastAssistantMessageId: args.assistantMessageId ?? args.currentTask.lastAssistantMessageId
  };
}

function normalizeTaskExecutionIds(values: string[] | undefined) {
  if (!values?.length) return [];
  return [...new Set(values.map((value) => normalizeTaskText(value)).filter(Boolean))];
}

function appendTaskExecution(args: {
  currentTask: ConversationTaskState;
  execution: ConversationTaskExecutionInput;
  updatedAt?: number;
}): ConversationTaskState {
  const updatedAt = args.updatedAt ?? Date.now();
  const assistantMessageId = normalizeTaskText(args.execution.assistantMessageId);
  if (!assistantMessageId) {
    return args.currentTask;
  }

  const normalizedExecution: ConversationTaskExecution = {
    id: normalizeTaskText(args.execution.id) || assistantMessageId,
    assistantMessageId,
    toolCallIds: normalizeTaskExecutionIds(args.execution.toolCallIds),
    resultMessageIds: normalizeTaskExecutionIds(args.execution.resultMessageIds),
    pendingProposalIds: normalizeTaskExecutionIds(args.execution.pendingProposalIds),
    updatedAt
  };

  const hasEvidence =
    normalizedExecution.toolCallIds.length > 0
    || normalizedExecution.resultMessageIds.length > 0
    || normalizedExecution.pendingProposalIds.length > 0;
  if (!hasEvidence) {
    return args.currentTask;
  }

  const previousExecutions = args.currentTask.executions.filter(
    (execution) => execution.assistantMessageId !== assistantMessageId
  );

  return {
    ...args.currentTask,
    mode: 'active',
    executions: [...previousExecutions, normalizedExecution],
    updatedAt
  };
}

function resolveTaskPendingProposal(args: {
  currentTask: ConversationTaskState;
  proposalId: string;
  decision: 'accepted' | 'rejected';
  updatedAt?: number;
}): ConversationTaskState {
  const proposalId = normalizeTaskText(args.proposalId);
  if (!proposalId) return args.currentTask;

  let changed = false;
  const executions = args.currentTask.executions.map((execution) => {
    const pendingProposalIds = execution.pendingProposalIds.filter((id) => id !== proposalId);
    if (pendingProposalIds.length === execution.pendingProposalIds.length) return execution;
    changed = true;
    return {
      ...execution,
      pendingProposalIds
    };
  });

  if (!changed) return args.currentTask;

  const updatedAt = args.updatedAt ?? Date.now();
  const waitingForWorkspaceBoundary = args.currentTask.stage === '等你确认工作区边界';
  const waitingNext = args.currentTask.next === '你确认后我会接着继续施工。';

  return {
    ...args.currentTask,
    mode: 'active',
    status: isConversationTaskTerminal(args.currentTask.status) ? args.currentTask.status : 'running',
    stage: waitingForWorkspaceBoundary
      ? args.decision === 'accepted'
        ? '工作区已确认'
        : '已留在当前边界'
      : args.currentTask.stage,
    next: waitingNext
      ? args.decision === 'accepted'
        ? '我会接着继续施工。'
        : undefined
      : args.currentTask.next,
    executions,
    updatedAt
  };
}

function completeTaskForResultMessage(args: {
  currentTask: ConversationTaskState;
  resultMessageId: string;
  stage?: string;
  summary?: string;
  updatedAt?: number;
}): ConversationTaskState {
  const updatedAt = args.updatedAt ?? Date.now();
  const resultMessageId = normalizeTaskText(args.resultMessageId);
  if (!resultMessageId || isConversationTaskTerminal(args.currentTask.status)) {
    return args.currentTask;
  }

  const ownsResultMessage = args.currentTask.executions.some((execution) =>
    execution.resultMessageIds.includes(resultMessageId)
  );
  if (!ownsResultMessage) {
    return args.currentTask;
  }

  const nextStage = normalizeTaskText(args.stage);
  const nextSummary = normalizeTaskText(args.summary);

  return {
    ...args.currentTask,
    mode: 'active',
    status: 'completed',
    stage: nextStage || '已完成',
    summary: nextSummary || args.currentTask.summary,
    focus: undefined,
    next: undefined,
    steps: args.currentTask.steps.map((step) => ({
      ...step,
      status: 'completed'
    })),
    updatedAt
  };
}

function completeTaskAfterAssistantTurn(args: {
  currentTask: ConversationTaskState;
  stage?: string;
  summary?: string;
  assistantMessageId?: string;
  updatedAt?: number;
}): ConversationTaskState {
  const updatedAt = args.updatedAt ?? Date.now();
  if (
    resolveConversationTaskMode(args.currentTask) !== 'active'
    || isConversationTaskTerminal(args.currentTask.status)
    || args.currentTask.status !== 'running'
  ) {
    return args.currentTask;
  }

  const nextStage = normalizeTaskText(args.stage);
  const nextSummary = normalizeTaskText(args.summary);

  return {
    ...args.currentTask,
    mode: 'active',
    status: 'completed',
    stage: nextStage || args.currentTask.stage || '已完成',
    summary: nextSummary || args.currentTask.summary,
    focus: undefined,
    next: undefined,
    steps: args.currentTask.steps.map((step) => ({
      ...step,
      status: step.status === 'pending' || step.status === 'in_progress' ? 'completed' : step.status
    })),
    updatedAt,
    lastAssistantMessageId: args.assistantMessageId ?? args.currentTask.lastAssistantMessageId
  };
}

function hasPendingWorkspaceBoundary(args: {
  execution?: ConversationTaskExecutionInput | null;
  outcomes?: ConversationTaskToolOutcomeInput[];
  workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
}) {
  return (
    args.workspaceSessionStage === 'awaiting-proposal'
    || Boolean(args.execution?.pendingProposalIds?.length)
    || Boolean(args.outcomes?.some((outcome) => outcome.path === 'workspace' && outcome.status === 'pending'))
  );
}

function shouldCompleteTaskAfterDirectOutcomes(args: {
  currentTask: ConversationTaskState;
  outcomes: ConversationTaskToolOutcomeInput[];
}) {
  if (isConversationTaskTerminal(args.currentTask.status)) return false;
  const incompleteSteps = args.currentTask.steps.filter((step) => step.status !== 'completed');
  if (args.currentTask.steps.length > 0 && incompleteSteps.length > 1) return false;

  return args.outcomes.some((outcome) =>
    outcome.path === 'direct'
    && outcome.status === 'executed'
    && (
      (
        typeof outcome.actionKind === 'string'
        && TASK_COMPLETING_DIRECT_ACTION_KINDS.has(outcome.actionKind)
      )
      || (
        (outcome.actionKind === 'checkProjectPreview' || outcome.actionKind === 'inspectProjectRuntime')
        && outcome.projectPreviewRunnable === true
      )
    )
  );
}

function waitForWorkspaceBoundaryConfirmation(args: {
  currentTask: ConversationTaskState;
  updatedAt?: number;
}) {
  if (
    resolveConversationTaskMode(args.currentTask) !== 'active'
    || isConversationTaskTerminal(args.currentTask.status)
  ) {
    return args.currentTask;
  }

  return {
    ...args.currentTask,
    mode: 'active',
    status: 'running',
    stage: '等你确认工作区边界',
    focus: undefined,
    next: '你确认后我会接着继续施工。',
    updatedAt: args.updatedAt ?? Date.now()
  } satisfies ConversationTaskState;
}

function settleTaskAfterToolOutcomes(args: {
  currentTask: ConversationTaskState;
  execution?: ConversationTaskExecutionInput | null;
  outcomes: ConversationTaskToolOutcomeInput[];
  workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
  updatedAt?: number;
}) {
  if (hasPendingWorkspaceBoundary(args)) {
    return waitForWorkspaceBoundaryConfirmation({
      currentTask: args.currentTask,
      updatedAt: args.updatedAt
    });
  }

  const resultMessageId = args.execution?.resultMessageIds?.[0];
  if (!resultMessageId || !shouldCompleteTaskAfterDirectOutcomes(args)) {
    return args.currentTask;
  }

  return completeTaskForResultMessage({
    currentTask: args.currentTask,
    resultMessageId,
    updatedAt: args.updatedAt
  });
}

function settleTaskAfterStoppedAssistantTurn(args: {
  currentTask: ConversationTaskState;
  workspaceSessionStage?: ConversationTaskWorkspaceStage | null;
  stage?: string;
  summary?: string;
  assistantMessageId?: string;
  updatedAt?: number;
}) {
  if (hasPendingWorkspaceBoundary({ workspaceSessionStage: args.workspaceSessionStage })) {
    return waitForWorkspaceBoundaryConfirmation({
      currentTask: args.currentTask,
      updatedAt: args.updatedAt
    });
  }

  return completeTaskAfterAssistantTurn({
    currentTask: args.currentTask,
    stage: args.stage,
    summary: args.summary,
    assistantMessageId: args.assistantMessageId,
    updatedAt: args.updatedAt
  });
}

export function reduceConversationTaskEvent(args: {
  currentTask: ConversationTaskState;
  event: ConversationTaskEvent;
}): ConversationTaskState {
  switch (args.event.type) {
    case 'model_update':
      return applyModelTaskUpdate({
        currentTask: args.currentTask,
        update: args.event.update,
        assistantMessageId: args.event.assistantMessageId,
        updatedAt: args.event.updatedAt
      });
    case 'tool_execution_recorded':
      return appendTaskExecution({
        currentTask: args.currentTask,
        execution: args.event.execution,
        updatedAt: args.event.updatedAt
      });
    case 'tool_outcomes_settled':
      return settleTaskAfterToolOutcomes({
        currentTask: args.currentTask,
        execution: args.event.execution,
        outcomes: args.event.outcomes,
        workspaceSessionStage: args.event.workspaceSessionStage,
        updatedAt: args.event.updatedAt
      });
    case 'workspace_proposal_resolved':
      return resolveTaskPendingProposal({
        currentTask: args.currentTask,
        proposalId: args.event.proposalId,
        decision: args.event.decision,
        updatedAt: args.event.updatedAt
      });
    case 'result_message_confirmed':
      return completeTaskForResultMessage({
        currentTask: args.currentTask,
        resultMessageId: args.event.resultMessageId,
        stage: args.event.stage,
        summary: args.event.summary,
        updatedAt: args.event.updatedAt
      });
    case 'assistant_turn_stopped':
      return settleTaskAfterStoppedAssistantTurn({
        currentTask: args.currentTask,
        workspaceSessionStage: args.event.workspaceSessionStage,
        stage: args.event.stage,
        summary: args.event.summary,
        assistantMessageId: args.event.assistantMessageId,
        updatedAt: args.event.updatedAt
      });
  }
}

export function buildConversationTaskModelSnapshot(task: ConversationTaskState) {
  return {
    id: task.id,
    sourceMessageId: task.sourceMessageId,
    goal: task.goal,
    title: task.title,
    mode: resolveConversationTaskMode(task),
    status: task.status,
    stage: task.stage,
    summary: task.summary,
    focus: task.focus,
    next: task.next,
    steps: task.steps,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    lastAssistantMessageId: task.lastAssistantMessageId
  };
}
