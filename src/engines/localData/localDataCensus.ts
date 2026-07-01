import type { StoredAssetMeta } from '../../infrastructure/assetStore';
import type { PersistedDbEntry } from '../../infrastructure/persistence';
import { extractPolarisAssetIds } from '../assetReferences';
import {
  collectDocumentBodyCompletenessIndex,
  declaredReferenceDocCharCount
} from './documentBodyCompleteness';
import { collectLocalDataAssetRepositoryFacts } from './assetCensusFacts';
import { buildLocalDataOwnerRegistry } from './localDataOwnerRegistry';
import {
  LOCAL_DATA_NAMESPACE,
  getLocalDataActiveDataSourceKey,
  type LocalDataActiveDataSource
} from './types';

export type LocalDataCensusSource = {
  kv: PersistedDbEntry[];
  assetMeta: PersistedDbEntry<StoredAssetMeta>[];
  assetBinary?: PersistedDbEntry<Blob>[];
  assetPreview?: PersistedDbEntry<Blob>[];
  assetBinaryKeys?: string[];
  assetPreviewKeys?: string[];
  localStorage: Array<{ key: string; value: string }>;
};

export type LocalDataDomainCensus = {
  objectCount: number;
  legacySourceCount: number;
  repositoryRowCount: number;
  assetRefCount: number;
  missingOwnerRefCount: number;
  danglingOwnerRefCount: number;
  missingBodyCount: number;
  orphanBodyCount: number;
  missingAssetMetaRefCount: number;
  missingAssetBinaryRefCount: number;
};

export type LocalDataChatCensus = LocalDataDomainCensus & {
  catalogConversationCount: number;
  conversationRecordCount: number;
  catalogMissingRecordCount: number;
  orphanConversationRecordCount: number;
  activeConversationMissing: boolean;
};

export type LocalDataPersonaCensus = LocalDataDomainCensus & {
  personaCount: number;
  activeCollaboratorMissing: boolean;
  avatarAssetRefCount: number;
};

export type LocalDataCollectionCensus = LocalDataDomainCensus & {
  cardCount: number;
  imageCardCount: number;
  projectFileCount: number;
  roomProjectCount: number;
  workspaceReferenceDocCount: number;
  projectFileMissingProjectCount: number;
  workspaceDocMissingProjectCount: number;
};

export type LocalDataAssetCensus = {
  storedMetaCount: number;
  storedBinaryCount: number;
  storedPreviewCount: number;
  referencedAssetCount: number;
  referencedMissingMetaCount: number;
  referencedMissingBinaryCount: number;
  storedOrphanAssetCount: number;
  previewOnlyCount: number;
};

export type LocalDataSettingsCensus = {
  kvSourceCount: number;
  legacyLocalStorageSourceCount: number;
  activeCollaboratorRefMissing: boolean;
  activeProjectRefMissing: boolean;
};

export type LocalDataRepositoryCensus = {
  activeDataSource: LocalDataActiveDataSource | 'unknown';
  activeDataSourceRowPresent: boolean;
  rowCount: number;
  pointerCount: number;
};

export type LocalDataCensusSnapshot = {
  repository: LocalDataRepositoryCensus;
  knownCollaboratorCount: number;
  knownOwnerCount: number;
  chat: LocalDataChatCensus;
  persona: LocalDataPersonaCensus;
  collection: LocalDataCollectionCensus;
  asset: LocalDataAssetCensus;
  runtime: LocalDataSettingsCensus;
  space: LocalDataSettingsCensus;
};

