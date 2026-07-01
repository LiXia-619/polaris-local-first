import { describe, expect, it } from 'vitest';
import {
  buildConversationTaskModelSnapshot,
  createConversationTaskShell,
  reduceConversationTaskEvent,
  resolveConversationTaskMode
} from './conversationTask';
import type { ConversationTaskExecutionInput, ConversationTaskUpdateInput } from './conversationTask';
import type { ConversationTaskState } from '../types/domain';

function applyConversationTaskUpdate(args: {
  currentTask: ConversationTaskState;
  update: ConversationTaskUpdateInput;
  assistantMessageId?: string;
  updatedAt?: number;
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

function appendConversationTaskExecution(args: {
  currentTask: ConversationTaskState;
  execution: ConversationTaskExecutionInput;
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

function resolveConversationTaskPendingProposal(args: {
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

function completeConversationTaskForResultMessage(args: {
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

function settleConversationTaskAfterAssistantTurn(args: {
  currentTask: ConversationTaskState;
  assistantMessageId?: string;
  updatedAt?: number;
}) {
  return reduceConversationTaskEvent({
    currentTask: args.currentTask,
    event: {
      type: 'assistant_turn_stopped',
      assistantMessageId: args.assistantMessageId,
      updatedAt: args.updatedAt
    }
  });
}

describe('createConversationTaskShell', () => {
  it('creates a running task shell from the latest user message', () => {
    const task = createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '把这个小页面做完并跑起来',
        timestamp: 1
      },
      createdAt: 10
    });

    expect(task).toMatchObject({
      sourceMessageId: 'user-1',
      goal: '把这个小页面做完并跑起来',
      title: '把这个小页面做完并跑起来',
      mode: 'seed',
      status: 'running',
      stage: '开始处理',
      createdAt: 10,
      updatedAt: 10,
      steps: [],
      executions: []
    });
  });
});

describe('applyConversationTaskUpdate', () => {
  it('replaces task progress fields from a model update while keeping the same id', () => {
    const currentTask = createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '做个小界面',
        timestamp: 1
      },
      createdAt: 10
    });

    const updated = applyConversationTaskUpdate({
      currentTask,
      update: {
        id: 'different-id',
        title: '搭建小 iPhone 界面',
        status: 'running',
        stage: '正在补样式',
        summary: 'HTML 和 CSS 已经起好壳。',
        focus: '我先把锁屏层和页面手势拆开。',
        next: '等下把 script.js 接进去。',
        steps: [
          { id: 'step-1', title: '创建 index.html', status: 'completed' },
          { id: 'step-2', title: '创建 styles.css', status: 'in_progress' }
        ]
      },
      assistantMessageId: 'assistant-1',
      updatedAt: 20
    });

    expect(updated).toMatchObject({
      id: currentTask.id,
      title: '搭建小 iPhone 界面',
      mode: 'active',
      status: 'running',
      stage: '正在补样式',
      summary: 'HTML 和 CSS 已经起好壳。',
      focus: '我先把锁屏层和页面手势拆开。',
      next: '等下把 script.js 接进去。',
      updatedAt: 20,
      lastAssistantMessageId: 'assistant-1',
      steps: [
        { id: 'step-1', title: '创建 index.html', status: 'completed' },
        { id: 'step-2', title: '创建 styles.css', status: 'in_progress' }
      ],
      executions: []
    });
  });
});

describe('appendConversationTaskExecution', () => {
  it('appends execution references without touching model-owned progress fields', () => {
    const currentTask = createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '做个小界面',
        timestamp: 1
      },
      createdAt: 10
    });

    const updated = appendConversationTaskExecution({
      currentTask: {
        ...currentTask,
        title: '搭建小 iPhone 界面',
        stage: '正在补样式'
      },
      execution: {
        assistantMessageId: 'assistant-1',
        toolCallIds: ['tool-call-1'],
        resultMessageIds: ['tool-message-1', 'tool-message-2'],
        pendingProposalIds: ['proposal-1']
      },
      updatedAt: 20
    });

    expect(updated).toMatchObject({
      title: '搭建小 iPhone 界面',
      stage: '正在补样式',
      mode: 'active',
      updatedAt: 20,
      executions: [{
        id: 'assistant-1',
        assistantMessageId: 'assistant-1',
        toolCallIds: ['tool-call-1'],
        resultMessageIds: ['tool-message-1', 'tool-message-2'],
        pendingProposalIds: ['proposal-1'],
        updatedAt: 20
      }]
    });
  });

  it('keeps every execution segment so old task receipts stay reopenable', () => {
    const currentTask = createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '做个小界面',
        timestamp: 1
      },
      createdAt: 10
    });

    const updated = Array.from({ length: 6 }, (_, index) => index + 1).reduce((task, index) => (
      appendConversationTaskExecution({
        currentTask: task,
        execution: {
          assistantMessageId: `assistant-${index}`,
          toolCallIds: [`tool-call-${index}`],
          resultMessageIds: [`tool-message-${index}`]
        },
        updatedAt: 20 + index
      })
    ), currentTask);

    expect(updated.executions.map((execution) => execution.assistantMessageId)).toEqual([
      'assistant-1',
      'assistant-2',
      'assistant-3',
      'assistant-4',
      'assistant-5',
      'assistant-6'
    ]);
  });
});

