import { kvApplyMutations, kvGet, kvKeysWithPrefix } from '../infrastructure/persistence';
import type { PersonaVectorIndexSettings } from '../types/domain';
import type { MemorySemanticPreparedChunk } from './memorySemanticPreparation';
import type { MemoryRetrievalChunk, MemoryRetrievalSourceRef } from './memoryRetrievalIndex';

export const MEMORY_VECTOR_INDEX_ENTRY_PREFIX = 'memory-vector-index-entry-v1:';
export const MEMORY_VECTOR_INDEX_META_PREFIX = 'memory-vector-index-meta-v1:';
export const MEMORY_VECTOR_INDEX_SCHEMA_VERSION = 1;

export type MemoryVectorIndexModelIdentity = {
  providerId: string;
  model: string;
  dimensions: number | null;
};

export type MemoryVectorIndexEmbedding = MemoryVectorIndexModelIdentity & {
  vector: number[];
  embeddedAt: number;
};

export type MemoryVectorIndexEntry = {
  version: 1;
  collaboratorId: string;
  sourceChunkId: string;
  kind: MemoryRetrievalChunk['kind'];
  conversationId: string;
  conversationTitle: string;
  sourceMessageIds: string[];
  sourceRefs: MemoryRetrievalSourceRef[];
  title: string;
  keywords: string[];
  summary: string;
  semanticText: string;
  sourceCharCount: number;
  generator: MemorySemanticPreparedChunk['generator'];
  generatedAt: number;
  createdAt: number;
  updatedAt: number;
  embedding?: MemoryVectorIndexEmbedding;
};

export type MemoryVectorIndexMetadata = {
  version: 1;
  schemaVersion: typeof MEMORY_VECTOR_INDEX_SCHEMA_VERSION;
  collaboratorId: string;
  model: MemoryVectorIndexModelIdentity | null;
  entryCount: number;
  embeddedCount: number;
  updatedAt: number;
};

export type MemoryVectorIndexStorageStatus =
  | 'disabled'
  | 'missing_model'
  | 'empty'
  | 'prepared'
  | 'ready'
  | 'needs_rebuild';

function encodeKeyPart(value: string) {
  return encodeURIComponent(value);
}

function collaboratorEntryPrefix(collaboratorId: string) {
  return `${MEMORY_VECTOR_INDEX_ENTRY_PREFIX}${encodeKeyPart(collaboratorId)}:`;
}

export function memoryVectorIndexEntryKey(collaboratorId: string, sourceChunkId: string) {
  return `${collaboratorEntryPrefix(collaboratorId)}${encodeKeyPart(sourceChunkId)}`;
}

export function memoryVectorIndexMetadataKey(collaboratorId: string) {
  return `${MEMORY_VECTOR_INDEX_META_PREFIX}${encodeKeyPart(collaboratorId)}`;
}

export function resolveMemoryVectorIndexModelIdentity(
  settings: Pick<PersonaVectorIndexSettings, 'providerId' | 'modelOverride' | 'dimensions'>
): MemoryVectorIndexModelIdentity | null {
  const providerId = settings.providerId?.trim();
  const model = settings.modelOverride?.trim();
  if (!providerId || !model) return null;
  return {
    providerId,
    model,
    dimensions: typeof settings.dimensions === 'number' && Number.isFinite(settings.dimensions)
      ? Math.floor(settings.dimensions)
      : null
  };
}

export function sameMemoryVectorIndexModelIdentity(
  left: MemoryVectorIndexModelIdentity | null,
  right: MemoryVectorIndexModelIdentity | null
) {
  if (!left || !right) return false;
  return left.providerId === right.providerId
    && left.model === right.model
    && left.dimensions === right.dimensions;
}

export function memoryVectorIndexEmbeddingMatchesModel(
  embedding: MemoryVectorIndexEmbedding | undefined,
  model: MemoryVectorIndexModelIdentity | null
) {
  if (!embedding || !model) return false;
  return sameMemoryVectorIndexModelIdentity(embedding, model);
}

