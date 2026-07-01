import type { ConversationTaskState } from '../../../../types/domain';
import type { TaskRuntimeExecutionSegment } from './TaskRuntimeCard';

export type TimelineTaskReceipt = {
  task: ConversationTaskState;
  executionSegments: TaskRuntimeExecutionSegment[];
};

export function buildTimelineTaskReceipts(
  task: ConversationTaskState | null,
  executionSegments: TaskRuntimeExecutionSegment[]
) {
  const receiptsByMessageId = new Map<string, TimelineTaskReceipt>();
  if (!task) return receiptsByMessageId;
  if (task.status !== 'completed') return receiptsByMessageId;

  const executions = [...task.executions].sort((left, right) => left.updatedAt - right.updatedAt);
  const latestExecution = executions[executions.length - 1];
  const completionMessageId = task.lastAssistantMessageId || latestExecution?.assistantMessageId;
  if (completionMessageId) {
    receiptsByMessageId.set(completionMessageId, {
      task,
      executionSegments
    });
  }

  return receiptsByMessageId;
}