describe('resolveConversationTaskPendingProposal', () => {
  it('clears the accepted workspace proposal from task execution evidence', () => {
    const task = appendConversationTaskExecution({
      currentTask: {
        ...createConversationTaskShell({
          sourceMessage: {
            id: 'user-1',
            content: '做个小界面',
            timestamp: 1
          },
          createdAt: 10
        }),
        mode: 'active',
        stage: '等你确认工作区边界',
        next: '你确认后我会接着继续施工。'
      },
      execution: {
        assistantMessageId: 'assistant-1',
        pendingProposalIds: ['proposal-1']
      },
      updatedAt: 20
    });

    const updated = resolveConversationTaskPendingProposal({
      currentTask: task,
      proposalId: 'proposal-1',
      decision: 'accepted',
      updatedAt: 30
    });

    expect(updated).toMatchObject({
      mode: 'active',
      status: 'running',
      stage: '工作区已确认',
      next: '我会接着继续施工。',
      updatedAt: 30,
      executions: [{
        assistantMessageId: 'assistant-1',
        pendingProposalIds: []
      }]
    });
  });
});

describe('buildConversationTaskModelSnapshot', () => {
  it('omits system-owned execution references from the prompt-facing task snapshot', () => {
    const task = appendConversationTaskExecution({
      currentTask: createConversationTaskShell({
        sourceMessage: {
          id: 'user-1',
          content: '做个小界面',
          timestamp: 1
        },
        createdAt: 10
      }),
      execution: {
        assistantMessageId: 'assistant-1',
        resultMessageIds: ['tool-message-1']
      },
      updatedAt: 20
    });

    expect(buildConversationTaskModelSnapshot(task)).toEqual({
      id: task.id,
      sourceMessageId: 'user-1',
      goal: '做个小界面',
      title: '做个小界面',
      mode: 'active',
      status: 'running',
      stage: '开始处理',
      summary: undefined,
      focus: undefined,
      next: undefined,
      steps: [],
      createdAt: 10,
      updatedAt: 20,
      lastAssistantMessageId: undefined
    });
  });

  it('treats missing mode on persisted legacy tasks as active', () => {
    expect(resolveConversationTaskMode({ mode: undefined })).toBe('active');
  });
});

