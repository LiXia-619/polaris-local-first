import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuiltRequest } from './chatApiTypes';
import { executeBuiltRequest } from './chatApiTransport';
import { createProviderRuntimeTestProvider } from '../provider-runtime/providerRuntimeFixtures';

const originalFetch = globalThis.fetch;

function createNonStreamRequest(body: Record<string, unknown> = {}): BuiltRequest {
  return {
    endpoint: 'https://example.com/v1/chat/completions',
    headers: {},
    body: {
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: '整理旧对话' }],
      ...body
    },
    provider: 'openai-completions',
    compatibilityMode: 'standard'
  };
}

describe('executeBuiltRequest non-stream responses', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('accepts plain text non-stream replies when no native tools were requested', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(async () => (
      new Response('想起了一条可以保留的关系线索。', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      })
    ));

    const reply = await executeBuiltRequest({
      api: createProviderRuntimeTestProvider(),
      request: createNonStreamRequest()
    });

    expect(reply.content).toBe('想起了一条可以保留的关系线索。');
    expect(reply.model).toBe('gpt-5-mini');
  });

  it('still rejects plain text when native tools were requested', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(async () => (
      new Response('想起了一条可以保留的关系线索。', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      })
    ));

    await expect(executeBuiltRequest({
      api: createProviderRuntimeTestProvider(),
      request: createNonStreamRequest({
        tools: [{
          type: 'function',
          function: {
            name: 'writeMemory',
            description: 'writes memory',
            parameters: { type: 'object' }
          }
        }]
      })
    })).rejects.toThrow('API 返回了无法解析的非 JSON 响应');
  });

  it('does not treat JSON-shaped text/plain payloads as assistant text', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(async () => (
      new Response('{"unexpected":true}', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      })
    ));

    await expect(executeBuiltRequest({
      api: createProviderRuntimeTestProvider(),
      request: createNonStreamRequest()
    })).rejects.toThrow();
  });
});
