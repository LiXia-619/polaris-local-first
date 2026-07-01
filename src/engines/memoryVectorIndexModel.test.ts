import { describe, expect, it } from 'vitest';
import type { ProviderProfile } from '../types/domain';
import {
  resolveMemoryVectorIndexRuntimeModel,
  selectMemoryVectorIndexProvider
} from './memoryVectorIndexModel';

const globalApi: ProviderProfile = {
  id: 'global',
  name: 'Global',
  protocol: 'openai-completions',
  baseUrl: 'https://global.test/v1',
  path: '/chat/completions',
  apiKey: 'sk-global',
  model: 'global-embedding',
  capabilities: {
    images: false,
    streaming: true,
    thinking: false
  }
};

describe('memoryVectorIndexModel', () => {
  it('builds a dedicated embedding provider from vector settings', () => {
    expect(selectMemoryVectorIndexProvider({
      settings: {
        enabled: true,
        baseUrl: 'https://embedding.test/v1',
        path: '/embeddings',
        apiKey: 'sk-vector',
        model: 'text-embedding-3-small',
        dimensions: 1536
      },
      providers: [],
      globalApi
    })).toMatchObject({
      id: 'memory-vector:https://embedding.test/v1:/embeddings',
      name: '向量模型',
      protocol: 'openai-completions',
      baseUrl: 'https://embedding.test/v1',
      path: '/embeddings',
      apiKey: 'sk-vector',
      model: 'text-embedding-3-small'
    });
  });

  it('does not use the global chat provider when vector model is not configured', () => {
    expect(resolveMemoryVectorIndexRuntimeModel({
      settings: {
        enabled: true,
        dimensions: 1536
      },
      providers: [],
      globalApi
    })).toBeNull();
  });

  it('requires the dedicated vector switch to be enabled', () => {
    expect(selectMemoryVectorIndexProvider({
      settings: {
        enabled: false,
        baseUrl: 'https://embedding.test/v1',
        path: '/embeddings',
        apiKey: 'sk-vector',
        model: 'text-embedding-3-small'
      },
      providers: [],
      globalApi
    })).toBeNull();
  });

  it('uses the dedicated vector model identity for rebuild checks', () => {
    expect(resolveMemoryVectorIndexRuntimeModel({
      settings: {
        enabled: true,
        baseUrl: 'https://embedding.test/v1',
        path: '/embeddings',
        apiKey: 'sk-vector',
        model: 'text-embedding-3-small',
        dimensions: null
      },
      providers: [],
      globalApi
    })).toEqual({
      providerId: 'memory-vector:https://embedding.test/v1:/embeddings',
      model: 'text-embedding-3-small',
      dimensions: null
    });
  });
});