const CHAT_CATALOG_KEY = 'chat-catalog-v1';
const CHAT_CONVERSATION_RECORD_PREFIX = 'chat-conversation-record-v1:';
const CHAT_MESSAGE_PREFIX = 'chat-messages-v2:';
const CHAT_COMMIT_MESSAGE_PREFIX = 'chat-message-v1:';
const CHAT_CONVERSATION_ENVELOPE_PREFIX = 'chat-conversation-v1:';
const LEGACY_CHAT_KEYS = new Set([
  'chat-state-v1',
  'chat-index-v2',
  'chat-index-v2-pending',
  'chat-commit-pointer-v1'
]);
const LEGACY_CHAT_PREFIXES = [
  CHAT_MESSAGE_PREFIX,
  'chat-manifest-v1:',
  CHAT_COMMIT_MESSAGE_PREFIX,
  CHAT_CONVERSATION_ENVELOPE_PREFIX
];
const PERSONA_STATE_KEY = 'persona-state-v2';
const PERSONA_MEMORY_DOC_CONTENT_KEY = 'persona-memory-doc-content-v1';
const PERSONA_MEMORY_DOC_CONTENT_PREFIX = 'persona-memory-doc-content-v2:';
const PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX = 'persona-memory-doc-content-v3:';
const COLLECTION_STATE_KEY = 'collection-state-v2';
const LEGACY_COLLECTION_STATE_KEY = 'collection-state-v1';
const WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX = 'workspace-reference-doc-content-v1:';
const WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX = 'workspace-reference-doc-content-v2:';
const RUNTIME_KEYS = new Set(['runtime-providers-v2', 'runtime-api-v1']);
const SPACE_THEME_STATE_KEY = 'space-theme-state-v1';
const SPACE_LEGACY_LOCAL_STORAGE_KEY = 'polaris-space-store-v1';

type DomainCensusWithAssetRefs<T extends LocalDataDomainCensus> = T & {
  assetRefs: Set<string>;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readRecordArray(value: unknown, key: string) {
  return isPlainRecord(value) && Array.isArray(value[key]) ? value[key] : [];
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function encodedDocKey(...parts: string[]) {
  return parts.map((part) => encodeURIComponent(part)).join(':');
}

function countRepositoryRows(kv: PersistedDbEntry[], domain: string) {
  const prefix = `${LOCAL_DATA_NAMESPACE}:row:${domain}:`;
  return kv.filter((entry) => entry.key.startsWith(prefix)).length;
}

function readRepositoryCensus(kv: PersistedDbEntry[]): LocalDataRepositoryCensus {
  const activeDataSourceRow = kv.find((entry) => entry.key === getLocalDataActiveDataSourceKey())?.value;
  const activeDataSource =
    isPlainRecord(activeDataSourceRow) && activeDataSourceRow.activeDataSource === 'repository'
      ? activeDataSourceRow.activeDataSource
      : 'unknown';

  return {
    activeDataSource,
    activeDataSourceRowPresent: Boolean(activeDataSourceRow),
    rowCount: kv.filter((entry) => entry.key.startsWith(`${LOCAL_DATA_NAMESPACE}:row:`)).length,
    pointerCount: kv.filter((entry) => entry.key.startsWith(`${LOCAL_DATA_NAMESPACE}:pointer:`)).length
  };
}

function countMissingOwnerRefs(items: unknown[]) {
  return items.filter((item) => !isPlainRecord(item) || !readString(item.ownerCollaboratorId)).length;
}

function countDanglingOwnerRefs(items: unknown[], knownCollaboratorIds: Set<string>) {
  return items.filter((item) => {
    if (!isPlainRecord(item)) return false;
    const ownerCollaboratorId = readString(item.ownerCollaboratorId);
    return Boolean(ownerCollaboratorId && !knownCollaboratorIds.has(ownerCollaboratorId));
  }).length;
}

function countAssetRefsMissingStorage(assetRefs: Set<string>, metaIds: Set<string>, binaryIds: Set<string>) {
  let missingMeta = 0;
  let missingBinary = 0;
  assetRefs.forEach((assetId) => {
    if (!metaIds.has(assetId)) missingMeta += 1;
    if (!binaryIds.has(assetId)) missingBinary += 1;
  });
  return { missingMeta, missingBinary };
}

function collectTextAssetRefs(target: Set<string>, ...values: unknown[]) {
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    extractPolarisAssetIds(value).forEach((assetId) => target.add(assetId));
  });
}

function collectAttachmentAssetRefs(target: Set<string>, messages: unknown[]) {
  messages.forEach((message) => {
    if (!isPlainRecord(message) || !Array.isArray(message.attachments)) return;
    message.attachments.forEach((attachment) => {
      if (!isPlainRecord(attachment) || attachment.clearedAt !== undefined) return;
      const assetId = readString(attachment.assetId);
      if (assetId) target.add(assetId);
    });
  });
}

