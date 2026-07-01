import type { PersistedDbEntry } from '../persistence';
import { isPlainRecord, readRecordArray } from './recordGuards';
import {
  CHAT_CATALOG_KEY,
  CHAT_COMMIT_POINTER_KEY,
  CHAT_MANIFEST_PREFIX,
  CHAT_COMMIT_MESSAGE_PREFIX,
  CHAT_CONVERSATION_ENVELOPE_PREFIX,
  CHAT_CONVERSATION_RECORD_PREFIX,
  CHAT_INDEX_KEY,
  CHAT_INDEX_PENDING_KEY,
  CHAT_MESSAGE_PREFIX
} from './storageKeys';

export type LocalChatPersistenceHealth = {
  hasCatalog: boolean;
  catalogConversationCount: number;
  conversationRecordCount: number;
  missingConversationRecordCount: number;
  orphanedConversationRecordCount: number;
  deletedCatalogConversationCount: number;
  hasCommitPointer: boolean;
  hasCurrentManifest: boolean;
  manifestConversationCount: number;
  quarantinedConversationCount: number;
  orphanedLegacyMessageChunkCount: number;
  staleCommitManifestCount: number;
  staleCommittedMessageChunkCount: number;
  tombstonedLegacyMessageChunkCount: number;
  tombstonedConversationEnvelopeCount: number;
  pendingLegacyIndexCount: number;
  legacyMessageChunkCount: number;
};

function getConversationIdFromLegacyMessageKey(key: string) {
  return key.startsWith(CHAT_MESSAGE_PREFIX) ? key.slice(CHAT_MESSAGE_PREFIX.length) : null;
}

function getConversationIdFromEnvelopeKey(key: string) {
  return key.startsWith(CHAT_CONVERSATION_ENVELOPE_PREFIX) ? key.slice(CHAT_CONVERSATION_ENVELOPE_PREFIX.length) : null;
}

