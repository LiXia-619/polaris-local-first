import { describe, expect, it } from 'vitest';
import type { ConversationTaskState } from '../../../../types/domain';
import { buildTimelineTaskReceipts } from './messageTimelineTaskReceipts';
import type { TaskRuntimeExecutionSegment } from './TaskRuntimeCard';

function buildTask(overrides: Partial<ConversationTaskState> = {}): ConversationTaskState {
  return {
    id: 'task-1',
    sourceMessageId: 'user-1',
    goal: '做一个玻璃风切图小作坊',
    title: '玻璃风切图小作坊',
    mode: 'active',
    status: 'running',
    stage: '拆文件',
    steps: [],
    executions: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function buildSegment(id: string): TaskRuntimeExecutionSegment {
  return {
    id,
    messages: [],
    hasPendingWorkspaceProposal: false
  };
}

describe('buildTimelineTaskReceipts', () => {
  it('keeps one completion receipt on the final assistant message', () => {
    const task = buildTask({
      status: 'completed',
      stage: '已完成',
      executions: [
        {
          id: 'execution-1',
          assistantMessageId: 'assistant-1',
          toolCallIds: ['tool-call-1'],
          resultMessageIds: ['tool-message-1'],
          pendingProposalIds: [],
          updatedAt: 10
        },
        {
          id: 'execution-2',
          assistantMessageId: 'assistant-2',
          toolCallIds: ['tool-call-2'],
          resultMessageIds: ['tool-message-2'],
          pendingProposalIds: [],
          updatedAt: 20
        }
      ],
      lastAssistantMessageId: 'assistant-3'
    });

    const receipts = buildTimelineTaskReceipts(task, [
      buildSegment('execution-2'),
      buildSegment('execution-1')
    ]);

    expect([...receipts.keys()]).toEqual(['assistant-3']);
    expect(receipts.get('assistant-3')?.executionSegments.map((segment) => segment.id)).toEqual(['execution-2', 'execution-1']);
  });

  it('uses the latest execution message when a completed task has no last assistant message', () => {
    const task = buildTask({
      status: 'completed',
      stage: '已完成',
      executions: [
        {
          id: 'execution-1',
          assistantMessageId: 'assistant-1',
          toolCallIds: ['tool-call-1'],
          resultMessageIds: ['tool-message-1'],
          pendingProposalIds: [],
          updatedAt: 10
        },
        {
          id: 'execution-2',
          assistantMessageId: 'assistant-2',
          toolCallIds: ['tool-call-2'],
          resultMessageIds: ['tool-message-2'],
          pendingProposalIds: [],
          updatedAt: 20
        }
      ]
    });

    const receipts = buildTimelineTaskReceipts(task, [
      buildSegment('execution-2'),
      buildSegment('execution-1')
    ]);

    expect([...receipts.keys()]).toEqual(['assistant-2']);
  });

  it('does not show receipts while a task is still running', () => {
    const task = buildTask({
      executions: [
        {
          id: 'execution-1',
          assistantMessageId: 'assistant-1',
          toolCallIds: ['tool-call-1'],
          resultMessageIds: ['tool-message-1'],
          pendingProposalIds: [],
          updatedAt: 10
        }
      ],
      lastAssistantMessageId: 'assistant-2'
    });

    expect(buildTimelineTaskReceipts(task, [buildSegment('execution-1')]).size).toBe(0);
  });

  it('returns no receipts when there is no task', () => {
    expect(buildTimelineTaskReceipts(null, []).size).toBe(0);
  });
});
