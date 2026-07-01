import { describe, expect, it } from 'vitest';
import type { MemoryVectorIndexEntry, MemoryVectorIndexModelIdentity } from './memoryVectorIndexStorage';
import { cosineSimilarity, searchMemoryVectorIndexEntries } from './memoryVectorIndexSearch';

const model: MemoryVectorIndexModelIdentity = {
  providerId: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 3
};

function entry(seed: {
  id: string;
  conversationId: string;
  updatedAt: number;
  vector?: number[];
  model?: MemoryVectorIndexModelIdentity;
  title?: string;
  keywords?: string[];
  summary?: string;
  semanticText?: string;
}): MemoryVectorIndexEntry {
  return {
    version: 1,
    collaboratorId: 'pharos',
    sourceChunkId: seed.id,
    kind: 'dialogue_turn',
    conversationId: seed.conversationId,
    conversationTitle: '向量记忆讨论',
    sourceMessageIds: [`${seed.id}-u`, `${seed.id}-a`],
    sourceRefs: [
      {
        conversationId: seed.conversationId,
        messageId: `${seed.id}-u`,
        role: 'user',
        timestamp: seed.updatedAt - 1
      },
      {
        conversationId: seed.conversationId,
        messageId: `${seed.id}-a`,
        role: 'assistant',
        timestamp: seed.updatedAt
      }
    ],
    title: seed.title ?? '跨对话向量索引',
    keywords: seed.keywords ?? ['跨对话', '向量索引'],
    summary: seed.summary ?? '用户希望跨对话向量索引能后台工作。',
    semanticText: seed.semanticText ?? '跨对话记忆开启后，向量索引在后台准备语义搜索材料。',
    sourceCharCount: 42,
    generator: 'small_model',
    generatedAt: 100,
    createdAt: 1,
    updatedAt: seed.updatedAt,
    ...(seed.vector ? {
      embedding: {
        ...(seed.model ?? model),
        vector: seed.vector,
        embeddedAt: seed.updatedAt
      }
    } : {})
  };
}

describe('memoryVectorIndexSearch', () => {
  it('computes cosine similarity only for valid vectors in the same dimension', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1], [1, 0])).toBeNull();
    expect(cosineSimilarity([], [])).toBeNull();
    expect(cosineSimilarity([0, 0], [1, 0])).toBeNull();
    expect(cosineSimilarity([Number.NaN], [1])).toBeNull();
  });

  it('searches only embedded entries from the same vector model outside the active conversation', () => {
    const results = searchMemoryVectorIndexEntries({
      entries: [
        entry({ id: 'ready', conversationId: 'old', updatedAt: 10, vector: [1, 0, 0] }),
        entry({ id: 'current', conversationId: 'current', updatedAt: 20, vector: [1, 0, 0] }),
        entry({ id: 'not-embedded', conversationId: 'old', updatedAt: 30 }),
        entry({
          id: 'other-model',
          conversationId: 'old',
          updatedAt: 40,
          vector: [1, 0, 0],
          model: { ...model, model: 'other-embedding-model' }
        }),
        entry({ id: 'bad-dimensions', conversationId: 'old', updatedAt: 50, vector: [1, 0] })
      ],
      queryEmbedding: [1, 0, 0],
      model,
      activeConversationId: 'current'
    });

    expect(results.map((result) => result.entry.sourceChunkId)).toEqual(['ready']);
    expect(results[0]).toMatchObject({
      score: 1,
      matchKind: 'vector_similarity',
      authority: 'semantic_clue'
    });
    expect(results[0]?.entry.sourceRefs.map((ref) => ref.messageId)).toEqual(['ready-u', 'ready-a']);
  });

  it('sorts by vector score, then recency, then source chunk id', () => {
    const results = searchMemoryVectorIndexEntries({
      entries: [
        entry({ id: 'low', conversationId: 'old', updatedAt: 100, vector: [0, 1, 0] }),
        entry({ id: 'older-same-score', conversationId: 'old', updatedAt: 10, vector: [1, 0, 0] }),
        entry({ id: 'newer-same-score', conversationId: 'old', updatedAt: 20, vector: [1, 0, 0] }),
        entry({ id: 'z-same-time', conversationId: 'old', updatedAt: 20, vector: [1, 0, 0] })
      ],
      queryEmbedding: [1, 0, 0],
      model
    });

    expect(results.map((result) => result.entry.sourceChunkId)).toEqual([
      'z-same-time',
      'newer-same-score',
      'older-same-score',
      'low'
    ]);
  });

  it('reports keyword overlap without changing vector authority', () => {
    const results = searchMemoryVectorIndexEntries({
      entries: [
        entry({
          id: 'semantic',
          conversationId: 'old',
          updatedAt: 10,
          vector: [1, 0, 0],
          keywords: ['语义索引', '后台'],
          semanticText: '语义索引应该在后台处理，不要卡住前台聊天。'
        })
      ],
      queryEmbedding: [1, 0, 0],
      queryText: '语义索引会不会卡住前台',
      model
    });

    expect(results[0]?.matchedKeywords).toContain('语义');
    expect(results[0]?.matchedKeywords).toContain('前台');
    expect(results[0]?.authority).toBe('semantic_clue');
  });

  it('applies a limit only when the caller provides one', () => {
    const entries = [
      entry({ id: 'first', conversationId: 'old', updatedAt: 10, vector: [1, 0, 0] }),
      entry({ id: 'second', conversationId: 'old', updatedAt: 20, vector: [0.8, 0.2, 0] })
    ];

    expect(searchMemoryVectorIndexEntries({
      entries,
      queryEmbedding: [1, 0, 0],
      model
    })).toHaveLength(2);
    expect(searchMemoryVectorIndexEntries({
      entries,
      queryEmbedding: [1, 0, 0],
      model,
      limit: 1
    })).toHaveLength(1);
  });
});