describe('completeConversationTaskForResultMessage', () => {
  it('marks the task completed when a referenced result message gets explicitly confirmed', () => {
    const task = appendConversationTaskExecution({
      currentTask: {
        ...createConversationTaskShell({
          sourceMessage: {
            id: 'user-1',
            content: '换个皮肤',
            timestamp: 1
          },
          createdAt: 10
        }),
        stage: '等你确认这版试穿',
        focus: '盯着预览效果',
        next: '你确认后就收尾',
        steps: [
          { id: 'step-1', title: '生成换肤预览', status: 'completed' },
          { id: 'step-2', title: '等待你确认是否穿上', status: 'in_progress' }
        ]
      },
      execution: {
        assistantMessageId: 'assistant-1',
        resultMessageIds: ['tool-preview-1']
      },
      updatedAt: 20
    });

    expect(completeConversationTaskForResultMessage({
      currentTask: task,
      resultMessageId: 'tool-preview-1',
      stage: '已穿上这版换肤',
      summary: '这版试穿已经确认保留。',
      updatedAt: 30
    })).toMatchObject({
      status: 'completed',
      stage: '已穿上这版换肤',
      summary: '这版试穿已经确认保留。',
      focus: undefined,
      next: undefined,
      updatedAt: 30,
      steps: [
        { id: 'step-1', title: '生成换肤预览', status: 'completed' },
        { id: 'step-2', title: '等待你确认是否穿上', status: 'completed' }
      ]
    });
  });

  it('leaves unrelated tasks alone', () => {
    const task = appendConversationTaskExecution({
      currentTask: createConversationTaskShell({
        sourceMessage: {
          id: 'user-1',
          content: '换个皮肤',
          timestamp: 1
        },
        createdAt: 10
      }),
      execution: {
        assistantMessageId: 'assistant-1',
        resultMessageIds: ['tool-preview-1']
      },
      updatedAt: 20
    });

    expect(completeConversationTaskForResultMessage({
      currentTask: task,
      resultMessageId: 'tool-preview-2',
      stage: '不该完成',
      updatedAt: 30
    })).toEqual(task);
  });
});

describe('settleConversationTaskAfterAssistantTurn', () => {
  it('leaves seed tasks invisible instead of promoting them to completed tasks', () => {
    const task = createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '咪咪喵喵',
        timestamp: 1
      },
      createdAt: 10
    });

    expect(settleConversationTaskAfterAssistantTurn({
      currentTask: task,
      assistantMessageId: 'assistant-1',
      updatedAt: 20
    })).toEqual(task);
  });

  it('converts a lingering running task into completed when the model naturally stops', () => {
    const task = applyConversationTaskUpdate({
      currentTask: createConversationTaskShell({
        sourceMessage: {
          id: 'user-1',
          content: '把皮肤 bug 修掉',
          timestamp: 1
        },
        createdAt: 10
      }),
      update: {
        title: '修皮肤切换',
        status: 'running',
        stage: '正在检查入口文件',
        focus: '我先把切换逻辑读一遍。',
        next: '等下看样式文件有没有漏掉。',
        steps: [
          { id: 'step-1', title: '读入口文件', status: 'completed' },
          { id: 'step-2', title: '定位切换卡点', status: 'in_progress' }
        ]
      },
      assistantMessageId: 'assistant-1',
      updatedAt: 20
    });

    expect(settleConversationTaskAfterAssistantTurn({
      currentTask: task,
      assistantMessageId: 'assistant-2',
      updatedAt: 30
    })).toMatchObject({
      status: 'completed',
      stage: '正在检查入口文件',
      focus: undefined,
      next: undefined,
      updatedAt: 30,
      lastAssistantMessageId: 'assistant-2',
      steps: [
        { id: 'step-1', title: '读入口文件', status: 'completed' },
        { id: 'step-2', title: '定位切换卡点', status: 'completed' }
      ]
    });
  });

  it('does not touch completed tasks', () => {
    const task = completeConversationTaskForResultMessage({
      currentTask: appendConversationTaskExecution({
        currentTask: createConversationTaskShell({
          sourceMessage: {
            id: 'user-1',
            content: '换个皮肤',
            timestamp: 1
          },
          createdAt: 10
        }),
        execution: {
          assistantMessageId: 'assistant-1',
          resultMessageIds: ['tool-preview-1']
        },
        updatedAt: 20
      }),
      resultMessageId: 'tool-preview-1',
      updatedAt: 30
    });

    expect(settleConversationTaskAfterAssistantTurn({
      currentTask: task,
      updatedAt: 40
    })).toEqual(task);
  });
});
