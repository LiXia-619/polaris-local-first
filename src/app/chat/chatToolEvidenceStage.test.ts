import { describe, expect, it } from 'vitest';
import { createConversationTaskShell, resolveConversationTaskMode } from '../../engines/conversationTask';
import type { ToolAction } from '../../engines/toolExecutor';
import type { ConversationTaskState, ToolLedgerEntry, ToolInvocation } from '../../types/domain';
import { commitAssistantToolEvidenceStage } from './chatToolEvidenceStage';
import type { ToolActionRunOutcome } from './chatToolOutcome';

function createToolInvocation(kind: ToolInvocation['kind']): ToolInvocation {
  return {
    id: 'tool-result-1',
    kind,
    status: 'executed',
    title: '工具执行',
    summary: '工具已执行'
  };
}

describe('commitAssistantToolEvidenceStage', () => {
  it('records task activation and execution evidence from the same assistant turn', () => {
    let currentTask: ConversationTaskState | null = createConversationTaskShell({
      sourceMessage: {
        id: 'user-1',
        content: '做完这个工作区',
        timestamp: 1
      },
      createdAt: 10
    });
    const toolLedger: ToolLedgerEntry[] = [{
      id: 'ledger-1',
      assistantMessageId: 'assistant-1',
      toolCallId: 'tool-call-1',
      resultMessageId: 'tool-message-1',
      order: 0,
      toolName: 'startTask',
      argumentsText: '{}'
    }];
    const startTaskAction: ToolAction = {
      kind: 'startTask',
      capability: 'workspace',
      title: '做完这个工作区',
      stage: '开始搭建',
      steps: ['写入入口文件']
    };
    const outcomes: ToolActionRunOutcome[] = [{
      path: 'direct',
      status: 'executed',
      action: startTaskAction,
      toolInvocation: createToolInvocation('startTask')
    }];

    const result = commitAssistantToolEvidenceStage({
      chat: {
        findConversation: () => ({ toolLedger }) as never,
        getConversationTask: () => currentTask,
        setConversationTask: (_conversationId, task) => {
          currentTask = task;
        }
      },
      conversationId: 'conversation-1',
      assistantMessageId: 'assistant-1',
      actions: [startTaskAction],
      outcomes,
      activatedTaskThisTurn: false
    });

    expect(result.activatedTaskThisTurn).toBe(true);
    expect(resolveConversationTaskMode(currentTask)).toBe('active');
    expect(currentTask).toMatchObject({
      title: '做完这个工作区',
      stage: '开始搭建',
      next: '写入入口文件',
      lastAssistantMessageId: 'assistant-1',
      executions: [{
        assistantMessageId: 'assistant-1',
        toolCallIds: ['tool-call-1'],
        resultMessageIds: ['tool-message-1']
      }]
    });
  });
});

