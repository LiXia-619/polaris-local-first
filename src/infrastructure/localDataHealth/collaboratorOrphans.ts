import type { PersistedDbEntry } from '../persistence';
import type { LocalDataCensusReport } from '../../engines/localData/localDataCensusReport';
import { isPlainRecord, readRecordArray } from './recordGuards';
import {
  CHAT_CATALOG_KEY,
  RUNTIME_STATE_KEY,
  PERSONA_STATE_KEY,
  PERSONA_MEMORY_DOC_CONTENT_PREFIX,
  PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX,
  LOCAL_DATA_ROW_PREFIX
} from './storageKeys';

export type LocalDataCollaboratorOrphanDiagnostic = {
  collaboratorId: string;
  rowKey: string;
  rowState: 'complete' | 'unloaded' | 'incomplete' | 'timedOut' | 'deleted' | 'missing' | 'unreadable';
  rowUpdatedAt: number | null;
  rowDeletedAt: number | null;
  repositoryRowPresent: boolean;
  personaStateHasId: boolean;
  referencedByLiveOwnerRef: boolean;
  hasOrphanMemoryBodies: boolean;
  splitMemoryBodyCount: number;
  chunkedMemoryBodyCount: number;
  chunkedMemoryBodyChunkCount: number;
};

type CollaboratorOrphanSource = {
  kv: PersistedDbEntry[];
};

function localDataPersonaRowKey(collaboratorId: string) {
  return `${LOCAL_DATA_ROW_PREFIX}persona:collaborator:${collaboratorId}`;
}

