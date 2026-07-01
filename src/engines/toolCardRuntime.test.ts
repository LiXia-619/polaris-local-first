import { describe, expect, it } from 'vitest';
import {
  buildToolCardExecutionCode,
  buildToolCardFunctionName,
  isRunnableToolCodeCard,
  parseToolCardExecutionEnvelope
} from './toolCardRuntime';

describe('toolCardRuntime', () => {
  it('builds stable ascii tool names from tool cards', () => {
    expect(buildToolCardFunctionName({
      id: 'card-hero-01',
      title: 'Hero CTA Tool'
    })).toBe('cardTool_hero_cta_tool_card_hero_01');
  });

  it('only treats javascript tool cards as runnable', () => {
    expect(isRunnableToolCodeCard({
      kind: 'tool',
      language: 'javascript'
    })).toBe(true);
    expect(isRunnableToolCodeCard({
      kind: 'tool',
      language: 'html'
    })).toBe(false);
  });

  it('wraps tool execution code with PolarisTool and PolarisRoom runtime', () => {
    const wrapped = buildToolCardExecutionCode({
      card: {
        id: 'card-1',
        title: 'Formatter',
        language: 'javascript',
        cardNote: '整理文本',
        tags: ['工具'],
        code: 'return window.PolarisTool.input;'
      },
      payload: {
        input: 'hello'
      },
      roomState: {
        count: 1
      }
    });

    expect(wrapped).toContain('window.PolarisTool = PolarisTool;');
    expect(wrapped).toContain('window.PolarisRoom = PolarisRoom;');
    expect(wrapped).toContain('return JSON.stringify({');
  });

  it('parses wrapped tool execution envelopes', () => {
    const parsed = parseToolCardExecutionEnvelope(JSON.stringify({
      __polarisTool: true,
      result: {
        ok: true
      },
      resultProvided: true,
      roomState: {
        count: 2
      }
    }));

    expect(parsed).toEqual({
      __polarisTool: true,
      result: {
        ok: true
      },
      resultProvided: true,
      roomState: {
        count: 2
      }
    });
  });
});
