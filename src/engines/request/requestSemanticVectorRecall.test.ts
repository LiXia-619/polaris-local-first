import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import type { MemorySemanticPreparedChunk } from '../memorySemanticPreparation';
import type { MemoryVectorIndexEmbedding } from '../memoryVectorIndexStorage';
import type { ProviderProfile } from '../../types/domain';

const persistence = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const kvKeys = vi.fn(async () => [...values.keys()]);
  const kvKeysWithPrefix = vi.fn(async (prefix: string) => [...values.keys()].filter((key) => key.startsWith(prefix)));
  const kvGet = vi.fn(async (key: string) => values.get(key) ?? null);
  const kvApplyMutations = vi.fn(async (mutations: Array<{
    type: 'set' | 'delete';
    key: string;
    value?: unknown;
  }>) => {
    for (const mutation of mutations) {
      if (mutation.type === 'set') {
        values.set(mutation.key, mutation.value);
      } else {
        values.delete(mutation.key);
      }
    }
  });
  return {
    values,
    kvKeys,
    kvKeysWithPrefix,
    kvGet,
    kvApplyMutations
  };
});

vi.mock('../../infrastructure/persistence', () => ({
  kvKeys: persistence.kvKeys,
  kvKeysWithPrefix: persistence.kvKeysWithPrefix,
  kvGet: persistence.kvGet,
  kvApplyMutations: persistence.kvApplyMutations
}));

import { replaceMemoryVectorIndexEntries } from '../memoryVectorIndexStorage';
import { resolveRequestSemanticVectorCandidates } from './requestSemanticVectorRecall';

const embeddingProvider: ProviderProfile = {
  id: 'embedding-provider',
  name: 'Embedding Provider',
  protocol: 'openai-completions',
  baseUrl: 'https://example.test/v1',
  path: '/chat/completions',
  apiKey: 'sk-test',
  model: 'text-embedding-test',
  capabilities: {
    images: false,
    streaming: true,
    thinking: false
  }
};
const vectorProviderId = `memory-vector:${embeddingProvider.baseUrl}:/embeddings`;
const memoryVectorRetrieval = {
  enabled: true,
  baseUrl: embeddingProvider.baseUrl,
  path: '/embeddings',
  apiKey: embeddingProvider.apiKey,
  model: embeddingProvider.model,
  dimensions: 2,
  lastUpdatedAt: 0
};

function preparedChunk(seed: {
  sourceChunkId: string;
  conversationId?: string;
  sourceMessageIds?: string[];
  semanticText: string;
  updatedAt: number;
}): MemorySemanticPreparedChunk {
  return {
    id: `memory-semantic-preparation:${seed.sourceChunkId}`,
    sourceChunkId: seed.sourceChunkId,
    kind: 'dialogue_turn',
    collaboratorId: 'pharos',
    conversationId: seed.conversationId ?? 'conversation-1',
    conversationTitle: '向量索引讨论',
    sourceMessageIds: seed.sourceMessageIds ?? ['u1'],
    sourceRefs: [{
      conversationId: seed.conversationId ?? 'conversation-1',
      messageId: seed.sourceMessageIds?.[0] ?? 'u1',
      role: 'user',
      timestamp: seed.updatedAt
    }],
    title: '跨对话向量边界',
    keywords: ['跨对话', '向量索引'],
    summary: '用户希望向量索引后台整理，前台请求只做轻量召回。',
    semanticText: seed.semanticText,
    sourceCharCount: seed.semanticText.length,
    generator: 'small_model',
    generatedAt: 100,
    createdAt: 1,
    updatedAt: seed.updatedAt
  };
}

