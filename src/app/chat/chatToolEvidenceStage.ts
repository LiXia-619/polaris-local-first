import {
  isConversationTaskTerminal,
  resolveConversationTaskMode,
  type ConversationTaskUpdateInput
} from '../../engines/conversationTask';
import { buildConversationTaskExecution } from '../../engines/conversationTaskExecution';
import type { ToolAction } from '../../engines/toolExecutor';
import type { ConversationTaskState } from '../../types/domain';
import type { ChatReplyStoreBindings } from './chatPorts';
import {
  applyConversationTaskModelUpdate,
  recordConversationTaskExecution,
  settleConversationTaskAfterToolOutcomes
} from './chatTaskSettlement';
import type { ToolActionRunOutcome } from './chatToolOutcome';
import type { AssistantToolEnforcementScope } from '../../engines/tool-protocol/assistantToolProtocolTypes';

type StartTaskToolAction = Extract<ToolAction, { kind: 'startTask' }>;
type CompleteTaskToolAction = Extract<ToolAction, { kind: 'completeTask' }>;

export type TaskActivationEnforcement = {
  mode: 'force';
  scope?: AssistantToolEnforcementScope;
};

type ToolEvidenceChatPort = Pick<
  ChatReplyStoreBindings['chat'],
  'findConversation' | 'getConversationTask' | 'setConversationTask'
>;

function findStartTaskToolAction(actions: ToolAction[]): StartTaskToolAction | null {
  return actions.find((action): action is StartTaskToolAction => action.kind === 'startTask') ?? null;
}

function findCompleteTaskToolAction(actions: ToolAction[]): CompleteTaskToolAction | null {
  return actions.find((action): action is CompleteTaskToolAction => action.kind === 'completeTask') ?? null;
}

export function resolveTaskActivationEnforcement(action: StartTaskToolAction): TaskActivationEnforcement | null {
  if (action.capability === 'theme') {
    return {
      mode: 'force',
      scope: 'theme-only'
    };
  }

  return null;
}

function buildTaskUpdateFromStartTaskAction(action: StartTaskToolAction): ConversationTaskUpdateInput {
  const defaultStageByCapability: Record<NonNullable<StartTaskToolAction['capability']>, string> = {
    theme: '准备换肤',
    room: '准备处理房间卡',
    workspace: '准备处理工作区',
    desktop: '准备处理本机工作循环',
    app: '准备处理应用内工作循环',
    code: '准备运行代码',
    mcp: '准备调用 MCP',
    general: '开始执行'
  };
  const stage = action.stage || (action.capability ? defaultStageByCapability[action.capability] : '开始执行');
  const steps = action.steps
    ?.map((title, index) => title.trim() ? {
      id: `step-${index + 1}`,
      title: title.trim(),
      status: index === 0 ? 'in_progress' as const : 'pending' as const
    } : null)
    .filter((step): step is NonNullable<typeof step> => Boolean(step));

  return {
    title: action.title,
    status: 'running',
    stage,
    focus: stage,
    next: steps?.[0]?.title,
    steps: steps?.length ? steps : undefined
  };
}

function buildTaskUpdateFromCompleteTaskAction(
  action: CompleteTaskToolAction,
  currentTask: ConversationTaskState
): ConversationTaskUpdateInput {
  return {
    title: currentTask.title,
    status: 'completed',
    stage: action.stage || '已完成',
    summary: action.summary || currentTask.summary,
    steps: currentTask.steps.map((step) => ({
      ...step,
      status: 'completed' as const
    }))
  };
}

