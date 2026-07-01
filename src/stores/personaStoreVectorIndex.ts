import {
  readMemoryVectorIndexMetadata,
  resolveMemoryVectorIndexStorageStatus,
  type MemoryVectorIndexMetadata
} from '../engines/memoryVectorIndexStorage';
import type { Persona } from '../types/domain';

type ReadVectorMetadata = (collaboratorId: string) => Promise<MemoryVectorIndexMetadata | null>;

function needsVectorStatusPatch(persona: Persona, metadata: MemoryVectorIndexMetadata | null) {
  const vectorIndex = persona.memory.vectorIndex;
  if (vectorIndex?.enabled !== true) return null;

  const storageStatus = resolveMemoryVectorIndexStorageStatus({
    settings: vectorIndex,
    metadata
  });

  if (storageStatus === 'ready') {
    return {
      status: 'idle' as const,
      indexedChunkCount: metadata?.embeddedCount ?? 0,
      totalChunkCount: metadata?.entryCount ?? 0,
      lastError: ''
    };
  }

  if (storageStatus === 'missing_model') {
    return {
      status: 'failed' as const,
      indexedChunkCount: 0,
      totalChunkCount: 0,
      lastError: '向量索引缺少模型配置。'
    };
  }

  return {
    status: 'needs_rebuild' as const,
    indexedChunkCount: metadata?.embeddedCount ?? 0,
    totalChunkCount: metadata?.entryCount ?? 0,
    lastError: '向量索引需要重新整理。'
  };
}

export async function reconcilePersonaVectorIndexStatusesAfterImport(
  personas: Persona[],
  readMetadata: ReadVectorMetadata = readMemoryVectorIndexMetadata
) {
  let changed = false;
  const nextPersonas = await Promise.all(personas.map(async (persona) => {
    const metadata = await readMetadata(persona.id);
    const patch = needsVectorStatusPatch(persona, metadata);
    if (!patch) return persona;

    const current = persona.memory.vectorIndex;
    if (!current) return persona;
    if (
      current?.status === patch.status
      && current.indexedChunkCount === patch.indexedChunkCount
      && current.totalChunkCount === patch.totalChunkCount
      && (current.lastError ?? '') === patch.lastError
    ) {
      return persona;
    }

    changed = true;
    return {
      ...persona,
      memory: {
        ...persona.memory,
        vectorIndex: {
          ...current,
          ...patch
        }
      }
    };
  }));

  return {
    personas: nextPersonas,
    changed
  };
}
