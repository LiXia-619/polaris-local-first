import type { PersistedDbEntry } from '../persistence';
import { isPlainRecord } from './recordGuards';
import {
  COLLECTION_STATE_KEY,
  PERSONA_STATE_KEY,
  PERSONA_MEMORY_DOC_CONTENT_KEY,
  PERSONA_MEMORY_DOC_CONTENT_PREFIX,
  PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX,
  WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX,
  WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX
} from './storageKeys';

export type LocalPersonaMemoryDocHealth = {
  splitDocBodyCount: number;
  orphanedSplitDocBodyCount: number;
  chunkedDocBodyCount: number;
  chunkedDocBodyChunkCount: number;
  orphanedChunkedDocBodyCount: number;
  legacyDocBodyCount: number;
};

export type LocalWorkspaceReferenceDocHealth = {
  splitDocBodyCount: number;
  orphanedSplitDocBodyCount: number;
  chunkedDocBodyCount: number;
  chunkedDocBodyChunkCount: number;
  orphanedChunkedDocBodyCount: number;
};

function readPersonaMemoryDocKeys(value: unknown) {
  if (!isPlainRecord(value) || !Array.isArray(value.personas)) return [];

  return value.personas.reduce<string[]>((accumulator, persona) => {
    if (!isPlainRecord(persona) || typeof persona.id !== 'string' || !isPlainRecord(persona.memory)) return accumulator;
    const referenceDocs = persona.memory.referenceDocs;
    if (!Array.isArray(referenceDocs)) return accumulator;

    for (const doc of referenceDocs) {
      if (!isPlainRecord(doc) || typeof doc.id !== 'string') continue;
      accumulator.push(`${encodeURIComponent(persona.id)}:${encodeURIComponent(doc.id)}`);
    }
    return accumulator;
  }, []);
}

export function buildPersonaMemoryDocHealth(kv: PersistedDbEntry[]): LocalPersonaMemoryDocHealth {
  const byKey = new Map(kv.map((entry) => [entry.key, entry.value]));
  const knownDocKeys = new Set(readPersonaMemoryDocKeys(byKey.get(PERSONA_STATE_KEY)));
  const splitDocBodyKeys = kv
    .map((entry) => entry.key)
    .filter((key) => key.startsWith(PERSONA_MEMORY_DOC_CONTENT_PREFIX));
  const chunkedDocBodyKeys = new Set<string>();
  let chunkedDocBodyChunkCount = 0;
  kv.forEach((entry) => {
    if (!entry.key.startsWith(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX)) return;
    const chunkBody = entry.key.slice(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX.length);
    const separatorIndex = chunkBody.lastIndexOf(':');
    if (separatorIndex < 0) return;
    const docKey = chunkBody.slice(0, separatorIndex);
    if (!docKey) return;
    chunkedDocBodyKeys.add(docKey);
    chunkedDocBodyChunkCount += 1;
  });
  const legacyPayload = byKey.get(PERSONA_MEMORY_DOC_CONTENT_KEY);
  const legacyDocBodyCount =
    isPlainRecord(legacyPayload) && isPlainRecord(legacyPayload.docs)
      ? Object.keys(legacyPayload.docs).length
      : 0;

  return {
    splitDocBodyCount: splitDocBodyKeys.length,
    orphanedSplitDocBodyCount: splitDocBodyKeys.filter((key) => {
      const docKey = key.slice(PERSONA_MEMORY_DOC_CONTENT_PREFIX.length);
      return !knownDocKeys.has(docKey);
    }).length,
    chunkedDocBodyCount: chunkedDocBodyKeys.size,
    chunkedDocBodyChunkCount,
    orphanedChunkedDocBodyCount: [...chunkedDocBodyKeys].filter((docKey) => !knownDocKeys.has(docKey)).length,
    legacyDocBodyCount
  };
}

function readWorkspaceReferenceDocKeys(value: unknown) {
  if (!isPlainRecord(value) || !Array.isArray(value.workspaceReferenceDocs)) return [];

  return value.workspaceReferenceDocs.reduce<string[]>((accumulator, doc) => {
    if (isPlainRecord(doc) && typeof doc.id === 'string' && doc.id.trim().length > 0) {
      accumulator.push(encodeURIComponent(doc.id));
    }
    return accumulator;
  }, []);
}

export function buildWorkspaceReferenceDocHealth(kv: PersistedDbEntry[]): LocalWorkspaceReferenceDocHealth {
  const byKey = new Map(kv.map((entry) => [entry.key, entry.value]));
  const knownDocKeys = new Set(readWorkspaceReferenceDocKeys(byKey.get(COLLECTION_STATE_KEY)));
  const splitDocBodyKeys = kv
    .map((entry) => entry.key)
    .filter((key) => key.startsWith(WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX));
  const chunkedDocBodyKeys = new Set<string>();
  let chunkedDocBodyChunkCount = 0;
  kv.forEach((entry) => {
    if (!entry.key.startsWith(WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX)) return;
    const chunkBody = entry.key.slice(WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX.length);
    const separatorIndex = chunkBody.lastIndexOf(':');
    if (separatorIndex < 0) return;
    const docKey = chunkBody.slice(0, separatorIndex);
    if (!docKey) return;
    chunkedDocBodyKeys.add(docKey);
    chunkedDocBodyChunkCount += 1;
  });

  return {
    splitDocBodyCount: splitDocBodyKeys.length,
    orphanedSplitDocBodyCount: splitDocBodyKeys.filter((key) => {
      const docKey = key.slice(WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX.length);
      return !knownDocKeys.has(docKey);
    }).length,
    chunkedDocBodyCount: chunkedDocBodyKeys.size,
    chunkedDocBodyChunkCount,
    orphanedChunkedDocBodyCount: [...chunkedDocBodyKeys].filter((docKey) => !knownDocKeys.has(docKey)).length
  };
}
