import { describe, expect, it } from 'vitest';
import { parseAssistantReplyContent } from './chatReplyContent';
import {
  buildInterruptedWorkspaceDraftFailureToolInvocation,
  buildPreparationFailureRuntimeFeedbackEvent,
  buildPreparationFailureToolInvocation,
  resolveAssistantToolPreparationOutcome
} from './chatToolOutcome';

describe('resolveAssistantToolPreparationOutcome', () => {
  it('treats half-written native tool arguments as truncated output even without finishReason length', () => {
    const nativeToolCalls = [{
      id: 'call_1',
      name: 'createCodeCard',
      argumentsText: '{"title":"北极星的糖","language":"html","code":"<section>hello</section>'
    }];
    const parsed = parseAssistantReplyContent(
      '我先把它做出来。',
      'medium',
      'stable',
      'final',
      nativeToolCalls
    );

    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '我先把它做出来。',
        nativeToolCalls,
        finishReason: 'stop'
      },
      parsed: parsed.parsed,
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    expect(outcome.status).toBe('parse_failed');
    if (outcome.status !== 'parse_failed') {
      throw new Error(`expected parse_failed, got ${outcome.status}`);
    }
    expect(outcome.message).toContain('provider 提前收口');
    expect(outcome.truncated).toBe(true);
  });

  it('keeps ordinary parse failures on the regular message path', () => {
    const parsed = {
      displayContent: '',
      actions: [],
      issues: ['工具块里没有找到可执行动作。']
    };

    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '',
        finishReason: 'stop'
      },
      parsed,
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    expect(outcome.status).toBe('parse_failed');
    if (outcome.status !== 'parse_failed') {
      throw new Error(`expected parse_failed, got ${outcome.status}`);
    }
    expect(outcome.message).toBe('工具块里没有找到可执行动作。');
    expect(outcome.truncated).toBe(false);
  });

  it('uses product-neutral copy when a required tool action is missing', () => {
    const parsed = {
      displayContent: '我会继续做这个项目。',
      actions: [],
      issues: []
    };

    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '我会继续做这个项目。',
        finishReason: 'stop'
      },
      parsed,
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    expect(outcome.status).toBe('missing_actions');
    if (outcome.status !== 'missing_actions') {
      throw new Error(`expected missing_actions, got ${outcome.status}`);
    }
    expect(outcome.message).toBe('这次回复没有形成可执行的工具动作，所以内容还没有真正落到 Polaris。');
    expect(outcome.message).not.toContain('界面');
  });

  it('builds a structured runtime feedback event for blocked tool preparation', () => {
    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '',
        finishReason: 'stop'
      },
      parsed: {
        displayContent: '',
        actions: [],
        issues: ['工具块里没有找到可执行动作。']
      },
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    const event = buildPreparationFailureRuntimeFeedbackEvent(outcome, 123);

    expect(event).toEqual(expect.objectContaining({
      kind: 'assistant_tool_preparation_failed',
      createdAt: 123,
      status: 'parse_failed',
      summary: '上一轮工具准备失败，工具块没有通过解析。'
    }));
    expect(event).toEqual(expect.objectContaining({
      reasons: ['工具块里没有找到可执行动作。'],
      declaredActionKinds: [],
      resolvedActionKinds: []
    }));
  });

  it('builds a visible failed tool event for blocked preparation', () => {
    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '',
        finishReason: 'stop'
      },
      parsed: {
        displayContent: '',
        actions: [],
        issues: ['工作区文件块解析失败：工作区文件头必须是对象。']
      },
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    const tool = buildPreparationFailureToolInvocation(outcome);

    expect(tool).toEqual(expect.objectContaining({
      kind: 'writeProjectFiles',
      status: 'failed',
      title: '工具准备失败',
      summary: '上一轮工具准备失败，工具块没有通过解析。',
      error: '工作区文件块解析失败：工作区文件头必须是对象。'
    }));
  });

  it('keeps malformed raw tool arguments out of follow-up context', () => {
    const issue = [
      '原生工具 readProjectFile 解析失败，这次动作还没有真正执行。',
      '解析器提示：Unexpected non-whitespace character after JSON at position 115',
      '原始参数：{"docId":"memory-doc-1"} {"targetLabel":"重复尾巴"}'
    ].join('\n');
    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '',
        finishReason: 'stop'
      },
      parsed: {
        displayContent: '',
        actions: [],
        issues: [issue]
      },
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    const event = buildPreparationFailureRuntimeFeedbackEvent(outcome, 123);
    const tool = buildPreparationFailureToolInvocation(outcome);

    expect(event?.kind).toBe('assistant_tool_preparation_failed');
    if (event?.kind !== 'assistant_tool_preparation_failed') {
      throw new Error('expected assistant_tool_preparation_failed');
    }
    expect(event?.reasons).toEqual([
      '原生工具 readProjectFile 解析失败，这次动作还没有真正执行。',
      '解析器提示：Unexpected non-whitespace character after JSON at position 115',
      '原始工具参数已从下一轮上下文省略。'
    ]);
    expect(JSON.stringify(event)).not.toContain('memory-doc-1');
    expect(tool?.error).not.toContain('memory-doc-1');
    expect(tool?.error).toContain('原始工具参数已从下一轮上下文省略。');
  });

  it('marks truncated preparation failures so runtime feedback can explain the difference', () => {
    const nativeToolCalls = [{
      id: 'call_1',
      name: 'createCodeCard',
      argumentsText: '{"title":"北极星的糖","language":"html","code":"<section>hello</section>'
    }];
    const parsed = parseAssistantReplyContent(
      '我先把它做出来。',
      'medium',
      'stable',
      'final',
      nativeToolCalls
    );
    const outcome = resolveAssistantToolPreparationOutcome({
      reply: {
        content: '我先把它做出来。',
        nativeToolCalls,
        finishReason: 'stop'
      },
      parsed: parsed.parsed,
      resolvedActions: [],
      resolutionErrors: [],
      expectsToolAction: true
    });

    const event = buildPreparationFailureRuntimeFeedbackEvent(outcome, 456);

    expect(event).toEqual(expect.objectContaining({
      kind: 'assistant_tool_preparation_failed',
      createdAt: 456,
      status: 'parse_failed',
      truncated: true
    }));
  });

  it('builds a visible failed tool event for interrupted workspace drafts', () => {
    const tool = buildInterruptedWorkspaceDraftFailureToolInvocation(new Error('stream lost'));

    expect(tool).toEqual(expect.objectContaining({
      kind: 'writeProjectFiles',
      status: 'failed',
      title: '工作区草稿未落地',
      summary: '流式连接中断，工作区草稿没有完成写入。',
      error: 'stream lost'
    }));
  });
});