export function memoryVectorIndexEntryHasEmbeddingForModel(
  entry: Pick<MemoryVectorIndexEntry, 'embedding'>,
  model: MemoryVectorIndexModelIdentity | null
) {
  return memoryVectorIndexEmbeddingMatchesModel(entry.embedding, model);
}

export function resolveMemoryVectorIndexStorageStatus(args: {
  settings: Pick<PersonaVectorIndexSettings, 'enabled' | 'providerId' | 'modelOverride' | 'dimensions'>;
  metadata: MemoryVectorIndexMetadata | null;
}): MemoryVectorIndexStorageStatus {
  if (args.settings.enabled !== true) return 'disabled';
  const model = resolveMemoryVectorIndexModelIdentity(args.settings);
  if (!model) return 'missing_model';
  if (!args.metadata || args.metadata.entryCount <= 0) return 'empty';
  if (args.metadata.schemaVersion !== MEMORY_VECTOR_INDEX_SCHEMA_VERSION) return 'needs_rebuild';
  if (!sameMemoryVectorIndexModelIdentity(model, args.metadata.model)) return 'needs_rebuild';
  if (args.metadata.embeddedCount <= 0) return 'prepared';
  if (args.metadata.embeddedCount < args.metadata.entryCount) return 'prepared';
  return 'ready';
}