function getConversationIdFromSelfContainedRecordKey(key: string) {
  return key.startsWith(CHAT_CONVERSATION_RECORD_PREFIX) ? key.slice(CHAT_CONVERSATION_RECORD_PREFIX.length) : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function readConversationIds(value: unknown) {
  if (!isPlainRecord(value) || !Array.isArray(value.conversations)) return [];
  return value.conversations.reduce<string[]>((accumulator, conversation) => {
    if (isPlainRecord(conversation) && typeof conversation.id === 'string' && conversation.id.trim().length > 0) {
      accumulator.push(conversation.id);
    }
    return accumulator;
  }, []);
}

function readManifestMessageKeys(value: unknown) {
  if (!isPlainRecord(value) || !Array.isArray(value.conversations)) return [];
  return value.conversations.reduce<string[]>((accumulator, conversation) => {
    if (isPlainRecord(conversation) && typeof conversation.messageKey === 'string' && conversation.messageKey.trim().length > 0) {
      accumulator.push(conversation.messageKey);
    }
    return accumulator;
  }, []);
}

function readCatalogRecordKeys(value: unknown) {
  if (!isPlainRecord(value) || !Array.isArray(value.conversations)) return [];
  return value.conversations.reduce<string[]>((accumulator, conversation) => {
    if (isPlainRecord(conversation) && typeof conversation.recordKey === 'string' && conversation.recordKey.trim().length > 0) {
      accumulator.push(conversation.recordKey);
    }
    return accumulator;
  }, []);
}

export function buildLocalChatPersistenceHealth(kv: PersistedDbEntry[]): LocalChatPersistenceHealth {
  const byKey = new Map(kv.map((entry) => [entry.key, entry.value]));
  const catalog = byKey.get(CHAT_CATALOG_KEY);
  const pointer = byKey.get(CHAT_COMMIT_POINTER_KEY);
  const currentCommitId =
    isPlainRecord(pointer) && typeof pointer.currentCommitId === 'string' && pointer.currentCommitId.trim().length > 0
      ? pointer.currentCommitId
      : null;
  const currentManifestKey = currentCommitId ? `${CHAT_MANIFEST_PREFIX}${currentCommitId}` : null;
  const currentManifest = currentManifestKey ? byKey.get(currentManifestKey) : null;
  const legacyIndex = byKey.get(CHAT_INDEX_KEY);
  const catalogConversationIds = readConversationIds(catalog);
  const catalogRecordKeys = new Set(readCatalogRecordKeys(catalog));
  const conversationRecordKeys = kv.map((entry) => entry.key).filter((key) => key.startsWith(CHAT_CONVERSATION_RECORD_PREFIX));
  const authoritativeConversationIds = new Set(
    catalogConversationIds.length > 0
      ? catalogConversationIds
      : currentManifest
        ? readConversationIds(currentManifest)
        : readConversationIds(legacyIndex)
  );
  const deletedConversationIds = new Set([
    ...readStringArray(isPlainRecord(catalog) ? catalog.deletedConversationIds : undefined),
    ...readStringArray(isPlainRecord(currentManifest) ? currentManifest.deletedConversationIds : undefined),
    ...readStringArray(isPlainRecord(legacyIndex) ? legacyIndex.deletedConversationIds : undefined)
  ]);
  const currentManifestMessageKeys = new Set(readManifestMessageKeys(currentManifest));
  const legacyMessageChunkKeys = kv.map((entry) => entry.key).filter((key) => key.startsWith(CHAT_MESSAGE_PREFIX));
  const committedMessageChunkKeys = kv.map((entry) => entry.key).filter((key) => key.startsWith(CHAT_COMMIT_MESSAGE_PREFIX));
  const manifestKeys = kv.map((entry) => entry.key).filter((key) => key.startsWith(CHAT_MANIFEST_PREFIX));
  const envelopeKeys = kv.map((entry) => entry.key).filter((key) => key.startsWith(CHAT_CONVERSATION_ENVELOPE_PREFIX));
  const tombstonedLegacyMessageChunkCount = legacyMessageChunkKeys.filter((key) => {
    const conversationId = getConversationIdFromLegacyMessageKey(key);
    return Boolean(conversationId && deletedConversationIds.has(conversationId));
  }).length;
  const tombstonedConversationEnvelopeCount = envelopeKeys.filter((key) => {
    const conversationId = getConversationIdFromEnvelopeKey(key);
    return Boolean(conversationId && deletedConversationIds.has(conversationId));
  }).length;

  return {
    hasCatalog: isPlainRecord(catalog),
    catalogConversationCount: catalogConversationIds.length,
    conversationRecordCount: conversationRecordKeys.length,
    missingConversationRecordCount: readRecordArray(catalog, 'conversations').filter((conversation) => {
      if (!isPlainRecord(conversation)) return false;
      const recordKey = typeof conversation.recordKey === 'string' ? conversation.recordKey : null;
      return !recordKey || !byKey.has(recordKey);
    }).length,
    orphanedConversationRecordCount: conversationRecordKeys.filter((key) => {
      const conversationId = getConversationIdFromSelfContainedRecordKey(key);
      return !catalogRecordKeys.has(key) && !Boolean(conversationId && deletedConversationIds.has(conversationId));
    }).length,
    deletedCatalogConversationCount: readStringArray(isPlainRecord(catalog) ? catalog.deletedConversationIds : undefined).length,
    hasCommitPointer: Boolean(currentCommitId),
    hasCurrentManifest: Boolean(currentManifest),
    manifestConversationCount: readConversationIds(currentManifest).length,
    quarantinedConversationCount: readStringArray(
      isPlainRecord(catalog)
        ? catalog.quarantinedConversationIds
        : isPlainRecord(currentManifest)
          ? currentManifest.quarantinedConversationIds
          : undefined
    ).length,
    orphanedLegacyMessageChunkCount: legacyMessageChunkKeys.filter((key) => {
      const conversationId = getConversationIdFromLegacyMessageKey(key);
      return Boolean(conversationId && !authoritativeConversationIds.has(conversationId) && !deletedConversationIds.has(conversationId));
    }).length,
    staleCommitManifestCount: manifestKeys.filter((key) => key !== currentManifestKey).length,
    staleCommittedMessageChunkCount: committedMessageChunkKeys.filter((key) => !currentManifestMessageKeys.has(key)).length,
    tombstonedLegacyMessageChunkCount,
    tombstonedConversationEnvelopeCount,
    pendingLegacyIndexCount: byKey.has(CHAT_INDEX_PENDING_KEY) ? 1 : 0,
    legacyMessageChunkCount: legacyMessageChunkKeys.length
  };
}
