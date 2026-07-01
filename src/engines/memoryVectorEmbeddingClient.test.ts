import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderProfile } from '../types/domain';
import {
  buildMemoryVectorEmbeddingEndpoint,
  requestMemoryVectorEmbeddings
} from './memoryVectorEmbeddingClient';

const nativePlatform = vi.hoisted(() => ({ value: false }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativePlatform.value
  }
}));

const provider: ProviderProfile = {
  id: 'provider-a',
  name: 'Provider A',
  protocol: 'openai-completions',
  baseUrl: 'https://api.example.test/v1',
  path: '/chat/completions',
  apiKey: 'sk-test',
  model: 'chat-model',
  capabilities: {
    images: false,
    streaming: false,
    thinking: false
  }
};

describe('memoryVectorEmbeddingClient', () => {
  beforeEach(() => {
    nativePlatform.value = true;
    vi.unstubAllGlobals();
  });

  it('derives OpenAI-compatible embeddings endpoints from chat or responses paths', () => {
    expect(buildMemoryVectorEmbeddingEndpoint(provider)).toBe('https://api.example.test/v1/embeddings');
    expect(buildMemoryVectorEmbeddingEndpoint({
      ...provider,
      protocol: 'openai-responses',
      path: '/responses'
    })).toBe('https://api.example.test/v1/embeddings');
    expect(() => buildMemoryVectorEmbeddingEndpoint({
      ...provider,
      protocol: 'anthropic-messages',
      path: '/messages'
    })).toThrow('OpenAI 兼容');
  });

  it('requests embeddings directly on native and preserves input order by response index', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { index: 1, embedding: [0, 1, 0] },
        { index: 0, embedding: [1, 0, 0] }
      ]
    }), { status: 200 }));

    const vectors = await requestMemoryVectorEmbeddings({
      api: provider,
      model: 'text-embedding-3-small',
      dimensions: 3,
      inputs: ['第一段', '第二段'],
      fetchImpl: fetchImpl as never
    });

    expect(vectors).toEqual([[1, 0, 0], [0, 1, 0]]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: ['第一段', '第二段'],
          dimensions: 3
        })
      })
    );
  });

  it('uses the dedicated embedding relay for cross-origin browser requests', async () => {
    nativePlatform.value = false;
    vi.stubGlobal('window', {
      location: { origin: 'https://polaris.example.test' }
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ index: 0, embedding: [1, 0, 0] }]
    }), { status: 200 }));

    await requestMemoryVectorEmbeddings({
      api: provider,
      model: 'text-embedding-3-small',
      dimensions: null,
      inputs: ['语义文本'],
      fetchImpl: fetchImpl as never
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://polaris.example.test/api/provider-embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const relayCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(relayCall[1].body));
    expect(body).toMatchObject({
      endpoint: 'https://api.example.test/v1/embeddings',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test'
      },
      body: {
        model: 'text-embedding-3-small',
        input: ['语义文本']
      }
    });
  });

  it('rejects incomplete embedding responses', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ index: 0, embedding: [1, 0, 0] }]
    }), { status: 200 }));

    await expect(requestMemoryVectorEmbeddings({
      api: provider,
      model: 'text-embedding-3-small',
      dimensions: null,
      inputs: ['one', 'two'],
      fetchImpl: fetchImpl as never
    })).rejects.toThrow('不完整');
  });
});