function readPersonaStateIds(value: unknown) {
  if (!isPlainRecord(value) || !Array.isArray(value.personas)) return new Set<string>();
  return new Set(value.personas.flatMap((persona) => (
    isPlainRecord(persona) && typeof persona.id === 'string' && persona.id.trim().length > 0
      ? [persona.id]
      : []
  )));
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readExplicitOwnerRefIds(byKey: Map<string, unknown>) {
  const ids = new Set<string>();
  for (const conversation of readRecordArray(byKey.get(CHAT_CATALOG_KEY), 'conversations')) {
    if (!isPlainRecord(conversation)) continue;
    const collaboratorId = readString(conversation.collaboratorId);
    if (collaboratorId) ids.add(collaboratorId);
  }
  for (const connection of readRecordArray(byKey.get(RUNTIME_STATE_KEY), 'companionConnections')) {
    if (!isPlainRecord(connection)) continue;
    const collaboratorId = readString(connection.collaboratorId);
    if (collaboratorId) ids.add(collaboratorId);
  }
  for (const rule of readRecordArray(byKey.get(RUNTIME_STATE_KEY), 'triggerRules')) {
    if (!isPlainRecord(rule) || !isPlainRecord(rule.target)) continue;
    const collaboratorId = readString(rule.target.collaboratorId);
    if (collaboratorId) ids.add(collaboratorId);
  }
  return ids;
}

function readPersonaRowCollaboratorId(key: string) {
  const prefix = `${LOCAL_DATA_ROW_PREFIX}persona:collaborator:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

function readPersonaMemoryOwnerIdFromSplitKey(key: string) {
  if (!key.startsWith(PERSONA_MEMORY_DOC_CONTENT_PREFIX)) return null;
  const body = key.slice(PERSONA_MEMORY_DOC_CONTENT_PREFIX.length);
  const separatorIndex = body.indexOf(':');
  if (separatorIndex < 0) return null;
  try {
    return decodeURIComponent(body.slice(0, separatorIndex));
  } catch {
    return body.slice(0, separatorIndex);
  }
}

function parseLocalDataRowState(value: unknown): LocalDataCollaboratorOrphanDiagnostic['rowState'] {
  if (value === undefined) return 'missing';
  if (!isPlainRecord(value)) return 'unreadable';
  return value.state === 'complete'
    || value.state === 'unloaded'
    || value.state === 'incomplete'
    || value.state === 'timedOut'
    || value.state === 'deleted'
    ? value.state
    : 'unreadable';
}

function readNumberField(value: unknown, field: string) {
  return isPlainRecord(value) && typeof value[field] === 'number' && Number.isFinite(value[field])
    ? value[field]
    : null;
}

function personaDocBodyPrefix(collaboratorId: string) {
  return `${encodeURIComponent(collaboratorId)}:`;
}

function readChunkedPersonaDocBodyKey(key: string, encodedCollaboratorPrefix: string) {
  if (!key.startsWith(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX)) return null;
  const body = key.slice(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX.length);
  if (!body.startsWith(encodedCollaboratorPrefix)) return null;
  const separatorIndex = body.lastIndexOf(':');
  if (separatorIndex < 0) return null;
  return body.slice(0, separatorIndex);
}

function readPersonaMemoryOwnerIdFromChunkKey(key: string) {
  if (!key.startsWith(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX)) return null;
  const body = key.slice(PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX.length);
  const separatorIndex = body.indexOf(':');
  if (separatorIndex < 0) return null;
  try {
    return decodeURIComponent(body.slice(0, separatorIndex));
  } catch {
    return body.slice(0, separatorIndex);
  }
}

export function buildCollaboratorOrphanDiagnostics(
  source: CollaboratorOrphanSource,
  censusReport: LocalDataCensusReport
): LocalDataCollaboratorOrphanDiagnostic[] {
  const byKey = new Map(source.kv.map((entry) => [entry.key, entry.value]));
  const currentCollaboratorIds = new Set(censusReport.knownCollaboratorIds);
  const personaStateIds = readPersonaStateIds(byKey.get(PERSONA_STATE_KEY));
  const liveOwnerRefIds = new Set(Array.from(readExplicitOwnerRefIds(byKey))
    .filter((ownerId) => !currentCollaboratorIds.has(ownerId)));
  const orphanMemoryOwnerIds = new Set(source.kv.flatMap((entry) => {
    const ownerId = readPersonaMemoryOwnerIdFromSplitKey(entry.key)
      ?? readPersonaMemoryOwnerIdFromChunkKey(entry.key);
    return ownerId && !currentCollaboratorIds.has(ownerId) ? [ownerId] : [];
  }));
  const orphanPersonaRowIds = new Set(source.kv.flatMap((entry) => {
    const ownerId = readPersonaRowCollaboratorId(entry.key);
    return ownerId && !currentCollaboratorIds.has(ownerId) ? [ownerId] : [];
  }));
  const suspectOwnerIds = Array.from(new Set([
    ...liveOwnerRefIds,
    ...orphanMemoryOwnerIds,
    ...orphanPersonaRowIds
  ]))
    .filter((ownerId) => !currentCollaboratorIds.has(ownerId));

  return suspectOwnerIds.map((collaboratorId) => {
    const rowKey = localDataPersonaRowKey(collaboratorId);
    const row = byKey.get(rowKey);
    const encodedPrefix = personaDocBodyPrefix(collaboratorId);
    const splitMemoryBodyCount = source.kv
      .filter((entry) => entry.key.startsWith(PERSONA_MEMORY_DOC_CONTENT_PREFIX + encodedPrefix))
      .length;
    const chunkedDocBodyKeys = new Set<string>();
    let chunkedMemoryBodyChunkCount = 0;
    source.kv.forEach((entry) => {
      const docBodyKey = readChunkedPersonaDocBodyKey(entry.key, encodedPrefix);
      if (!docBodyKey) return;
      chunkedDocBodyKeys.add(docBodyKey);
      chunkedMemoryBodyChunkCount += 1;
    });

    return {
      collaboratorId,
      rowKey,
      rowState: parseLocalDataRowState(row),
      rowUpdatedAt: readNumberField(row, 'updatedAt'),
      rowDeletedAt: readNumberField(row, 'deletedAt'),
      repositoryRowPresent: row !== undefined,
      personaStateHasId: personaStateIds.has(collaboratorId),
      referencedByLiveOwnerRef: liveOwnerRefIds.has(collaboratorId),
      hasOrphanMemoryBodies: orphanMemoryOwnerIds.has(collaboratorId),
      splitMemoryBodyCount,
      chunkedMemoryBodyCount: chunkedDocBodyKeys.size,
      chunkedMemoryBodyChunkCount
    };
  });
}
