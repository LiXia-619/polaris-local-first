import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemorySemanticPreparedChunk } from './memorySemanticPreparation';

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

vi.mock('../infrastructure/persistence', () => ({
  kvKeys: persistence.kvKeys,
  kvKeysWithPrefix: persistence.kvKeysWithPrefix,
  kvGet: persistence.kvGet,
  kvApplyMutations: persistence.kvApplyMutations
}));

import {
  clearMemoryVectorIndexForCollaborator,
  createMemoryVectorIndexEntry,
  deleteMemoryVectorIndexEntriesForConversation,
  MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
  memoryVectorIndexEntryKey,
  memoryVectorIndexMetadataKey,
  readMemoryVectorIndexEntries,
  readMemoryVectorIndexMetadata,
  replaceMemoryVectorIndexEntries,
  resolveMemoryVectorIndexModelIdentity,
  resolveMemoryVectorIndexStorageStatus,
  upsertMemoryVectorIndexEntries
} from './memoryVectorIndexStorage';

function preparedChunk(seed: {
  sourceChunkId: string;
  updatedAt: number;
}): MemorySemanticPreparedChunk {
  return {
    id: `memory-semantic-preparation:${seed.sourceChunkId}`,
    sourceChunkId: seed.sourceChunkId,
    kind: 'dialogue_turn',
    collaboratorId: 'pharos',
    conversationId: 'conversation-1',
    conversationTitle: '向量索引讨论',
    sourceMessageIds: ['u1', 'a1'],
    sourceRefs: [
      {
        conversationId: 'conversation-1',
        messageId: 'u1',
        role: 'user',
        timestamp: 1
      },
      {
        conversationId: 'conversation-1',
        messageId: 'a1',
        role: 'assistant',
        timestamp: 2
      }
    ],
    title: '跨对话向量边界',
    keywords: ['跨对话', '向量索引'],
    summary: '用户希望向量索引只在跨对话开启时存在。',
    semanticText: '跨对话记忆开启时可以有向量索引，关闭后清理该协作者的索引状态。',
    sourceCharCount: 42,
    generator: 'small_model',
    generatedAt: 100,
    createdAt: 1,
    updatedAt: seed.updatedAt
  };
}

