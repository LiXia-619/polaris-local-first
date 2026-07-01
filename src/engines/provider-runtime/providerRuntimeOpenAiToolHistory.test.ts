import { describe, expect, it } from 'vitest';
import {
  shouldRetryWithTranscriptToolHistory,
  shouldUseTranscriptToolHistoryForRequest
} from './providerRuntimeOpenAiToolHistory';
import type { ProviderHttpRequest } from './providerRuntimeTypes';

function createRequest(messages: unknown[]): ProviderHttpRequest {
  return {
    endpoint: 'https://example.com/v1/chat/completions',
    headers: {
      Authorization: 'Bearer test',
      'Content-Type': 'application/json'
    },
    body: {
      model: 'deepseek-v3',
      messages
    },
    provider: 'openai-completions',
    compatibilityMode: 'standard'
  };
}

describe('shouldRetryWithTranscriptToolHistory', () => {
  it('matches the known tool-role sequencing error for native OpenAI-compatible tool history', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '我先试试看。',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'patchRawCss', arguments: '{}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'patchRawCss',
        content: '{"status":"applied"}'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error(`API 400: {"message":"Messages with role 'tool' must be a response to a preceding message with 'tool_calls'","type":"invalid_request_error"}`),
        false,
        'native'
      )
    ).toBe(true);
  });

  it('does not trigger once the request is already using transcript mode', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '我先试试看。\n\n[assistant_tool_calls]\n\n[]'
      },
      {
        role: 'user',
        content: '[tool_result:patchRawCss]\n\n{"status":"applied"}'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error(`API 400: {"message":"Messages with role 'tool' must be a response to a preceding message with 'tool_calls'","type":"invalid_request_error"}`),
        false,
        'transcript'
      )
    ).toBe(false);
  });

  it('does not trigger for unrelated provider errors', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '我先试试看。',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'patchRawCss', arguments: '{}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'patchRawCss',
        content: '{"status":"applied"}'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error('API 429: rate limited'),
        false,
        'native'
      )
    ).toBe(false);
  });

  it('matches malformed native tool arguments that would poison the next request', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '我先继续。',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: {
            name: 'appendCodeCard',
            arguments: '{"projectId":"white-cat-box","filePath":"script.js","code":"const part = "'
          }
        }]
      }
    ]);

    expect(shouldUseTranscriptToolHistoryForRequest(request, 'native')).toBe(true);
    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error('API 400: {"error":{"message":"unexpected end of data: line 1 column 7048 (char 7047)"}}'),
        false,
        'native'
      )
    ).toBe(true);
  });

  it('also retries for generic localized 400 format errors when native tool history is present', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '我先试试看。',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'readProjectFile', arguments: '{"target":"active"}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'readProjectFile',
        content: '{"status":"executed"}'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error('API 400: 未能读取数据，因为它的格式不正确。'),
        false,
        'native'
      )
    ).toBe(true);
  });

  it('retries empty 400 responses when native tool history is present', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '我已经写完并保存。',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: {
            name: 'writeProjectFiles',
            arguments: '{"projectId":"lighthouse","files":[{"path":"index.html","content":"<html>...</html>"}]}'
          }
        }]
      },
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'writeProjectFiles',
        content: '{"status":"executed"}'
      },
      {
        role: 'user',
        content: '1'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error('API 400:'),
        false,
        'native'
      )
    ).toBe(true);
  });

  it('retries empty parsed replies when native tool history is present', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'mcp__luntan__forum_search', arguments: '{"query":"test"}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'mcp__luntan__forum_search',
        content: '{"status":"executed","summary":"读取成功"}'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error('API 返回为空'),
        false,
        'native'
      )
    ).toBe(true);
  });

  it('retries empty parsed reply snippets when native tool history is present', () => {
    const request = createRequest([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'createProactiveMessageRule', arguments: '{"name":"早安"}' } }]
      },
      {
        role: 'tool',
        tool_call_id: 'call-1',
        name: 'createProactiveMessageRule',
        content: '{"status":"executed","summary":"已创建主动消息规则"}'
      },
      {
        role: 'user',
        content: '那你可以设置固定每天几点吗'
      }
    ]);

    expect(
      shouldRetryWithTranscriptToolHistory(
        request,
        new Error('API 返回为空：{"choices":[{"message":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":9614}}'),
        false,
        'native'
      )
    ).toBe(true);
  });
});