export function createMemoryVectorIndexEntry(args: {
  collaboratorId: string;
  preparedChunk: MemorySemanticPreparedChunk;
  embedding?: MemoryVectorIndexEmbedding;
}): MemoryVectorIndexEntry {
  return {
    version: 1,
    collaboratorId: args.collaboratorId,
    sourceChunkId: args.preparedChunk.sourceChunkId,
    kind: args.preparedChunk.kind,
    conversationId: args.preparedChunk.conversationId,
    conversationTitle: args.preparedChunk.conversationTitle,
    sourceMessageIds: args.preparedChunk.sourceMessageIds,
    sourceRefs: args.preparedChunk.sourceRefs,
    title: args.preparedChunk.title,
    keywords: args.preparedChunk.keywords,
    summary: args.preparedChunk.summary,
    semanticText: args.preparedChunk.semanticText,
    sourceCharCount: args.preparedChunk.sourceCharCount,
    generator: args.preparedChunk.generator,
    generatedAt: args.preparedChunk.generatedAt,
    createdAt: args.preparedChunk.createdAt,
    updatedAt: args.preparedChunk.updatedAt,
    ...(args.embedding ? { embedding: args.embedding } : {})
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredEntry(value: unknown): value is MemoryVectorIndexEntry {
  return isPlainRecord(value)
    && value.version === 1
    && typeof value.collaboratorId === 'string'
    && typeof value.sourceChunkId === 'string'
    && typeof value.conversationId === 'string'
    && Array.isArray(value.sourceMessageIds)
    && typeof value.semanticText === 'string';
}

export function isMemoryVectorIndexEntry(value: unknown): value is MemoryVectorIndexEntry {
  return isStoredEntry(value);
}

function isStoredMetadata(value: unknown): value is MemoryVectorIndexMetadata {
  return isPlainRecord(value)
    && value.version === 1
    && value.schemaVersion === MEMORY_VECTOR_INDEX_SCHEMA_VERSION
    && typeof value.collaboratorId === 'string'
    && typeof value.entryCount === 'number'
    && typeof value.embeddedCount === 'number';
}

async function keysForCollaborator(collaboratorId: string) {
  const prefix = collaboratorEntryPrefix(collaboratorId);
  return [
    memoryVectorIndexMetadataKey(collaboratorId),
    ...(await kvKeysWithPrefix(prefix))
  ];
}

export async function readMemoryVectorIndexMetadata(collaboratorId: string) {
  const metadata = await kvGet<unknown>(memoryVectorIndexMetadataKey(collaboratorId));
  return isStoredMetadata(metadata) ? metadata : null;
}

export async function readMemoryVectorIndexEntries(collaboratorId: string): Promise<MemoryVectorIndexEntry[]> {
  const prefix = collaboratorEntryPrefix(collaboratorId);
  const keys = await kvKeysWithPrefix(prefix);
  const entries = await Promise.all(keys.map((key) => kvGet<unknown>(key)));
  return entries
    .filter(isStoredEntry)
    .sort((left, right) => {
      const updatedAtDelta = right.updatedAt - left.updatedAt;
      if (updatedAtDelta !== 0) return updatedAtDelta;
      return right.sourceChunkId.localeCompare(left.sourceChunkId);
    });
}

export async function readMemoryVectorIndexEntryRows(collaboratorId: string): Promise<Array<{
  key: string;
  value: unknown;
}>> {
  const prefix = collaboratorEntryPrefix(collaboratorId);
  const keys = await kvKeysWithPrefix(prefix);
  return await Promise.all(keys.map(async (key) => ({
    key,
    value: await kvGet<unknown>(key)
  })));
}

export async function clearMemoryVectorIndexForCollaborator(collaboratorId: string) {
  const keys = await keysForCollaborator(collaboratorId);
  await kvApplyMutations(keys.map((key) => ({ type: 'delete', key })));
}

export async function deleteMemoryVectorIndexEntriesForConversation(conversationId: string) {
  const keys = await kvKeysWithPrefix(MEMORY_VECTOR_INDEX_ENTRY_PREFIX);
  const entries = await Promise.all(keys.map(async (key) => ({
    key,
    value: await kvGet<unknown>(key)
  })));
  const affectedCollaboratorIds = new Set<string>();
  const entryKeysToDelete = entries.flatMap((entry) => {
    if (!isStoredEntry(entry.value) || entry.value.conversationId !== conversationId) return [];
    affectedCollaboratorIds.add(entry.value.collaboratorId);
    return [entry.key];
  });

  if (entryKeysToDelete.length === 0) {
    return {
      deletedEntryCount: 0,
      affectedCollaboratorIds: []
    };
  }

  await kvApplyMutations([
    ...entryKeysToDelete.map((key) => ({ type: 'delete' as const, key })),
    ...[...affectedCollaboratorIds].map((collaboratorId) => ({
      type: 'delete' as const,
      key: memoryVectorIndexMetadataKey(collaboratorId)
    }))
  ]);

  return {
    deletedEntryCount: entryKeysToDelete.length,
    affectedCollaboratorIds: [...affectedCollaboratorIds]
  };
}

export async function replaceMemoryVectorIndexEntries(args: {
  collaboratorId: string;
  preparedChunks: MemorySemanticPreparedChunk[];
  model: MemoryVectorIndexModelIdentity | null;
  embeddingsBySourceChunkId?: Map<string, MemoryVectorIndexEmbedding>;
  now: number;
}) {
  const existingKeys = await keysForCollaborator(args.collaboratorId);
  const entries = args.preparedChunks.map((preparedChunk) =>
    createMemoryVectorIndexEntry({
      collaboratorId: args.collaboratorId,
      preparedChunk,
      embedding: args.embeddingsBySourceChunkId?.get(preparedChunk.sourceChunkId)
    })
  );
  const metadata: MemoryVectorIndexMetadata = {
    version: 1,
    schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
    collaboratorId: args.collaboratorId,
    model: args.model,
    entryCount: entries.length,
    embeddedCount: entries.filter((entry) => Boolean(entry.embedding)).length,
    updatedAt: args.now
  };

  await kvApplyMutations([
    ...existingKeys.map((key) => ({ type: 'delete' as const, key })),
    ...entries.map((entry) => ({
      type: 'set' as const,
      key: memoryVectorIndexEntryKey(args.collaboratorId, entry.sourceChunkId),
      value: entry
    })),
    {
      type: 'set' as const,
      key: memoryVectorIndexMetadataKey(args.collaboratorId),
      value: metadata
    }
  ]);

  return metadata;
}

export type UpsertMemoryVectorIndexEntriesArgs = {
  collaboratorId: string;
  allSourceChunkIds: string[];
  preparedChunks: MemorySemanticPreparedChunk[];
  model: MemoryVectorIndexModelIdentity | null;
  embeddingsBySourceChunkId?: Map<string, MemoryVectorIndexEmbedding>;
  now: number;
};

export async function upsertMemoryVectorIndexEntries(args: UpsertMemoryVectorIndexEntriesArgs) {
  const expectedSourceChunkIds = new Set(args.allSourceChunkIds);
  const storedRows = await readMemoryVectorIndexEntryRows(args.collaboratorId);
  const staleKeys: string[] = [];
  const nextEntriesBySourceChunkId = new Map<string, MemoryVectorIndexEntry>();

  storedRows.forEach(({ key, value }) => {
    if (isStoredEntry(value) && expectedSourceChunkIds.has(value.sourceChunkId)) {
      nextEntriesBySourceChunkId.set(value.sourceChunkId, value);
      return;
    }
    staleKeys.push(key);
  });

  const entriesToUpsert = args.preparedChunks.map((preparedChunk) =>
    createMemoryVectorIndexEntry({
      collaboratorId: args.collaboratorId,
      preparedChunk,
      embedding: args.embeddingsBySourceChunkId?.get(preparedChunk.sourceChunkId)
    })
  );
  entriesToUpsert.forEach((entry) => {
    if (expectedSourceChunkIds.has(entry.sourceChunkId)) {
      nextEntriesBySourceChunkId.set(entry.sourceChunkId, entry);
    }
  });

  const metadata: MemoryVectorIndexMetadata = {
    version: 1,
    schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
    collaboratorId: args.collaboratorId,
    model: args.model,
    entryCount: expectedSourceChunkIds.size,
    embeddedCount: Array.from(nextEntriesBySourceChunkId.values())
      .filter((entry) => memoryVectorIndexEntryHasEmbeddingForModel(entry, args.model))
      .length,
    updatedAt: args.now
  };

  await kvApplyMutations([
    ...staleKeys.map((key) => ({ type: 'delete' as const, key })),
    ...entriesToUpsert.map((entry) => ({
      type: 'set' as const,
      key: memoryVectorIndexEntryKey(args.collaboratorId, entry.sourceChunkId),
      value: entry
    })),
    {
      type: 'set' as const,
      key: memoryVectorIndexMetadataKey(args.collaboratorId),
      value: metadata
    }
  ]);

  return metadata;
}

export async function writeMemoryVectorIndexEntryBatch(args: {
  collaboratorId: string;
  preparedChunks: MemorySemanticPreparedChunk[];
  model: MemoryVectorIndexModelIdentity | null;
  embeddingsBySourceChunkId?: Map<string, MemoryVectorIndexEmbedding>;
  staleKeys?: string[];
  entryCount: number;
  embeddedCount: number;
  now: number;
}) {
  const entriesToUpsert = args.preparedChunks.map((preparedChunk) =>
    createMemoryVectorIndexEntry({
      collaboratorId: args.collaboratorId,
      preparedChunk,
      embedding: args.embeddingsBySourceChunkId?.get(preparedChunk.sourceChunkId)
    })
  );
  const metadata: MemoryVectorIndexMetadata = {
    version: 1,
    schemaVersion: MEMORY_VECTOR_INDEX_SCHEMA_VERSION,
    collaboratorId: args.collaboratorId,
    model: args.model,
    entryCount: args.entryCount,
    embeddedCount: args.embeddedCount,
    updatedAt: args.now
  };

  await kvApplyMutations([
    ...(args.staleKeys ?? []).map((key) => ({ type: 'delete' as const, key })),
    ...entriesToUpsert.map((entry) => ({
      type: 'set' as const,
      key: memoryVectorIndexEntryKey(args.collaboratorId, entry.sourceChunkId),
      value: entry
    })),
    {
      type: 'set' as const,
      key: memoryVectorIndexMetadataKey(args.collaboratorId),
      value: metadata
    }
  ]);

  return metadata;
}