describe('memoryVectorIndexStorage', () => {
  beforeEach(() => {
    persistence.values.clear();
    persistence.kvKeys.mockClear();
    persistence.kvKeysWithPrefix.mockClear();
    persistence.kvGet.mockClear();
    persistence.kvApplyMutations.mockClear();
  });

  it('replaces collaborator index entries and stores metadata outside persona state', async () => {
    const model = {
      providerId: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536
    };
    const metadata = await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        preparedChunk({ sourceChunkId: 'chunk-1', updatedAt: 10 }),
        preparedChunk({ sourceChunkId: 'chunk-2', updatedAt: 20 })
      ],
      model,
      now: 200
    });

    expect(metadata).toEqual({
      version: 1,
      schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
      collaboratorId: 'pharos',
      model,
      entryCount: 2,
      embeddedCount: 0,
      updatedAt: 200
    });
    expect(persistence.values.has(memoryVectorIndexMetadataKey('pharos'))).toBe(true);
    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'chunk-1'))).toBe(true);

    const entries = await readMemoryVectorIndexEntries('pharos');
    expect(entries.map((entry) => entry.sourceChunkId)).toEqual(['chunk-2', 'chunk-1']);
    expect(entries[0]).toMatchObject({
      version: 1,
      collaboratorId: 'pharos',
      conversationId: 'conversation-1',
      sourceMessageIds: ['u1', 'a1'],
      semanticText: '跨对话记忆开启时可以有向量索引，关闭后清理该协作者的索引状态。'
    });
    expect(entries[0]?.sourceRefs.map((ref) => ref.messageId)).toEqual(['u1', 'a1']);
    expect(await readMemoryVectorIndexMetadata('pharos')).toEqual(metadata);
  });

  it('clears stale collaborator rows when replacing while leaving other collaborators alone', async () => {
    persistence.values.set(memoryVectorIndexEntryKey('pharos', 'old-chunk'), {
      version: 1,
      collaboratorId: 'pharos',
      sourceChunkId: 'old-chunk',
      conversationId: 'old',
      sourceMessageIds: [],
      semanticText: 'stale',
      updatedAt: 1
    });
    persistence.values.set(memoryVectorIndexEntryKey('nova', 'other-chunk'), {
      version: 1,
      collaboratorId: 'nova',
      sourceChunkId: 'other-chunk',
      conversationId: 'other',
      sourceMessageIds: [],
      semanticText: 'other',
      updatedAt: 1
    });

    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [preparedChunk({ sourceChunkId: 'new-chunk', updatedAt: 10 })],
      model: null,
      now: 20
    });

    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'old-chunk'))).toBe(false);
    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'new-chunk'))).toBe(true);
    expect(persistence.values.has(memoryVectorIndexEntryKey('nova', 'other-chunk'))).toBe(true);
  });

  it('clears all vector index storage for one collaborator', async () => {
    persistence.values.set(memoryVectorIndexMetadataKey('pharos'), { version: 1 });
    persistence.values.set(memoryVectorIndexEntryKey('pharos', 'chunk-1'), { version: 1 });
    persistence.values.set(memoryVectorIndexEntryKey('nova', 'chunk-1'), { version: 1 });

    await clearMemoryVectorIndexForCollaborator('pharos');

    expect(persistence.values.has(memoryVectorIndexMetadataKey('pharos'))).toBe(false);
    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'chunk-1'))).toBe(false);
    expect(persistence.values.has(memoryVectorIndexEntryKey('nova', 'chunk-1'))).toBe(true);
  });

  it('deletes entries for a removed conversation and invalidates affected metadata', async () => {
    const model = {
      providerId: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536
    };
    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        preparedChunk({ sourceChunkId: 'removed-conversation', updatedAt: 10 }),
        {
          ...preparedChunk({ sourceChunkId: 'kept-conversation', updatedAt: 20 }),
          conversationId: 'conversation-2'
        }
      ],
      model,
      now: 200
    });

    const result = await deleteMemoryVectorIndexEntriesForConversation('conversation-1');

    expect(result).toEqual({
      deletedEntryCount: 1,
      affectedCollaboratorIds: ['pharos']
    });
    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'removed-conversation'))).toBe(false);
    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'kept-conversation'))).toBe(true);
    expect(persistence.values.has(memoryVectorIndexMetadataKey('pharos'))).toBe(false);
  });

  it('resolves storage status from settings, model identity, and embedded counts', () => {
    const settings = {
      enabled: true,
      providerId: 'openai',
      modelOverride: 'text-embedding-3-small',
      dimensions: 1536
    };
    const model = resolveMemoryVectorIndexModelIdentity(settings);

    expect(resolveMemoryVectorIndexStorageStatus({
      settings: { ...settings, enabled: false },
      metadata: null
    })).toBe('disabled');
    expect(resolveMemoryVectorIndexStorageStatus({
      settings: { enabled: true },
      metadata: null
    })).toBe('missing_model');
    expect(resolveMemoryVectorIndexStorageStatus({
      settings,
      metadata: null
    })).toBe('empty');
    expect(resolveMemoryVectorIndexStorageStatus({
      settings,
      metadata: {
        version: 1,
        schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
        collaboratorId: 'pharos',
        model,
        entryCount: 2,
        embeddedCount: 0,
        updatedAt: 1
      }
    })).toBe('prepared');
    expect(resolveMemoryVectorIndexStorageStatus({
      settings,
      metadata: {
        version: 1,
        schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
        collaboratorId: 'pharos',
        model,
        entryCount: 2,
        embeddedCount: 2,
        updatedAt: 1
      }
    })).toBe('ready');
    expect(resolveMemoryVectorIndexStorageStatus({
      settings: { ...settings, modelOverride: 'other-model' },
      metadata: {
        version: 1,
        schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
        collaboratorId: 'pharos',
        model,
        entryCount: 2,
        embeddedCount: 2,
        updatedAt: 1
      }
    })).toBe('needs_rebuild');
  });

  it('creates entries with embeddings without letting the prepared chunk own vector identity', () => {
    const entry = createMemoryVectorIndexEntry({
      collaboratorId: 'pharos',
      preparedChunk: preparedChunk({ sourceChunkId: 'chunk-1', updatedAt: 10 }),
      embedding: {
        providerId: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        vector: [0.1, 0.2],
        embeddedAt: 300
      }
    });

    expect(entry.embedding).toEqual({
      providerId: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      vector: [0.1, 0.2],
      embeddedAt: 300
    });
    expect(entry.sourceRefs.map((ref) => ref.messageId)).toEqual(['u1', 'a1']);
  });

  it('stores embedding rows when replacement receives vectors by source chunk id', async () => {
    const prepared = preparedChunk({ sourceChunkId: 'chunk-1', updatedAt: 10 });

    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [prepared],
      model: {
        providerId: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 3
      },
      embeddingsBySourceChunkId: new Map([[
        prepared.sourceChunkId,
        {
          providerId: 'openai',
          model: 'text-embedding-3-small',
          dimensions: 3,
          vector: [0.1, 0.2, 0.3],
          embeddedAt: 400
        }
      ]]),
      now: 500
    });

    expect(await readMemoryVectorIndexMetadata('pharos')).toMatchObject({
      entryCount: 1,
      embeddedCount: 1
    });
    expect((await readMemoryVectorIndexEntries('pharos'))[0]?.embedding).toEqual({
      providerId: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 3,
      vector: [0.1, 0.2, 0.3],
      embeddedAt: 400
    });
  });

  it('upserts partial rows for resumable indexing and prunes stale source chunks', async () => {
    const model = {
      providerId: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 3
    };
    const completed = preparedChunk({ sourceChunkId: 'completed', updatedAt: 10 });
    const next = preparedChunk({ sourceChunkId: 'next', updatedAt: 20 });
    await replaceMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      preparedChunks: [
        completed,
        preparedChunk({ sourceChunkId: 'stale', updatedAt: 5 })
      ],
      model,
      embeddingsBySourceChunkId: new Map([[
        completed.sourceChunkId,
        {
          ...model,
          vector: [0.9, 0.8, 0.7],
          embeddedAt: 100
        }
      ]]),
      now: 100
    });

    const metadata = await upsertMemoryVectorIndexEntries({
      collaboratorId: 'pharos',
      allSourceChunkIds: ['completed', 'next'],
      preparedChunks: [next],
      model,
      embeddingsBySourceChunkId: new Map([[
        next.sourceChunkId,
        {
          ...model,
          vector: [0.1, 0.2, 0.3],
          embeddedAt: 200
        }
      ]]),
      now: 200
    });

    expect(metadata).toMatchObject({
      entryCount: 2,
      embeddedCount: 2,
      updatedAt: 200
    });
    expect(persistence.values.has(memoryVectorIndexEntryKey('pharos', 'stale'))).toBe(false);
    expect((await readMemoryVectorIndexEntries('pharos')).map((entry) => entry.sourceChunkId).sort()).toEqual([
      'completed',
      'next'
    ]);
  });
});