function getCommittedConversationIdFromMessageKey(key: string) {
  if (!key.startsWith(CHAT_COMMIT_MESSAGE_PREFIX)) return null;
  const remainder = key.slice(CHAT_COMMIT_MESSAGE_PREFIX.length);
  const separatorIndex = remainder.lastIndexOf(':');
  return separatorIndex >= 0 ? remainder.slice(separatorIndex + 1) : null;
}

function findReadableLegacyChatMessages(byKey: Map<string, unknown>, conversationId: string) {
  const directMessages = byKey.get(`${CHAT_MESSAGE_PREFIX}${conversationId}`);
  if (Array.isArray(directMessages)) return directMessages;

  const envelope = byKey.get(`${CHAT_CONVERSATION_ENVELOPE_PREFIX}${conversationId}`);
  if (isPlainRecord(envelope)) {
    const envelopeMessageKey = readString(envelope.messageKey);
    const envelopeMessages = envelopeMessageKey ? byKey.get(envelopeMessageKey) : null;
    if (Array.isArray(envelopeMessages)) return envelopeMessages;
  }

  for (const [key, value] of byKey.entries()) {
    if (getCommittedConversationIdFromMessageKey(key) === conversationId && Array.isArray(value)) return value;
  }

  return null;
}

function readChatCensus(
  kv: PersistedDbEntry[],
  knownCollaboratorIds: Set<string>,
  metaIds: Set<string>,
  binaryIds: Set<string>
): DomainCensusWithAssetRefs<LocalDataChatCensus> {
  const byKey = new Map(kv.map((entry) => [entry.key, entry.value]));
  const catalog = byKey.get(CHAT_CATALOG_KEY);
  const catalogRecords = readRecordArray(catalog, 'conversations');
  const recordKeys = new Set(kv
    .filter((entry) => entry.key.startsWith(CHAT_CONVERSATION_RECORD_PREFIX))
    .map((entry) => entry.key));
  const catalogRecordKeys = new Set<string>();
  const chatAssetRefs = new Set<string>();
  let catalogMissingRecordCount = 0;
  let missingOwnerRefCount = 0;
  let danglingOwnerRefCount = 0;

  catalogRecords.forEach((record) => {
    if (!isPlainRecord(record)) return;
    const recordKey = readString(record.recordKey);
    if (recordKey) catalogRecordKeys.add(recordKey);
    if ((!recordKey || !recordKeys.has(recordKey)) && !findReadableLegacyChatMessages(byKey, readString(record.id) ?? '')) {
      catalogMissingRecordCount += 1;
    }
    const collaboratorId = readString(record.collaboratorId);
    if (!collaboratorId) missingOwnerRefCount += 1;
    if (collaboratorId && !knownCollaboratorIds.has(collaboratorId)) danglingOwnerRefCount += 1;
  });

  kv.forEach((entry) => {
    if (!entry.key.startsWith(CHAT_CONVERSATION_RECORD_PREFIX) || !isPlainRecord(entry.value)) return;
    collectAttachmentAssetRefs(chatAssetRefs, readRecordArray(entry.value, 'messages'));
  });
  catalogRecords.forEach((record) => {
    if (!isPlainRecord(record)) return;
    const recordKey = readString(record.recordKey);
    if (recordKey && recordKeys.has(recordKey)) return;
    const id = readString(record.id);
    if (!id) return;
    const legacyMessages = findReadableLegacyChatMessages(byKey, id);
    if (legacyMessages) collectAttachmentAssetRefs(chatAssetRefs, legacyMessages);
  });
  const activeConversationId = isPlainRecord(catalog) ? readString(catalog.activeConversationId) : null;
  const catalogIds = new Set(catalogRecords
    .map((record) => isPlainRecord(record) ? readString(record.id) : null)
    .filter((id): id is string => Boolean(id)));
  const assetMisses = countAssetRefsMissingStorage(chatAssetRefs, metaIds, binaryIds);

  return {
    objectCount: catalogRecords.length,
    legacySourceCount: kv.filter((entry) => LEGACY_CHAT_KEYS.has(entry.key) || LEGACY_CHAT_PREFIXES.some((prefix) => entry.key.startsWith(prefix))).length,
    repositoryRowCount: countRepositoryRows(kv, 'chat'),
    assetRefCount: chatAssetRefs.size,
    missingOwnerRefCount,
    danglingOwnerRefCount,
    missingBodyCount: catalogMissingRecordCount,
    orphanBodyCount: [...recordKeys].filter((recordKey) => !catalogRecordKeys.has(recordKey)).length,
    missingAssetMetaRefCount: assetMisses.missingMeta,
    missingAssetBinaryRefCount: assetMisses.missingBinary,
    catalogConversationCount: catalogRecords.length,
    conversationRecordCount: recordKeys.size,
    catalogMissingRecordCount,
    orphanConversationRecordCount: [...recordKeys].filter((recordKey) => !catalogRecordKeys.has(recordKey)).length,
    activeConversationMissing: Boolean(activeConversationId && !catalogIds.has(activeConversationId)),
    assetRefs: chatAssetRefs
  };
}

