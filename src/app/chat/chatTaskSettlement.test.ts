import { describe, expect, it } from 'vitest';
import { createConversationTaskShell, reduceConversationTaskEvent } from '../../engines/conversationTask';
import type { ToolAction } from '../../engines/toolExecutorTypes';
import type { ConversationTaskState, ToolInvocation } from '../../types/domain';
import type { ToolActionRunOutcome } from './chatToolOutcome';
import {
  settleConversationTaskAfterStoppedAssistantTurn,
  settleConversationTaskAfterToolOutcomes
} from './chatTaskSettlement';

function createActiveTask(steps: ConversationTaskState['steps']) {
  return reduceConversationTaskEvent({
    currentTask: createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '把这件事做完',
        timestamp: 1
      },
      createdAt: 10
    }),
    event: {
      type: 'model_update',
      update: {
        title: '处理当前请求',
        status: 'running',
        stage: '正在处理',
        steps
      },
      assistantMessageId: 'assistant-1',
      updatedAt: 20
    },
  });
}

function createToolInvocation(action: ToolAction): ToolInvocation {
  return {
    id: 'tool-1',
    kind: action.kind,
    status: 'executed',
    title: '已执行',
    summary: '完成',
    originMessageId: 'assistant-2',
    toolCallId: 'call-1'
  };
}

describe('settleConversationTaskAfterToolOutcomes', () => {
  it('completes a single-step task after a direct deliverable lands', () => {
    const action: ToolAction = {
      kind: 'createCodeCard',
      card: {
        title: '温柔的提醒',
        language: 'markdown',
        code: '今天先照顾自己。'
      }
    };
    const task = reduceConversationTaskEvent({
      currentTask: createActiveTask([
        { id: 'step-1', title: '写入卡片内容', status: 'in_progress' }
      ]),
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-2',
          toolCallIds: ['call-1'],
          resultMessageIds: ['tool-1']
        },
        updatedAt: 30
      }
    });

    expect(settleConversationTaskAfterToolOutcomes({
      currentTask: task,
      execution: task.executions[0],
      outcomes: [{
        path: 'direct',
        status: 'executed',
        action,
        toolInvocation: createToolInvocation(action)
      }],
      updatedAt: 40
    })).toMatchObject({
      status: 'completed',
      stage: '已完成',
      steps: [
        { id: 'step-1', title: '写入卡片内容', status: 'completed' }
      ]
    });
  });

  it('keeps a multi-step task open after only one direct deliverable lands', () => {
    const action: ToolAction = {
      kind: 'createCodeCard',
      card: {
        title: '草稿卡',
        language: 'markdown',
        code: '第一张。'
      }
    };
    const task = reduceConversationTaskEvent({
      currentTask: createActiveTask([
        { id: 'step-1', title: '创建第一张卡', status: 'in_progress' },
        { id: 'step-2', title: '整理第二张卡', status: 'pending' }
      ]),
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-2',
          toolCallIds: ['call-1'],
          resultMessageIds: ['tool-1']
        },
        updatedAt: 30
      }
    });

    expect(settleConversationTaskAfterToolOutcomes({
      currentTask: task,
      execution: task.executions[0],
      outcomes: [{
        path: 'direct',
        status: 'executed',
        action,
        toolInvocation: createToolInvocation(action)
      }],
      updatedAt: 40
    })).toEqual(task);
  });

  it('completes a task after a runnable workspace preview check lands', () => {
    const action: ToolAction = {
      kind: 'checkProjectPreview',
      projectId: 'mini-phone'
    };
    const task = reduceConversationTaskEvent({
      currentTask: createActiveTask([
        { id: 'step-1', title: '检查工作区预览', status: 'in_progress' }
      ]),
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-2',
          toolCallIds: ['call-1'],
          resultMessageIds: ['tool-1']
        },
        updatedAt: 30
      }
    });

    expect(settleConversationTaskAfterToolOutcomes({
      currentTask: task,
      execution: task.executions[0],
      outcomes: [{
        path: 'direct',
        status: 'executed',
        action,
        toolInvocation: {
          ...createToolInvocation(action),
          projectPreviewRunnable: true
        },
        projectPreviewRunnable: true
      }],
      updatedAt: 40
    })).toMatchObject({
      status: 'completed',
      stage: '已完成',
      steps: [
        { id: 'step-1', title: '检查工作区预览', status: 'completed' }
      ]
    });
  });

  it('keeps a task open after a workspace preview check finds no runnable entry', () => {
    const action: ToolAction = {
      kind: 'checkProjectPreview',
      projectId: 'mini-phone'
    };
    const task = reduceConversationTaskEvent({
      currentTask: createActiveTask([
        { id: 'step-1', title: '检查工作区预览', status: 'in_progress' }
      ]),
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-2',
          toolCallIds: ['call-1'],
          resultMessageIds: ['tool-1']
        },
        updatedAt: 30
      }
    });

    expect(settleConversationTaskAfterToolOutcomes({
      currentTask: task,
      execution: task.executions[0],
      outcomes: [{
        path: 'direct',
        status: 'executed',
        action,
        toolInvocation: {
          ...createToolInvocation(action),
          projectPreviewRunnable: false
        },
        projectPreviewRunnable: false
      }],
      updatedAt: 40
    })).toEqual(task);
  });

  it('waits for workspace confirmation instead of marking the task blocked', () => {
    const task = reduceConversationTaskEvent({
      currentTask: createActiveTask([
        { id: 'step-1', title: '创建工作区文件', status: 'in_progress' }
      ]),
      event: {
        type: 'tool_execution_recorded',
        execution: {
          assistantMessageId: 'assistant-2',
          pendingProposalIds: ['proposal-1']
        },
        updatedAt: 30
      }
    });

    expect(settleConversationTaskAfterToolOutcomes({
      currentTask: task,
      execution: task.executions[0],
      outcomes: [{
        path: 'workspace',
        status: 'pending',
        action: {
          kind: 'createRoomProject',
          project: {
            projectId: 'mini-phone',
            title: 'Mini Phone'
          }
        },
        proposalId: 'proposal-1'
      }],
      workspaceSessionStage: 'awaiting-proposal',
      updatedAt: 40
    })).toMatchObject({
      status: 'running',
      stage: '等你确认工作区边界',
      next: '你确认后我会接着继续施工。'
    });
  });
});

describe('settleConversationTaskAfterStoppedAssistantTurn', () => {
  it('does not convert an awaiting workspace proposal into a stuck task', () => {
    const task = createActiveTask([
      { id: 'step-1', title: '进入工作区', status: 'in_progress' }
    ]);

    expect(settleConversationTaskAfterStoppedAssistantTurn({
      currentTask: task,
      workspaceSessionStage: 'awaiting-proposal',
      assistantMessageId: 'assistant-2',
      updatedAt: 40
    })).toMatchObject({
      status: 'running',
      stage: '等你确认工作区边界'
    });
  });

  it('completes a stopped running task when the model naturally returns a final answer', () => {
    const task = createActiveTask([
      { id: 'step-1', title: '定位问题', status: 'in_progress' }
    ]);

    expect(settleConversationTaskAfterStoppedAssistantTurn({
      currentTask: task,
      workspaceSessionStage: null,
      assistantMessageId: 'assistant-2',
      updatedAt: 40
    })).toMatchObject({
      status: 'completed',
      steps: [
        { id: 'step-1', title: '定位问题', status: 'completed' }
      ]
    });
  });
});
