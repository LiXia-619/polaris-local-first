import { describe, expect, it } from 'vitest';
import { buildStoredToolCallRecords } from './chatToolCallRecords';

describe('buildStoredToolCallRecords', () => {
  it('normalizes native tool calls into stored history records', () => {
    expect(buildStoredToolCallRecords({
      assistantMessageId: 'assistant-1',
      content: '我来调一下。',
      actions: [],
      nativeToolCalls: [{
        name: 'patchRawCss',
        argumentsText: '{"css":"body { color: red; }"}'
      }]
    })).toEqual([{
      id: 'assistant-1:tool-call:1',
      name: 'patchRawCss',
      argumentsText: '{"css":"body { color: red; }"}',
      sourceSpan: {
        transport: 'native',
        index: 0
      }
    }]);
  });

  it('synthesizes fence tool history when the reply used a polaris-tools block', () => {
    expect(buildStoredToolCallRecords({
      assistantMessageId: 'assistant-2',
      content: '```polaris-tools\n{"actions":[{"kind":"patchRawCss","css":"body { color: red; }"}]}\n```',
      actions: [{
        kind: 'patchRawCss',
        css: 'body { color: red; }'
      }],
      nativeToolCalls: []
    })).toEqual([{
      id: 'assistant-2:tool-call:1',
      name: 'patchRawCss',
      argumentsText: '{"css":"body { color: red; }"}',
      sourceSpan: {
        transport: 'fence',
        index: 0
      }
    }]);
  });
});