function readPersonaCensus(
  kv: PersistedDbEntry[],
  knownCollaboratorIds: Set<string>,
  metaIds: Set<string>,
  binaryIds: Set<string>
): DomainCensusWithAssetRefs<LocalDataPersonaCensus> {
  const byKey = new Map(kv.map((entry) => [entry.key, entry.value]));
  const personaState = byKey.get(PERSONA_STATE_KEY);
  const personas = readRecordArray(personaState, 'personas');
  const legacyDocPayload = byKey.get(PERSONA_MEMORY_DOC_CONTENT_KEY);
  const legacyDocs = isPlainRecord(legacyDocPayload) && isPlainRecord(legacyDocPayload.docs)
    ? Object.fromEntries(
      Object.entries(legacyDocPayload.docs).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
    : {};
  const declaredDocKeys = new Set<string>();
  const declaredCharCounts = new Map<string, number>();
  const avatarAssetRefs = new Set<string>();

  personas.forEach((persona) => {
    if (!isPlainRecord(persona)) return;
    const personaId = readString(persona.id);
    if (!personaId) return;
    const assistantAvatarAssetId = readString(persona.assistantAvatarAssetId);
    const userAvatarAssetId = readString(persona.userAvatarAssetId);
    if (assistantAvatarAssetId) avatarAssetRefs.add(assistantAvatarAssetId);
    if (userAvatarAssetId) avatarAssetRefs.add(userAvatarAssetId);

    const memory = isPlainRecord(persona.memory) ? persona.memory : null;
    for (const doc of memory && Array.isArray(memory.referenceDocs) ? memory.referenceDocs : []) {
      if (!isPlainRecord(doc)) continue;
      const docId = readString(doc.id);
      if (!docId) continue;
      const docKey = encodedDocKey(personaId, docId);
      declaredDocKeys.add(docKey);
      declaredCharCounts.set(docKey, declaredReferenceDocCharCount(doc));
    }
  });

  const bodyIndex = collectDocumentBodyCompletenessIndex({
    kv,
    splitPrefix: PERSONA_MEMORY_DOC_CONTENT_PREFIX,
    chunkPrefix: PERSONA_MEMORY_DOC_CONTENT_CHUNK_PREFIX,
    legacyDocs,
    declaredCharCounts
  });
  const assetMisses = countAssetRefsMissingStorage(avatarAssetRefs, metaIds, binaryIds);
  const activeCollaboratorId = isPlainRecord(personaState) ? readString(personaState.activeCollaboratorId) : null;

  return {
    objectCount: personas.length,
    legacySourceCount: kv.filter((entry) => entry.key === 'persona-state-v1' || entry.key === PERSONA_MEMORY_DOC_CONTENT_KEY).length,
    repositoryRowCount: countRepositoryRows(kv, 'persona'),
    assetRefCount: avatarAssetRefs.size,
    missingOwnerRefCount: 0,
    danglingOwnerRefCount: 0,
    missingBodyCount: [...declaredDocKeys].filter((docKey) => !bodyIndex.completeKeys.has(docKey)).length,
    orphanBodyCount: [...bodyIndex.bodyKeys].filter((docKey) => !declaredDocKeys.has(docKey)).length,
    missingAssetMetaRefCount: assetMisses.missingMeta,
    missingAssetBinaryRefCount: assetMisses.missingBinary,
    personaCount: personas.length,
    activeCollaboratorMissing: Boolean(activeCollaboratorId && !knownCollaboratorIds.has(activeCollaboratorId)),
    avatarAssetRefCount: avatarAssetRefs.size,
    assetRefs: avatarAssetRefs
  };
}

function readCollectionCensus(
  kv: PersistedDbEntry[],
  knownCollaboratorIds: Set<string>,
  metaIds: Set<string>,
  binaryIds: Set<string>
): DomainCensusWithAssetRefs<LocalDataCollectionCensus> {
  const collectionState = kv.find((entry) => entry.key === COLLECTION_STATE_KEY)?.value;
  const cards = readRecordArray(collectionState, 'cards');
  const imageCards = readRecordArray(collectionState, 'imageCards');
  const projectFiles = readRecordArray(collectionState, 'projectFiles');
  const roomProjects = readRecordArray(collectionState, 'roomProjects');
  const workspaceReferenceDocs = readRecordArray(collectionState, 'workspaceReferenceDocs');
  const ownerScopedItems = [...cards, ...imageCards, ...projectFiles, ...roomProjects, ...workspaceReferenceDocs];
  const projectIds = new Set(roomProjects
    .map((project) => isPlainRecord(project) ? readString(project.id) : null)
    .filter((id): id is string => Boolean(id)));
  const declaredDocKeys = new Set<string>();
  const declaredCharCounts = new Map<string, number>();
  const assetRefs = new Set<string>();

  cards.forEach((card) => {
    if (!isPlainRecord(card)) return;
    collectTextAssetRefs(assetRefs, card.code, card.cardFaceCss, card.cardNote);
  });
  imageCards.forEach((card) => {
    if (!isPlainRecord(card)) return;
    const assetId = readString(card.assetId);
    if (assetId) assetRefs.add(assetId);
  });
  projectFiles.forEach((file) => {
    if (!isPlainRecord(file)) return;
    collectTextAssetRefs(assetRefs, file.content);
  });
  roomProjects.forEach((project) => {
    if (!isPlainRecord(project)) return;
    collectTextAssetRefs(assetRefs, project.coverStyle, project.coverNote);
  });
  workspaceReferenceDocs.forEach((doc) => {
    if (!isPlainRecord(doc)) return;
    const docId = readString(doc.id);
    if (docId) {
      const docKey = encodedDocKey(docId);
      declaredDocKeys.add(docKey);
      declaredCharCounts.set(docKey, declaredReferenceDocCharCount(doc));
    }
    collectTextAssetRefs(assetRefs, doc.content, doc.summary);
  });

  const bodyIndex = collectDocumentBodyCompletenessIndex({
    kv,
    splitPrefix: WORKSPACE_REFERENCE_DOC_CONTENT_PREFIX,
    chunkPrefix: WORKSPACE_REFERENCE_DOC_CONTENT_CHUNK_PREFIX,
    declaredCharCounts
  });
  const assetMisses = countAssetRefsMissingStorage(assetRefs, metaIds, binaryIds);

  return {
    objectCount: cards.length + imageCards.length + projectFiles.length + roomProjects.length + workspaceReferenceDocs.length,
    legacySourceCount: kv.filter((entry) => entry.key === LEGACY_COLLECTION_STATE_KEY).length,
    repositoryRowCount: countRepositoryRows(kv, 'collection'),
    assetRefCount: assetRefs.size,
    missingOwnerRefCount: countMissingOwnerRefs(ownerScopedItems),
    danglingOwnerRefCount: countDanglingOwnerRefs(ownerScopedItems, knownCollaboratorIds),
    missingBodyCount: [...declaredDocKeys].filter((docKey) => !bodyIndex.completeKeys.has(docKey)).length,
    orphanBodyCount: [...bodyIndex.bodyKeys].filter((docKey) => !declaredDocKeys.has(docKey)).length,
    missingAssetMetaRefCount: assetMisses.missingMeta,
    missingAssetBinaryRefCount: assetMisses.missingBinary,
    cardCount: cards.length,
    imageCardCount: imageCards.length,
    projectFileCount: projectFiles.length,
    roomProjectCount: roomProjects.length,
    workspaceReferenceDocCount: workspaceReferenceDocs.length,
    projectFileMissingProjectCount: projectFiles.filter((file) => (
      !isPlainRecord(file) || !projectIds.has(readString(file.projectId) ?? '')
    )).length,
    workspaceDocMissingProjectCount: workspaceReferenceDocs.filter((doc) => (
      !isPlainRecord(doc) || !projectIds.has(readString(doc.projectId) ?? '')
    )).length,
    assetRefs
  };
}

function readSpaceAssetRefs(spaceState: unknown) {
  const assetRefs = new Set<string>();
  if (!isPlainRecord(spaceState)) return assetRefs;
  collectTextAssetRefs(assetRefs, JSON.stringify(spaceState.theme ?? {}), JSON.stringify(spaceState.collaboratorThemes ?? {}));
  const customization = isPlainRecord(spaceState.customization) ? spaceState.customization : null;
  const backgroundAssetId = readString(customization?.backgroundAssetId);
  if (backgroundAssetId) assetRefs.add(backgroundAssetId);
  const customFontAssetIds = Array.isArray(customization?.customFontAssetIds) ? customization.customFontAssetIds : [];
  customFontAssetIds.forEach((assetId) => {
    const normalized = readString(assetId);
    if (normalized) assetRefs.add(normalized);
  });
  return assetRefs;
}

function readSettingsCensus(args: {
  kv: PersistedDbEntry[];
  localStorage: Array<{ key: string; value: string }>;
  keySet: Set<string>;
  localStorageKeySet: Set<string>;
  knownCollaboratorIds: Set<string>;
  projectIds: Set<string>;
  activeCollaboratorId?: string | null;
  activeProjectId?: string | null;
}): LocalDataSettingsCensus {
  return {
    kvSourceCount: args.kv.filter((entry) => args.keySet.has(entry.key)).length,
    legacyLocalStorageSourceCount: args.localStorage.filter((entry) => args.localStorageKeySet.has(entry.key)).length,
    activeCollaboratorRefMissing: Boolean(args.activeCollaboratorId && !args.knownCollaboratorIds.has(args.activeCollaboratorId)),
    activeProjectRefMissing: Boolean(args.activeProjectId && !args.projectIds.has(args.activeProjectId))
  };
}

function stripInternalAssetRefs<T extends LocalDataDomainCensus>(
  census: DomainCensusWithAssetRefs<T>
): T {
  const { assetRefs, ...publicCensus } = census;
  void assetRefs;
  return publicCensus as unknown as T;
}

export function buildLocalDataCensusSnapshot(source: LocalDataCensusSource): LocalDataCensusSnapshot {
  const byKey = new Map(source.kv.map((entry) => [entry.key, entry.value]));
  const personaState = byKey.get(PERSONA_STATE_KEY);
  const collectionState = byKey.get(COLLECTION_STATE_KEY);
  const ownerRegistry = buildLocalDataOwnerRegistry(byKey);
  const knownCollaboratorIds = new Set(ownerRegistry.collaboratorIds);
  const knownOwnerIds = new Set(ownerRegistry.historicalOwnerIds);
  const repositoryAssetFacts = collectLocalDataAssetRepositoryFacts(source.kv);
  const metaIds = new Set([
    ...source.assetMeta.map((entry) => entry.key),
    ...repositoryAssetFacts.metaIds
  ]);
  const binaryIds = new Set([
    ...(source.assetBinary ? source.assetBinary.map((entry) => entry.key) : source.assetBinaryKeys ?? []),
    ...repositoryAssetFacts.binaryIds
  ]);
  const previewIds = new Set([
    ...(source.assetPreview ? source.assetPreview.map((entry) => entry.key) : source.assetPreviewKeys ?? []),
    ...repositoryAssetFacts.previewIds
  ]);
  const collectionProjects = readRecordArray(collectionState, 'roomProjects');
  const projectIds = new Set(collectionProjects
    .map((project) => isPlainRecord(project) ? readString(project.id) : null)
    .filter((id): id is string => Boolean(id)));

  const chat = readChatCensus(source.kv, knownOwnerIds, metaIds, binaryIds);
  const persona = readPersonaCensus(source.kv, knownCollaboratorIds, metaIds, binaryIds);
  const collection = readCollectionCensus(source.kv, knownOwnerIds, metaIds, binaryIds);
  const referencedAssetIds = new Set<string>([
    ...chat.assetRefs,
    ...persona.assetRefs,
    ...collection.assetRefs,
    ...repositoryAssetFacts.ownedIds
  ]);
  const assetMissCounts = [chat, persona, collection].reduce((accumulator, domain) => ({
    missingMeta: accumulator.missingMeta + domain.missingAssetMetaRefCount,
    missingBinary: accumulator.missingBinary + domain.missingAssetBinaryRefCount
  }), { missingMeta: 0, missingBinary: 0 });

  const activeCollaboratorId = isPlainRecord(personaState) ? readString(personaState.activeCollaboratorId) : null;
  const spaceState = byKey.get(SPACE_THEME_STATE_KEY);
  const frontstageCollaboratorId = isPlainRecord(spaceState) ? readString(spaceState.frontstageCollaboratorId) : null;
  const collectionProjectId = isPlainRecord(spaceState) ? readString(spaceState.collectionProjectId) : null;
  const spaceAssetRefs = readSpaceAssetRefs(spaceState);
  const spaceAssetMisses = countAssetRefsMissingStorage(spaceAssetRefs, metaIds, binaryIds);
  spaceAssetRefs.forEach((assetId) => referencedAssetIds.add(assetId));
  const storedAssetIds = new Set([...metaIds, ...binaryIds]);
  const repositoryOwnedAssetMisses = countAssetRefsMissingStorage(repositoryAssetFacts.ownedIds, metaIds, binaryIds);
  const previewOnlyIds = new Set([
    ...[...previewIds].filter((assetId) => !storedAssetIds.has(assetId)),
    ...repositoryAssetFacts.previewOnlyIds
  ]);

  return {
    repository: readRepositoryCensus(source.kv),
    knownCollaboratorCount: knownCollaboratorIds.size,
    knownOwnerCount: knownOwnerIds.size,
    chat: stripInternalAssetRefs(chat),
    persona: stripInternalAssetRefs(persona),
    collection: stripInternalAssetRefs(collection),
    asset: {
      storedMetaCount: metaIds.size,
      storedBinaryCount: binaryIds.size,
      storedPreviewCount: previewIds.size,
      referencedAssetCount: referencedAssetIds.size,
      referencedMissingMetaCount: assetMissCounts.missingMeta + spaceAssetMisses.missingMeta + repositoryOwnedAssetMisses.missingMeta,
      referencedMissingBinaryCount: assetMissCounts.missingBinary + spaceAssetMisses.missingBinary + repositoryOwnedAssetMisses.missingBinary,
      storedOrphanAssetCount: [...storedAssetIds].filter((assetId) => !referencedAssetIds.has(assetId)).length,
      previewOnlyCount: previewOnlyIds.size
    },
    runtime: readSettingsCensus({
      kv: source.kv,
      localStorage: source.localStorage,
      keySet: RUNTIME_KEYS,
      localStorageKeySet: new Set(['polaris-developer-mode', 'polaris-run-code-sandbox-mode']),
      knownCollaboratorIds,
      projectIds
    }),
    space: readSettingsCensus({
      kv: source.kv,
      localStorage: source.localStorage,
      keySet: new Set([SPACE_THEME_STATE_KEY]),
      localStorageKeySet: new Set([SPACE_LEGACY_LOCAL_STORAGE_KEY]),
      knownCollaboratorIds,
      projectIds,
      activeCollaboratorId: frontstageCollaboratorId ?? activeCollaboratorId,
      activeProjectId: collectionProjectId
    })
  };
}