describe('resolveRequestSemanticVectorCandidates', () => {
  beforeEach(() => {
    persistence.values.clear();
    persistence.kvKeys.mockClear();
    persistence.kvKeysWithPrefix.mockClear();
    persistence.kvGet.mockClear();
    persistence.kvApplyMutations.mockClear();
  });

  it('embeds the current query and returns source-backed vector candidates', async () => {
    const model = {
      providerId: vectorProviderId,
      model: embeddingProvider.model,
      dimensions: 2
    };
    const embedding: MemoryVectorIndexEmbedding = {
      ...model,
      vector: [1, 0],
      embeddedAt: 200
    };
    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        preparedChunk({
          sourceChunkId: 'chunk-background',
          semanticText: '向量索引应该后台整理，前台对话不要被卡住。',
          updatedAt: 20
        })
      ],
      model,
      embeddingsBySourceChunkId: new Map([['chunk-background', embedding]]),
      now: 300
    });
    const persona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '灯塔',
      memory: {
        vectorIndex: {
          enabled: true,
          dimensions: 2
        }
      }
    });
    const requestEmbeddings = vi.fn(async () => [[1, 0]]);

    const candidates = await resolveRequestSemanticVectorCandidates({
      persona,
      providers: [embeddingProvider],
      globalApi: embeddingProvider,
      memoryVectorRetrieval,
      queryText: '语义索引会不会卡前台',
      activeConversationId: 'active',
      catalogConversationIds: ['conversation-1'],
      maxResults: 1,
      requestEmbeddings
    });

    expect(requestEmbeddings).toHaveBeenCalledWith(expect.objectContaining({
      api: expect.objectContaining({
        baseUrl: embeddingProvider.baseUrl,
        apiKey: embeddingProvider.apiKey,
        model: embeddingProvider.model,
        path: '/embeddings'
      }),
      model: embeddingProvider.model,
      dimensions: 2,
      inputs: ['语义索引会不会卡前台']
    }));
    expect(candidates).toEqual([
      expect.objectContaining({
        id: 'recall:vector_match:conversation-1:chunk-background',
        kind: 'vector_match',
        sourceConversationId: 'conversation-1',
        sourceMessageIds: ['u1'],
        score: 1
      })
    ]);
    expect(JSON.stringify(candidates)).not.toContain('前台对话不要被卡住');
  });

  it('does not query embeddings when the stored index belongs to another model', async () => {
    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        preparedChunk({
          sourceChunkId: 'chunk-old-model',
          semanticText: '旧模型生成的索引不能混用。',
          updatedAt: 20
        })
      ],
      model: {
        providerId: embeddingProvider.id,
        model: 'old-embedding-model',
        dimensions: 2
      },
      embeddingsBySourceChunkId: new Map([[
        'chunk-old-model',
        {
          providerId: embeddingProvider.id,
          model: 'old-embedding-model',
          dimensions: 2,
          vector: [1, 0],
          embeddedAt: 200
        }
      ]]),
      now: 300
    });
    const persona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '灯塔',
      memory: {
        vectorIndex: {
          enabled: true,
          dimensions: 2
        }
      }
    });
    const requestEmbeddings = vi.fn(async () => [[1, 0]]);

    await expect(resolveRequestSemanticVectorCandidates({
      persona,
      providers: [embeddingProvider],
      globalApi: embeddingProvider,
      memoryVectorRetrieval,
      queryText: '语义索引',
      activeConversationId: 'active',
      catalogConversationIds: ['conversation-1'],
      maxResults: 1,
      requestEmbeddings
    })).resolves.toEqual([]);
    expect(requestEmbeddings).not.toHaveBeenCalled();
  });

  it('uses embedded rows from a partially embedded stored vector index', async () => {
    const model = {
      providerId: vectorProviderId,
      model: embeddingProvider.model,
      dimensions: 2
    };
    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        preparedChunk({
          sourceChunkId: 'chunk-embedded',
          semanticText: '这一片已经有 embedding。',
          updatedAt: 20
        }),
        preparedChunk({
          sourceChunkId: 'chunk-prepared-only',
          semanticText: '这一片还没有 embedding，整个索引不能假装 ready。',
          updatedAt: 21
        })
      ],
      model,
      embeddingsBySourceChunkId: new Map([[
        'chunk-embedded',
        {
          ...model,
          vector: [1, 0],
          embeddedAt: 200
        }
      ]]),
      now: 300
    });
    const persona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '灯塔',
      memory: {
        vectorIndex: {
          enabled: true,
          dimensions: 2
        }
      }
    });
    const requestEmbeddings = vi.fn(async () => [[1, 0]]);

    const candidates = await resolveRequestSemanticVectorCandidates({
      persona,
      providers: [embeddingProvider],
      globalApi: embeddingProvider,
      memoryVectorRetrieval,
      queryText: '语义索引',
      activeConversationId: 'active',
      catalogConversationIds: ['conversation-1'],
      maxResults: 1,
      requestEmbeddings
    });

    expect(requestEmbeddings).toHaveBeenCalledWith(expect.objectContaining({
      inputs: ['语义索引']
    }));
    expect(candidates).toEqual([
      expect.objectContaining({
        id: 'recall:vector_match:conversation-1:chunk-embedded',
        kind: 'vector_match',
        sourceConversationId: 'conversation-1',
        sourceMessageIds: ['u1'],
        score: 1
      })
    ]);
    expect(JSON.stringify(candidates)).not.toContain('chunk-prepared-only');
  });

  it('filters ready vector entries through the current conversation catalog before recall', async () => {
    const model = {
      providerId: vectorProviderId,
      model: embeddingProvider.model,
      dimensions: 2
    };
    const embedding: MemoryVectorIndexEmbedding = {
      ...model,
      vector: [1, 0],
      embeddedAt: 200
    };
    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        preparedChunk({
          sourceChunkId: 'chunk-live',
          conversationId: 'conversation-live',
          semanticText: '当前目录仍承认的旧对话可以进入语义召回。',
          updatedAt: 30
        }),
        preparedChunk({
          sourceChunkId: 'chunk-deleted',
          conversationId: 'conversation-deleted',
          semanticText: '已经从当前目录移除的旧对话不能靠向量索引复活。',
          updatedAt: 40
        })
      ],
      model,
      embeddingsBySourceChunkId: new Map([
        ['chunk-live', embedding],
        ['chunk-deleted', embedding]
      ]),
      now: 300
    });
    const persona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '灯塔',
      memory: {
        vectorIndex: {
          enabled: true,
          dimensions: 2
        }
      }
    });
    const requestEmbeddings = vi.fn(async () => [[1, 0]]);

    const candidates = await resolveRequestSemanticVectorCandidates({
      persona,
      providers: [embeddingProvider],
      globalApi: embeddingProvider,
      memoryVectorRetrieval,
      queryText: '语义召回目录白名单',
      activeConversationId: null,
      catalogConversationIds: ['conversation-live'],
      maxResults: 5,
      requestEmbeddings
    });

    expect(candidates.map((candidate) => candidate.sourceConversationId)).toEqual(['conversation-live']);
    expect(JSON.stringify(candidates)).not.toContain('conversation-deleted');
  });
});
