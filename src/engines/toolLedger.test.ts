import { describe, expect, it } from 'vitest';
import { rebuildConversationToolLedger } from './toolLedger';
import type { ChatMessage } from '../types/domain';

describe('rebuildConversationToolLedger', () => {
  it('pairs assistant tool calls with explicit toolCallId results', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '我先读一下。',
        timestamp: 1,
        nativeToolCalls: [{
          id: 'call-1',
          name: 'readProjectFile',
          argumentsText: '{"target":"active"}'
        }]
      },
      {
        id: 'tool-1',
        role: 'system',
        content: '已读取 index.html',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-1',
          kind: 'readProjectFile',
          status: 'executed',
          title: '读取工作区文件',
          summary: '已读取 index.html',
          originMessageId: 'assistant-1',
          toolCallId: 'call-1'
        }
      }
    ];

    expect(rebuildConversationToolLedger(messages)).toEqual([
      {
        id: 'assistant-1:tool-ledger:1',
        toolCallId: 'call-1',
        assistantMessageId: 'assistant-1',
        order: 0,
        toolName: 'readProjectFile',
        argumentsText: '{"target":"active"}',
        sourceSpan: {
          transport: 'native',
          index: 0
        },
        resultMessageId: 'tool-1',
        resultToolName: 'readProjectFile',
        resultStatus: 'executed',
        resultIsError: false,
        resultSourceMessageId: 'assistant-1',
        resultStructuredPayload: expect.objectContaining({
          kind: 'readProjectFile',
          status: 'executed',
          summary: '已读取 index.html'
        })
      }
    ]);
  });

  it('can recover old tool results by originMessageId when toolCallId is missing', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '我先查一下。',
        timestamp: 1,
        nativeToolCalls: [{
          id: 'call-1',
          name: 'readProjectFile',
          argumentsText: '{"target":"active"}'
        }]
      },
      {
        id: 'tool-1',
        role: 'system',
        content: '已读取 index.html',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-1',
          kind: 'readProjectFile',
          status: 'executed',
          title: '读取工作区文件',
          summary: '已读取 index.html',
          originMessageId: 'assistant-1'
        }
      }
    ];

    expect(rebuildConversationToolLedger(messages)?.[0]).toEqual(
      expect.objectContaining({
        toolCallId: 'call-1',
        sourceSpan: {
          transport: 'native',
          index: 0
        },
        resultMessageId: 'tool-1',
        resultStatus: 'executed'
      })
    );
  });

  it('keeps synthetic tool call source spans separate from provider-native calls', () => {
    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '```polaris-tools\n{"actions":[{"kind":"patchRawCss","css":"body { color: pink; }"}]}\n```',
        timestamp: 1,
        nativeToolCalls: [{
          id: 'call-1',
          name: 'patchRawCss',
          argumentsText: '{"css":"body { color: pink; }"}',
          sourceSpan: {
            transport: 'fence',
            index: 0,
            blockIndex: 0
          }
        }]
      },
      {
        id: 'tool-1',
        role: 'system',
        content: '已试穿 CSS',
        timestamp: 2,
        toolInvocation: {
          id: 'tool-1',
          kind: 'patchRawCss',
          status: 'preview',
          title: '试穿 CSS',
          summary: 'body { color: pink; }',
          originMessageId: 'assistant-1',
          toolCallId: 'call-1'
        }
      }
    ];

    expect(rebuildConversationToolLedger(messages)?.[0]).toEqual(
      expect.objectContaining({
        toolCallId: 'call-1',
        sourceSpan: {
          transport: 'fence',
          index: 0,
          blockIndex: 0
        },
        resultMessageId: 'tool-1',
        resultStatus: 'preview'
      })
    );
  });
});
