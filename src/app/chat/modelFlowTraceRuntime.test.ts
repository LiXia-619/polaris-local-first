import { describe, expect, it } from 'vitest';
import type { ToolAction } from '../../engines/toolExecutor';
import type { ChatMessage, ToolInvocation } from '../../types/domain';
import {
  buildModelFlowTraceEntry,
  summarizeModelFlowTraceEntries
} from './modelFlowTraceRuntime';

function userMessage(content: string): ChatMessage {
  return {
    id: 'user-1',
    role: 'user',
    content,
    timestamp: 1
  };
}

function readProjectAction(): ToolAction {
  return {
    kind: 'readProjectFile',
    fileId: 'file-1',
    targetLabel: 'src/App.tsx'
  };
}

function readProjectInvocation(): ToolInvocation {
  return {
    id: 'tool-1',
    kind: 'readProjectFile',
    toolName: 'readProjectFile',
    status: 'executed',
    title: '读取工作区文件',
    summary: '已读取 src/App.tsx',
    originMessageId: 'assistant-1',
    toolCallId: 'call-1',
    projectFileReads: [{
      kind: 'file',
      projectId: 'project-1',
      file: {
        projectId: 'project-1',
        fileId: 'file-1',
        filePath: 'src/App.tsx',
        language: 'tsx',
        totalLines: 12,
        totalChars: 240
      }
    }],
    detailText: 'export function App() { return <main>Hello</main>; }'
  };
}

describe('buildModelFlowTraceEntry', () => {
  it('keeps provider thinking as diagnostic evidence without requiring it for execution facts', () => {
    const action = readProjectAction();
    const invocation = readProjectInvocation();
    const entry = buildModelFlowTraceEntry({
      phase: 'completed',
      toolPreparationStatus: 'ready',
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      assistantName: 'Pharos',
      assistantMessageId: 'assistant-1',
      messages: [userMessage('先读一下 App 文件再判断')],
      visibleReply: '我先读文件。',
      reply: {
        content: '我先读文件。',
        model: 'test-model',
        thinkingText: '需要调用工具读取 workspace 文件，然后根据错误继续下一步。',
        nativeToolCallCount: 1,
        usedNativeToolCalls: true
      },
      preparationOutcome: {
        status: 'ready',
        reply: { content: '我先读文件。' },
        parsed: {
          displayContent: '我先读文件。',
          actions: [action as never],
          issues: []
        },
        resolvedActions: [action]
      },
      resolvedActions: [action],
      outcomes: [{
        path: 'direct',
        status: 'executed',
        action,
        toolInvocation: invocation
      }],
      toolLedger: [{
        id: 'ledger-1',
        assistantMessageId: 'assistant-1',
        toolCallId: 'call-1',
        order: 0,
        toolName: 'readProjectFile',
        argumentsText: '{"fileId":"file-1"}',
        resultMessageId: 'tool-result-1',
        resultToolName: 'readProjectFile',
        resultStatus: 'executed',
        resultIsError: false,
        resultStructuredPayload: {
          kind: 'readProjectFile',
          status: 'executed',
          title: '读取工作区文件',
          summary: '已读取 src/App.tsx',
          detailText: invocation.detailText,
          projectFileReads: invocation.projectFileReads
        }
      }]
    }, 123);

    expect(entry.reasoningEvidence).toMatchObject({
      available: true,
      source: 'provider-thinking'
    });
    expect(entry.reasoningEvidence.signals).toEqual([
      'tool_selection',
      'target_resolution',
      'error_interpretation',
      'followup_planning'
    ]);
    expect(entry.toolExecution).toEqual([expect.objectContaining({
      path: 'direct',
      kind: 'readProjectFile',
      status: 'executed',
      title: '读取工作区文件'
    })]);
    expect(entry.toolResultProjection).toEqual([expect.objectContaining({
      toolCallId: 'call-1',
      detailProjection: 'full',
      isError: false
    })]);
    expect(entry.verdict).toBe('warn');
    expect(entry.reasons).toContain('这一轮没有留下 request audit，无法确认模型实际看见了什么。');
  });

  it('summarizes warning and failure traces for monitor runners', () => {
    const base = buildModelFlowTraceEntry({
      phase: 'completed',
      toolPreparationStatus: 'ready',
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      assistantName: 'Pharos',
      messages: [userMessage('你好')],
      visibleReply: '你好',
      reply: { content: '你好' }
    }, 1);
    const failed = buildModelFlowTraceEntry({
      phase: 'request_failed',
      toolPreparationStatus: 'request_failed',
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      assistantName: 'Pharos',
      messages: [userMessage('联网查一下')],
      visibleReply: 'API 500'
    }, 2);

    expect(summarizeModelFlowTraceEntries([base, failed])).toMatchObject({
      total: 2,
      passCount: 0,
      warnCount: 1,
      failCount: 1,
      latestIssues: [
        expect.objectContaining({ phase: 'request_failed', verdict: 'fail' }),
        expect.objectContaining({ phase: 'completed', verdict: 'warn' })
      ]
    });
  });

  it('flags orphaned interface action drafts and incomplete streams', () => {
    const entry = buildModelFlowTraceEntry({
      phase: 'completed',
      toolPreparationStatus: 'missing_actions',
      conversationId: 'conversation-1',
      collaboratorId: 'persona-1',
      assistantName: 'Pharos',
      messages: [userMessage('把按钮改蓝')],
      visibleReply: '```polaris-tools\n{"actions": [',
      reply: {
        content: '```polaris-tools\n{"actions": [',
        finishReason: 'length',
        transportIncomplete: true
      }
    }, 3);

    expect(entry.response).toMatchObject({
      finishReason: 'length',
      transportIncomplete: true,
      toolDraftBlockCount: 1
    });
    expect(entry.verdict).toBe('fail');
    expect(entry.reasons).toContain('流式回复没有正常结束，系统按不完整输出处理。');
    expect(entry.reasons).toContain('模型回复因为长度限制结束，可能截断了正文或工具参数。');
    expect(entry.reasons).toContain('回复里还有界面动作草稿，但没有对应的工具执行或结果投影证据。');
  });
});
