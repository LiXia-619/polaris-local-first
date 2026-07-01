import { describe, expect, it } from 'vitest';
import { createPersonaTemplate } from '../config/persona/personaBuilder';
import { MEMORY_VECTOR_INDEX_SCHEMA_VERSION, type MemoryVectorIndexMetadata } from '../engines/memoryVectorIndexStorage';
import { reconcilePersonaVectorIndexStatusesAfterImport } from './personaStoreVectorIndex';

describe('reconcilePersonaVectorIndexStatusesAfterImport', () => {
  it('marks imported ready-looking vector settings for rebuild when vector rows are missing', async () => {
    const persona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '',
      memory: {
        vectorIndex: {
          enabled: true,
          providerId: 'openai',
          modelOverride: 'text-embedding-3-small',
          dimensions: 1536,
          status: 'idle',
          indexedChunkCount: 12,
          totalChunkCount: 12,
          lastIndexedAt: 100,
          lastError: ''
        }
      }
    });

    const result = await reconcilePersonaVectorIndexStatusesAfterImport([persona], async () => null);

    expect(result.changed).toBe(true);
    expect(result.personas[0]?.memory.vectorIndex).toMatchObject({
      enabled: true,
      providerId: 'openai',
      modelOverride: 'text-embedding-3-small',
      status: 'needs_rebuild',
      indexedChunkCount: 0,
      totalChunkCount: 0,
      lastError: '向量索引需要重新整理。'
    });
  });

  it('keeps ready status aligned with imported vector metadata when rows exist', async () => {
    const persona = createPersonaTemplate({
      id: 'pharos',
      name: 'Pharos',
      description: '',
      memory: {
        vectorIndex: {
          enabled: true,
          providerId: 'openai',
          modelOverride: 'text-embedding-3-small',
          dimensions: 1536,
          status: 'needs_rebuild',
          indexedChunkCount: 0,
          totalChunkCount: 0,
          lastError: '旧错误'
        }
      }
    });
    const metadata: MemoryVectorIndexMetadata = {
      version: 1,
      schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
      collaboratorId: 'pharos',
      model: {
        providerId: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536
      },
      entryCount: 3,
      embeddedCount: 3,
      updatedAt: 200
    };

    const result = await reconcilePersonaVectorIndexStatusesAfterImport([persona], async () => metadata);

    expect(result.changed).toBe(true);
    expect(result.personas[0]?.memory.vectorIndex).toMatchObject({
      status: 'idle',
      indexedChunkCount: 3,
      totalChunkCount: 3,
      lastError: ''
    });
  });
});
