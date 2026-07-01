import { describe, expect, it } from 'vitest';
import { buildConversationTaskWorkbench } from './conversationTaskWorkbench';
import type { ConversationTaskState } from '../types/domain';

describe('buildConversationTaskWorkbench', () => {
  it('builds shared workbench lines and execution segments from task state and messages', () => {
    const task: ConversationTaskState = {
      id: 'task-1',
      sourceMessageId: 'user-1',
      goal: '搭一个小 iPhone 界面',
      title: '搭一个小 iPhone 界面',
      status: 'running',
      stage: '继续补锁屏交互',
      summary: 'HTML 和 CSS 已经起好壳。',
      focus: '我先把锁屏层和页面手势拆开。',
      next: '等下跑一遍验证。',
      steps: [],
      executions: [{
        id: 'assistant-1',
        assistantMessageId: 'assistant-1',
        toolCallIds: ['tool-call-1'],
        resultMessageIds: ['tool-message-1'],
        pendingProposalIds: ['proposal-1'],
        updatedAt: 2
      }],
      createdAt: 1,
      updatedAt: 2
    };

    const workbench = buildConversationTaskWorkbench({
      currentTask: task,
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '我先把页面壳起好，再接着补样式。',
          timestamp: 1
        },
        {
          id: 'tool-message-1',
          role: 'system',
          content: '已创建工作区文件 · styles.css',
          timestamp: 2,
          origin: 'tool-runtime',
          toolInvocation: {
            id: 'tool-1',
            kind: 'createProjectFile',
            status: 'executed',
            title: '已创建工作区文件',
            summary: '已创建工作区文件 · styles.css'
          }
        }
      ]
    });

    expect(workbench.lines).toContain('当前目标：搭一个小 iPhone 界面');
    expect(workbench.lines).toContain('最近一段你自己刚说过：我先把页面壳起好，再接着补样式。');
    expect(workbench.lines).toContain('最近一段已经落下：已创建工作区文件 · styles.css');
    expect(workbench.lines).toContain('最近一段这一步碰到了待确认的工作区边界。');
    expect(workbench.lines).toContain('你现在正埋头在：我先把锁屏层和页面手势拆开。');
    expect(workbench.lines).toContain('你等下准备：等下跑一遍验证。');
    expect(workbench.executionSegments).toEqual([
      expect.objectContaining({
        id: 'assistant-1',
        note: '我先把页面壳起好，再接着补样式。',
        hasPendingWorkspaceProposal: true
      })
    ]);
  });
});