export function commitAssistantToolEvidenceStage(args: {
  chat: ToolEvidenceChatPort;
  conversationId: string;
  assistantMessageId: string;
  actions: ToolAction[];
  outcomes: ToolActionRunOutcome[];
  activatedTaskThisTurn: boolean;
}) {
  let activatedTaskThisTurn = args.activatedTaskThisTurn;
  let latestTaskState: ConversationTaskState | null = null;
  let nextTaskActivationEnforcement: TaskActivationEnforcement | null = null;

  const startTaskAction = findStartTaskToolAction(args.actions);
  if (startTaskAction) {
    nextTaskActivationEnforcement = resolveTaskActivationEnforcement(startTaskAction);
    const taskBeforeStart = args.chat.getConversationTask(args.conversationId);
    if (taskBeforeStart && !isConversationTaskTerminal(taskBeforeStart.status)) {
      const taskAfterStart = applyConversationTaskModelUpdate({
        currentTask: taskBeforeStart,
        update: {
          ...buildTaskUpdateFromStartTaskAction(startTaskAction),
          id: taskBeforeStart.id
        },
        updatedAt: Date.now(),
        assistantMessageId: args.assistantMessageId
      });
      activatedTaskThisTurn =
        activatedTaskThisTurn
        || (
          resolveConversationTaskMode(taskBeforeStart) === 'seed'
          && resolveConversationTaskMode(taskAfterStart) === 'active'
        );
      latestTaskState = taskAfterStart;
      args.chat.setConversationTask(args.conversationId, taskAfterStart);
    }
  }

  const latestTask = args.chat.getConversationTask(args.conversationId);
  const taskExecution = latestTask
    ? buildConversationTaskExecution({
        assistantMessageId: args.assistantMessageId,
        toolLedger: args.chat.findConversation(args.conversationId)?.toolLedger,
        outcomes: args.outcomes,
        updatedAt: Date.now()
      })
    : null;
  if (latestTask && taskExecution) {
    args.chat.setConversationTask(
      args.conversationId,
      recordConversationTaskExecution({
        currentTask: latestTask,
        execution: taskExecution,
        updatedAt: taskExecution.updatedAt
      })
    );
  }

  const completeTaskAction = findCompleteTaskToolAction(args.actions);
  if (completeTaskAction) {
    const taskBeforeComplete = args.chat.getConversationTask(args.conversationId);
    if (taskBeforeComplete && !isConversationTaskTerminal(taskBeforeComplete.status)) {
      args.chat.setConversationTask(
        args.conversationId,
        applyConversationTaskModelUpdate({
          currentTask: taskBeforeComplete,
          update: {
            ...buildTaskUpdateFromCompleteTaskAction(completeTaskAction, taskBeforeComplete),
            id: taskBeforeComplete.id
          },
          updatedAt: Date.now(),
          assistantMessageId: args.assistantMessageId
        })
      );
    }
  }

  if (taskExecution) {
    const latestTaskAfterTools = args.chat.getConversationTask(args.conversationId);
    if (latestTaskAfterTools) {
      args.chat.setConversationTask(
        args.conversationId,
        settleConversationTaskAfterToolOutcomes({
          currentTask: latestTaskAfterTools,
          execution: taskExecution,
          outcomes: args.outcomes,
          updatedAt: Date.now()
        })
      );
    }
  }

  return {
    activatedTaskThisTurn,
    latestTaskState,
    nextTaskActivationEnforcement,
    taskExecution
  };
}

export function commitRecoveredToolEvidenceStage(args: {
  chat: ToolEvidenceChatPort;
  conversationId: string;
  assistantMessageId: string;
  outcomes: ToolActionRunOutcome[];
}) {
  const latestTask = args.chat.getConversationTask(args.conversationId);
  const taskExecution = latestTask
    ? buildConversationTaskExecution({
        assistantMessageId: args.assistantMessageId,
        toolLedger: args.chat.findConversation(args.conversationId)?.toolLedger,
        outcomes: args.outcomes,
        updatedAt: Date.now()
      })
    : null;

  if (!latestTask || !taskExecution) {
    return {
      taskExecution
    };
  }

  const taskWithExecution = recordConversationTaskExecution({
    currentTask: latestTask,
    execution: taskExecution,
    updatedAt: taskExecution.updatedAt
  });
  args.chat.setConversationTask(
    args.conversationId,
    settleConversationTaskAfterToolOutcomes({
      currentTask: taskWithExecution,
      execution: taskExecution,
      outcomes: args.outcomes,
      updatedAt: Date.now()
    })
  );

  return {
    taskExecution
  };
}
