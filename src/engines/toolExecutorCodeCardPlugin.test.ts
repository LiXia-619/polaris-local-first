import { describe, expect, it, vi } from 'vitest';
import { codeCardToolExecutorPlugin } from './toolExecutorCodeCardPlugin';
import type { ToolContext } from './toolExecutorTypes';

function createContext(overrides: Partial<ToolContext> = {}) {
  return {
    readCodeCard: vi.fn((cardId) => ({
      id: cardId,
      title: 'Format Notes',
      language: 'javascript',
      code: 'return { output: window.PolarisTool.input };',
      tags: ['工具'],
      createdAt: 1,
      updatedAt: 1,
      kind: 'tool' as const,
      source: 'manual' as const
    })),
    readCodeCardState: vi.fn(async () => ({ count: 1 })),
    runCode: vi.fn(async () => ({
      ok: true as const,
      returnValue: JSON.stringify({
        __polarisTool: true,
        result: {
          output: '整理好了'
        },
        resultProvided: true,
        roomState: {
          count: 2
        }
      }),
      logs: [{ level: 'log' as const, args: ['done'] }]
    })),
    writeCodeCardState: vi.fn(),
    ...overrides
  } as ToolContext;
}

describe('codeCardToolExecutorPlugin', () => {
  it('runs tool cards through the sandbox wrapper and writes room state back', async () => {
    const ctx = createContext();

    const result = await codeCardToolExecutorPlugin.execute({
      kind: 'invokeCodeCardTool',
      cardId: 'card-1',
      toolName: 'cardTool_format_notes_card_1',
      input: '整理好了',
      args: {
        tone: 'clean'
      },
      targetLabel: 'Format Notes'
    }, ctx);

    expect(result).toEqual({
      ok: true,
      summary: '已调用工具卡 · Format Notes',
      detailText: '返回值：{\n  "output": "整理好了"\n}\n\n--- console ---\n[log] done',
      cardId: 'card-1'
    });
    expect(ctx.readCodeCardState).toHaveBeenCalledWith('card-1');
    expect(ctx.writeCodeCardState).toHaveBeenCalledWith('card-1', { count: 2 });
  });

  it('rejects missing tool cards before sandbox execution', async () => {
    const ctx = createContext({
      readCodeCard: vi.fn(() => null)
    });

    const result = await codeCardToolExecutorPlugin.execute({
      kind: 'invokeCodeCardTool',
      cardId: 'missing-card',
      toolName: 'cardTool_missing_card'
    }, ctx);

    expect(result).toEqual({
      ok: false,
      error: '没有找到要调用的工具卡。'
    });
    expect(ctx.runCode).not.toHaveBeenCalled();
  });

  it('keeps sandbox errors and console output together', async () => {
    const ctx = createContext({
      runCode: vi.fn(async () => ({
        ok: false as const,
        error: 'Boom',
        stack: 'stack trace',
        logs: [{ level: 'error' as const, args: ['bad result'] }]
      }))
    });

    const result = await codeCardToolExecutorPlugin.execute({
      kind: 'invokeCodeCardTool',
      cardId: 'card-1',
      toolName: 'cardTool_format_notes_card_1'
    }, ctx);

    expect(result).toEqual({
      ok: false,
      error: 'Boom\nstack trace\n--- console ---\n[error] bad result'
    });
    expect(ctx.writeCodeCardState).not.toHaveBeenCalled();
  });
});
