import type { PersistedDbEntry } from '../../infrastructure/persistence';
import { extractPolarisAssetIds } from '../assetReferences';
import {
  collectDocumentBodyCompletenessIndex,
  declaredReferenceDocCharCount
} from './documentBodyCompleteness';
import { collectLocalDataAssetRepositoryFacts, type LocalDataAssetRepositoryFacts } from './assetCensusFacts';
import { LOCAL_DATA_NAMESPACE, getLocalDataActiveDataSourceKey } from './types';
import { buildCollectionCensusDomainReport } from './localDataCensusCollectionReport';
import { buildLocalDataOwnerRegistry } from './localDataOwnerRegistry';
import type {
  LocalDataCensusDomainReport,
  LocalDataCensusReport,
  LocalDataCensusReportDomain,
  LocalDataCensusReportSource
} from './localDataCensusReportTypes';
export type {
  LocalDataCensusDomainReport,
  LocalDataCensusReport,
  LocalDataCensusReportDomain,
  LocalDataCensusReportSource
} from './localDataCensusReportTypes';
export { formatLocalDataCensusReport } from './localDataCensusReportFormat';

const CHAT_CATALOG_KEY = 'chat-catalog-v1';
const CHAT_RECORD_PREFIX = 'chat-conversation-record-v1:';
const CHAT_MESSAGE_PREFIX = 'chat-messages-v2:';
const CHAT_COMMIT_MESSAGE_PREFIX = 'chat-message-v1:';
const CHAT_CONVERSATION_ENVELOPE_PREFIX = 'chat-conversation-v1:';
const PERSONA_STATE_KEY = 'persona-state-v2';
const PERSONA_DOC_LEGACY_KEY = 'persona-memory-doc-content-v1';
const PERSONA_DOC_SPLIT_PREFIX = 'persona-memory-doc-content-v2:';
const PERSONA_DOC_CHUNK_PREFIX = 'persona-memory-doc-content-v3:';
const WORKSPACE_DOC_SPLIT_PREFIX = 'workspace-reference-doc-content-v1:';
const WORKSPACE_DOC_CHUNK_PREFIX = 'workspace-reference-doc-content-v2:';
const SPACE_STATE_KEY = 'space-theme-state-v1';
const RUNTIME_SOURCE_KEYS = new Set(['runtime-providers-v2', 'runtime-api-v1']);
const RUNTIME_LOCAL_STORAGE_KEYS = new Set(['polaris-developer-mode', 'polaris-run-code-sandbox-mode']);
const SPACE_LOCAL_STORAGE_KEYS = new Set(['polaris-space-store-v1']);
const LEGACY_CHAT_KEYS = new Set(['chat-state-v1', 'chat-index-v2', 'chat-index-v2-pending', 'chat-commit-pointer-v1']);
const LEGACY_CHAT_PREFIXES = [CHAT_MESSAGE_PREFIX, 'chat-manifest-v1:', CHAT_COMMIT_MESSAGE_PREFIX, CHAT_CONVERSATION_ENVELOPE_PREFIX];
const UNREAD_KV_VALUE = Symbol('unread-kv-value');

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readArray(value: unknown, key: string) {
  return isPlainRecord(value) && Array.isArray(value[key]) ? value[key] : [];
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function uniqueSortedIds(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).filter((value) => value.trim().length > 0))).sort();
}

function encodedKey(...parts: string[]) {
  return parts.map((part) => encodeURIComponent(part)).join(':');
}

function repositoryRowKeys(kv: PersistedDbEntry[], domain: LocalDataCensusReportDomain) {
  const prefix = `${LOCAL_DATA_NAMESPACE}:row:${domain}:`;
  return uniqueSortedIds(kv.filter((entry) => entry.key.startsWith(prefix)).map((entry) => entry.key));
}

function readActiveDataSource(kv: PersistedDbEntry[]) {
  const row = kv.find((entry) => entry.key === getLocalDataActiveDataSourceKey())?.value;
  if (!isPlainRecord(row)) return 'unknown';
  return row.activeDataSource === 'repository'
    ? row.activeDataSource
    : 'unknown';
}

function collectTextAssetRefs(target: Set<string>, ...values: unknown[]) {
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    extractPolarisAssetIds(value).forEach((assetId) => target.add(assetId));
  });
}

function collectMessageAttachmentAssetRefs(target: Set<string>, messages: unknown[]) {
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

function findReadableLegacyChatMessages(byKey: Map<string, unknown>, conversationId: string): unknown[] | typeof UNREAD_KV_VALUE | null {
  const directMessages = byKey.get(`${CHAT_MESSAGE_PREFIX}${conversationId}`);
  if (Array.isArray(directMessages)) return directMessages;
  if (directMessages === undefined && byKey.has(`${CHAT_MESSAGE_PREFIX}${conversationId}`)) return UNREAD_KV_VALUE;

  const envelope = byKey.get(`${CHAT_CONVERSATION_ENVELOPE_PREFIX}${conversationId}`);
  if (isPlainRecord(envelope)) {
    const envelopeMessageKey = readString(envelope.messageKey);
    const envelopeMessages = envelopeMessageKey ? byKey.get(envelopeMessageKey) : null;
    if (Array.isArray(envelopeMessages)) return envelopeMessages;
    if (envelopeMessageKey && envelopeMessages === undefined && byKey.has(envelopeMessageKey)) return UNREAD_KV_VALUE;
  } else if (envelope === undefined && byKey.has(`${CHAT_CONVERSATION_ENVELOPE_PREFIX}${conversationId}`)) {
    return UNREAD_KV_VALUE;
  }

  for (const [key, value] of byKey.entries()) {
    if (getCommittedConversationIdFromMessageKey(key) === conversationId && Array.isArray(value)) return value;
    if (getCommittedConversationIdFromMessageKey(key) === conversationId && value === undefined) return UNREAD_KV_VALUE;
  }

  return null;
}

function documentBodyKey(scope: 'persona' | 'workspace', bodyKey: string) {
  return `${scope}:${bodyKey}`;
}

function buildAssetClosure(assetRefs: Set<string>, metaIds: Set<string>, binaryIds: Set<string>) {
  return {
    missingMetaIds: uniqueSortedIds([...assetRefs].filter((assetId) => !metaIds.has(assetId))),
    missingBinaryIds: uniqueSortedIds([...assetRefs].filter((assetId) => !binaryIds.has(assetId)))
  };
}

function emptyDomainReport(domain: LocalDataCensusReportDomain): LocalDataCensusDomainReport {
  return {
    domain,
    baselineObjectIds: [],
    activeObjectIds: [],
    repositoryRowKeys: [],
    legacySourceKeys: [],
    missingOwnerObjectIds: [],
    recoverableOwnerObjectIds: [],
    unresolvedOwnerObjectIds: [],
    danglingOwnerObjectIds: [],
    missingBodyObjectIds: [],
    orphanBodyObjectIds: [],
    assetRefIds: [],
    missingAssetMetaRefIds: [],
    missingAssetBinaryRefIds: [],
    metadataIssueIds: []
  };
}

function buildChatReport(args: {
  kv: PersistedDbEntry[];
  byKey: Map<string, unknown>;
  knownOwnerIds: Set<string>;
  metaIds: Set<string>;
  binaryIds: Set<string>;
}): LocalDataCensusDomainReport {
  const report = emptyDomainReport('chat');
  const catalog = args.byKey.get(CHAT_CATALOG_KEY);
  const catalogRecords = readArray(catalog, 'conversations');
  const catalogRecordKeys = new Set<string>();
  const recordKeysById = new Map<string, string>();
  const recordValuesByKey = new Map<string, unknown>();
  const assetRefs = new Set<string>();

  report.repositoryRowKeys = repositoryRowKeys(args.kv, 'chat');
  report.legacySourceKeys = uniqueSortedIds(args.kv
    .filter((entry) => LEGACY_CHAT_KEYS.has(entry.key) || LEGACY_CHAT_PREFIXES.some((prefix) => entry.key.startsWith(prefix)))
    .map((entry) => entry.key));

  args.kv.forEach((entry) => {
    if (!entry.key.startsWith(CHAT_RECORD_PREFIX)) return;
    const id = entry.key.slice(CHAT_RECORD_PREFIX.length);
    recordKeysById.set(id, entry.key);
    recordValuesByKey.set(entry.key, entry.value);
  });

  catalogRecords.forEach((record) => {
    if (!isPlainRecord(record)) return;
    const id = readString(record.id);
    if (!id) return;
    report.baselineObjectIds.push(id);
    report.activeObjectIds.push(id);
    const recordKey = readString(record.recordKey);
    if (recordKey) catalogRecordKeys.add(recordKey);
    const recordValue = recordKey ? recordValuesByKey.get(recordKey) : null;
    if (isPlainRecord(recordValue)) {
      collectMessageAttachmentAssetRefs(assetRefs, readArray(recordValue, 'messages'));
    } else if (recordKey && recordValue === undefined && recordValuesByKey.has(recordKey)) {
      // Lightweight maintenance reads can include the key without the body value.
      // Key existence is enough to avoid turning "not read" into "missing body".
    } else {
      const legacyMessages = findReadableLegacyChatMessages(args.byKey, id);
      if (legacyMessages === UNREAD_KV_VALUE) {
        return;
      }
      if (legacyMessages) {
        collectMessageAttachmentAssetRefs(assetRefs, legacyMessages);
      } else {
        report.missingBodyObjectIds.push(id);
      }
    }
    const collaboratorId = readString(record.collaboratorId);
    if (!collaboratorId) report.missingOwnerObjectIds.push(id);
    if (collaboratorId && !args.knownOwnerIds.has(collaboratorId)) report.danglingOwnerObjectIds.push(id);
  });

  recordKeysById.forEach((recordKey, id) => {
    if (!catalogRecordKeys.has(recordKey)) report.orphanBodyObjectIds.push(id);
  });

  const activeConversationId = isPlainRecord(catalog) ? readString(catalog.activeConversationId) : null;
  if (activeConversationId && !report.activeObjectIds.includes(activeConversationId)) {
    report.metadataIssueIds.push(`activeConversationId:${activeConversationId}`);
  }

  const assetClosure = buildAssetClosure(assetRefs, args.metaIds, args.binaryIds);
  report.assetRefIds = uniqueSortedIds(assetRefs);
  report.missingAssetMetaRefIds = assetClosure.missingMetaIds;
  report.missingAssetBinaryRefIds = assetClosure.missingBinaryIds;
  return sortDomainReport(report);
}

function buildPersonaReport(args: {
  kv: PersistedDbEntry[];
  byKey: Map<string, unknown>;
  metaIds: Set<string>;
  binaryIds: Set<string>;
}): LocalDataCensusDomainReport {
  const report = emptyDomainReport('persona');
  const personaState = args.byKey.get(PERSONA_STATE_KEY);
  const personas = readArray(personaState, 'personas');
  const knownPersonaIds = new Set<string>();
  const declaredBodyKeys = new Set<string>();
  const declaredCharCounts = new Map<string, number>();
  const assetRefs = new Set<string>();
  const legacyPayload = args.byKey.get(PERSONA_DOC_LEGACY_KEY);
  const legacyDocs = isPlainRecord(legacyPayload) && isPlainRecord(legacyPayload.docs)
    ? Object.fromEntries(
      Object.entries(legacyPayload.docs).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
    : {};

  report.repositoryRowKeys = repositoryRowKeys(args.kv, 'persona');
  report.legacySourceKeys = uniqueSortedIds(args.kv
    .filter((entry) => entry.key === 'persona-state-v1' || entry.key === PERSONA_DOC_LEGACY_KEY)
    .map((entry) => entry.key));

  personas.forEach((persona) => {
    if (!isPlainRecord(persona)) return;
    const personaId = readString(persona.id);
    if (!personaId) return;
    knownPersonaIds.add(personaId);
    report.baselineObjectIds.push(personaId);
    report.activeObjectIds.push(personaId);
    const assistantAvatarAssetId = readString(persona.assistantAvatarAssetId);
    const userAvatarAssetId = readString(persona.userAvatarAssetId);
    if (assistantAvatarAssetId) assetRefs.add(assistantAvatarAssetId);
    if (userAvatarAssetId) assetRefs.add(userAvatarAssetId);
    const memory = isPlainRecord(persona.memory) ? persona.memory : null;
    for (const doc of memory && Array.isArray(memory.referenceDocs) ? memory.referenceDocs : []) {
      if (!isPlainRecord(doc)) continue;
      const docId = readString(doc.id);
      if (docId) {
        const bodyKey = encodedKey(personaId, docId);
        declaredBodyKeys.add(bodyKey);
        declaredCharCounts.set(bodyKey, declaredReferenceDocCharCount(doc));
      }
    }
  });

  const bodyIndex = collectDocumentBodyCompletenessIndex({
    kv: args.kv,
    splitPrefix: PERSONA_DOC_SPLIT_PREFIX,
    chunkPrefix: PERSONA_DOC_CHUNK_PREFIX,
    legacyDocs,
    declaredCharCounts
  });
  report.missingBodyObjectIds = uniqueSortedIds([...declaredBodyKeys].filter((docKey) => !bodyIndex.completeKeys.has(docKey)));
  report.orphanBodyObjectIds = uniqueSortedIds([...bodyIndex.bodyKeys].filter((docKey) => !declaredBodyKeys.has(docKey)));
  const activeCollaboratorId = isPlainRecord(personaState) ? readString(personaState.activeCollaboratorId) : null;
  if (activeCollaboratorId && !knownPersonaIds.has(activeCollaboratorId)) {
    report.metadataIssueIds.push(`activeCollaboratorId:${activeCollaboratorId}`);
  }
  const assetClosure = buildAssetClosure(assetRefs, args.metaIds, args.binaryIds);
  report.assetRefIds = uniqueSortedIds(assetRefs);
  report.missingAssetMetaRefIds = assetClosure.missingMetaIds;
  report.missingAssetBinaryRefIds = assetClosure.missingBinaryIds;
  return sortDomainReport(report);
}

function buildAssetReport(args: {
  kv: PersistedDbEntry[];
  metaIds: Set<string>;
  binaryIds: Set<string>;
  previewIds: Set<string>;
  referencedAssetIds: Set<string>;
  repositoryFacts: LocalDataAssetRepositoryFacts;
}): LocalDataCensusDomainReport {
  const report = emptyDomainReport('asset');
  const metaIds = new Set([...args.metaIds, ...args.repositoryFacts.metaIds]);
  const binaryIds = new Set([...args.binaryIds, ...args.repositoryFacts.binaryIds]);
  const previewIds = new Set([...args.previewIds, ...args.repositoryFacts.previewIds]);
  const ownedAssetIds = new Set([...args.referencedAssetIds, ...args.repositoryFacts.ownedIds]);
  const storedAssetIds = new Set([...metaIds, ...binaryIds]);
  const baselineAssetIds = new Set([...storedAssetIds, ...args.repositoryFacts.assetIds]);
  const missingBodyIds = new Set([
    ...[...metaIds].filter((assetId) => !binaryIds.has(assetId)),
    ...args.repositoryFacts.missingBinaryIds
  ]);
  const orphanAssetIds = new Set([...storedAssetIds].filter((assetId) => !ownedAssetIds.has(assetId)));
  const metadataIssueIds = new Set([
    ...[...previewIds]
      .filter((assetId) => !storedAssetIds.has(assetId))
      .map((assetId) => `previewOnly:${assetId}`),
    ...[...args.repositoryFacts.previewOnlyIds].map((assetId) => `previewOnly:${assetId}`),
    ...[...args.repositoryFacts.missingMetaIds].map((assetId) => `missingMeta:${assetId}`)
  ]);
  report.repositoryRowKeys = repositoryRowKeys(args.kv, 'asset');
  report.baselineObjectIds = uniqueSortedIds(baselineAssetIds);
  report.activeObjectIds = uniqueSortedIds([...baselineAssetIds].filter((assetId) => ownedAssetIds.has(assetId)));
  report.missingBodyObjectIds = uniqueSortedIds(missingBodyIds);
  report.orphanBodyObjectIds = uniqueSortedIds(orphanAssetIds);
  report.missingOwnerObjectIds = uniqueSortedIds(orphanAssetIds);
  report.metadataIssueIds = uniqueSortedIds(metadataIssueIds);
  return report;
}

function buildDocumentReport(args: {
  kv: PersistedDbEntry[];
  byKey: Map<string, unknown>;
}): LocalDataCensusDomainReport {
  const report = emptyDomainReport('document');
  const personaState = args.byKey.get(PERSONA_STATE_KEY);
  const collectionState = args.byKey.get('collection-state-v2');
  const personas = readArray(personaState, 'personas');
  const workspaceReferenceDocs = readArray(collectionState, 'workspaceReferenceDocs');
  const declaredBodyKeys = new Map<string, string>();
  const personaDeclaredCharCounts = new Map<string, number>();
  const workspaceDeclaredCharCounts = new Map<string, number>();
  const assetRefs = new Set<string>();
  const chunkIssueObjectIds: string[] = [];
  const personaLegacy = args.byKey.get(PERSONA_DOC_LEGACY_KEY);
  const personaLegacyDocs = isPlainRecord(personaLegacy) && isPlainRecord(personaLegacy.docs)
    ? Object.fromEntries(
      Object.entries(personaLegacy.docs).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
    : {};

  report.repositoryRowKeys = repositoryRowKeys(args.kv, 'document');
  report.legacySourceKeys = uniqueSortedIds(args.kv
    .filter((entry) => (
      entry.key === PERSONA_DOC_LEGACY_KEY
      || entry.key.startsWith(PERSONA_DOC_SPLIT_PREFIX)
      || entry.key.startsWith(PERSONA_DOC_CHUNK_PREFIX)
      || entry.key.startsWith(WORKSPACE_DOC_SPLIT_PREFIX)
      || entry.key.startsWith(WORKSPACE_DOC_CHUNK_PREFIX)
    ))
    .map((entry) => entry.key));

  personas.forEach((persona) => {
    if (!isPlainRecord(persona)) return;
    const personaId = readString(persona.id);
    if (!personaId) return;
    const memory = isPlainRecord(persona.memory) ? persona.memory : null;
    for (const doc of memory && Array.isArray(memory.referenceDocs) ? memory.referenceDocs : []) {
      if (!isPlainRecord(doc)) continue;
      const docId = readString(doc.id);
      if (!docId) continue;
      const bodyKey = encodedKey(personaId, docId);
      const objectId = `persona-memory-doc:${bodyKey}`;
      declaredBodyKeys.set(documentBodyKey('persona', bodyKey), objectId);
      personaDeclaredCharCounts.set(bodyKey, declaredReferenceDocCharCount(doc));
      report.baselineObjectIds.push(objectId);
      collectTextAssetRefs(assetRefs, doc.summary, doc.content);
    }
  });

  workspaceReferenceDocs.forEach((doc) => {
    if (!isPlainRecord(doc)) return;
    const docId = readString(doc.id);
    if (!docId) return;
    const bodyKey = encodedKey(docId);
    const objectId = `workspace-reference-doc:${bodyKey}`;
    declaredBodyKeys.set(documentBodyKey('workspace', bodyKey), objectId);
    workspaceDeclaredCharCounts.set(bodyKey, declaredReferenceDocCharCount(doc));
    report.baselineObjectIds.push(objectId);
    collectTextAssetRefs(assetRefs, doc.summary, doc.content);
  });

  const personaBodyIndex = collectDocumentBodyCompletenessIndex({
    kv: args.kv,
    splitPrefix: PERSONA_DOC_SPLIT_PREFIX,
    chunkPrefix: PERSONA_DOC_CHUNK_PREFIX,
    legacyDocs: personaLegacyDocs,
    declaredCharCounts: personaDeclaredCharCounts
  });
  const workspaceBodyIndex = collectDocumentBodyCompletenessIndex({
    kv: args.kv,
    splitPrefix: WORKSPACE_DOC_SPLIT_PREFIX,
    chunkPrefix: WORKSPACE_DOC_CHUNK_PREFIX,
    declaredCharCounts: workspaceDeclaredCharCounts
  });
  const bodyKeys = new Set([
    ...[...personaBodyIndex.bodyKeys].map((bodyKey) => documentBodyKey('persona', bodyKey)),
    ...[...workspaceBodyIndex.bodyKeys].map((bodyKey) => documentBodyKey('workspace', bodyKey))
  ]);
  const completeBodyKeys = new Set([
    ...[...personaBodyIndex.completeKeys].map((bodyKey) => documentBodyKey('persona', bodyKey)),
    ...[...workspaceBodyIndex.completeKeys].map((bodyKey) => documentBodyKey('workspace', bodyKey))
  ]);
  personaBodyIndex.chunkIssueKeys.forEach((bodyKey) => {
    const objectId = declaredBodyKeys.get(documentBodyKey('persona', bodyKey));
    if (objectId) chunkIssueObjectIds.push(objectId);
  });
  workspaceBodyIndex.chunkIssueKeys.forEach((bodyKey) => {
    const objectId = declaredBodyKeys.get(documentBodyKey('workspace', bodyKey));
    if (objectId) chunkIssueObjectIds.push(objectId);
  });

  report.activeObjectIds = uniqueSortedIds([...declaredBodyKeys.entries()]
    .filter(([bodyKey]) => completeBodyKeys.has(bodyKey))
    .map(([, objectId]) => objectId));
  report.missingBodyObjectIds = uniqueSortedIds([...declaredBodyKeys.entries()]
    .filter(([bodyKey]) => !completeBodyKeys.has(bodyKey))
    .map(([, objectId]) => objectId));
  report.orphanBodyObjectIds = uniqueSortedIds([...bodyKeys].filter((bodyKey) => !declaredBodyKeys.has(bodyKey)));
  report.metadataIssueIds = uniqueSortedIds(chunkIssueObjectIds.map((objectId) => `chunk:${objectId}`));
  report.assetRefIds = uniqueSortedIds(assetRefs);
  return sortDomainReport(report);
}

function buildSettingsReport(args: {
  domain: 'runtime' | 'space';
  kv: PersistedDbEntry[];
  byKey: Map<string, unknown>;
  localStorage: Array<{ key: string; value: string }>;
  knownCollaboratorIds: Set<string>;
  projectIds: Set<string>;
}): LocalDataCensusDomainReport {
  const report = emptyDomainReport(args.domain);
  const sourceKeys = args.domain === 'runtime' ? RUNTIME_SOURCE_KEYS : new Set([SPACE_STATE_KEY]);
  const localSourceKeys = args.domain === 'runtime' ? RUNTIME_LOCAL_STORAGE_KEYS : SPACE_LOCAL_STORAGE_KEYS;
  report.repositoryRowKeys = repositoryRowKeys(args.kv, args.domain);
  report.legacySourceKeys = uniqueSortedIds([
    ...args.kv.filter((entry) => sourceKeys.has(entry.key)).map((entry) => entry.key),
    ...args.localStorage.filter((entry) => localSourceKeys.has(entry.key)).map((entry) => `localStorage:${entry.key}`)
  ]);
  report.baselineObjectIds = report.legacySourceKeys;
  report.activeObjectIds = report.legacySourceKeys;

  if (args.domain === 'space') {
    const state = args.byKey.get(SPACE_STATE_KEY);
    const collaboratorId = isPlainRecord(state) ? readString(state.frontstageCollaboratorId) : null;
    const projectId = isPlainRecord(state) ? readString(state.collectionProjectId) : null;
    if (collaboratorId && !args.knownCollaboratorIds.has(collaboratorId)) {
      report.metadataIssueIds.push(`frontstageCollaboratorId:${collaboratorId}`);
    }
    if (projectId && !args.projectIds.has(projectId)) {
      report.metadataIssueIds.push(`collectionProjectId:${projectId}`);
    }
  }

  return sortDomainReport(report);
}

function sortDomainReport(report: LocalDataCensusDomainReport): LocalDataCensusDomainReport {
  return {
    ...report,
    baselineObjectIds: uniqueSortedIds(report.baselineObjectIds),
    activeObjectIds: uniqueSortedIds(report.activeObjectIds),
    repositoryRowKeys: uniqueSortedIds(report.repositoryRowKeys),
    legacySourceKeys: uniqueSortedIds(report.legacySourceKeys),
    missingOwnerObjectIds: uniqueSortedIds(report.missingOwnerObjectIds),
    recoverableOwnerObjectIds: uniqueSortedIds(report.recoverableOwnerObjectIds),
    unresolvedOwnerObjectIds: uniqueSortedIds(report.unresolvedOwnerObjectIds),
    danglingOwnerObjectIds: uniqueSortedIds(report.danglingOwnerObjectIds),
    missingBodyObjectIds: uniqueSortedIds(report.missingBodyObjectIds),
    orphanBodyObjectIds: uniqueSortedIds(report.orphanBodyObjectIds),
    assetRefIds: uniqueSortedIds(report.assetRefIds),
    missingAssetMetaRefIds: uniqueSortedIds(report.missingAssetMetaRefIds),
    missingAssetBinaryRefIds: uniqueSortedIds(report.missingAssetBinaryRefIds),
    metadataIssueIds: uniqueSortedIds(report.metadataIssueIds)
  };
}

function collectReferencedAssetIds(domains: LocalDataCensusDomainReport[]) {
  const ids = new Set<string>();
  domains.forEach((domain) => {
    domain.assetRefIds.forEach((assetId) => ids.add(assetId));
  });
  return ids;
}

function collectRepositoryAssetReferenceIds(kv: PersistedDbEntry[]) {
  const ids = new Set<string>();
  const rowPrefix = `${LOCAL_DATA_NAMESPACE}:row:`;

  kv.forEach((entry) => {
    if (!entry.key.startsWith(rowPrefix) || !isPlainRecord(entry.value)) return;
    const row = entry.value;
    const ref = isPlainRecord(row.ref) ? row.ref : null;
    const payload =
      row.state === 'complete' && isPlainRecord(row.value)
        ? row.value
        : row.state === 'incomplete' && isPlainRecord(row.meta)
          ? row.meta
          : null;
    if (!payload) return;

    if (Array.isArray(payload.assetRefs)) {
      payload.assetRefs.forEach((assetId) => {
        if (typeof assetId === 'string' && assetId.trim()) ids.add(assetId);
      });
    }

  });

  return ids;
}

function reportHasBlockers(report: LocalDataCensusDomainReport) {
  return report.missingBodyObjectIds.length > 0
    || report.missingAssetMetaRefIds.length > 0
    || report.missingAssetBinaryRefIds.length > 0
    || report.metadataIssueIds.length > 0;
}

function buildBlockers(domains: LocalDataCensusDomainReport[]) {
  return domains.flatMap((domain) => {
    const blockers: string[] = [];
    if (domain.missingBodyObjectIds.length > 0) blockers.push(`${domain.domain}:missing-body`);
    if (domain.missingAssetMetaRefIds.length > 0) blockers.push(`${domain.domain}:missing-asset-meta`);
    if (domain.missingAssetBinaryRefIds.length > 0) blockers.push(`${domain.domain}:missing-asset-binary`);
    if (domain.metadataIssueIds.length > 0) blockers.push(`${domain.domain}:metadata-issue`);
    return blockers;
  });
}

function buildWarnings(domains: LocalDataCensusDomainReport[]) {
  return domains.flatMap((domain) => {
    const warnings: string[] = [];
    if (domain.missingOwnerObjectIds.length > 0) warnings.push(`${domain.domain}:missing-owner`);
    if (domain.recoverableOwnerObjectIds.length > 0) warnings.push(`${domain.domain}:recoverable-owner`);
    if (domain.unresolvedOwnerObjectIds.length > 0) warnings.push(`${domain.domain}:unresolved-owner`);
    if (domain.danglingOwnerObjectIds.length > 0) warnings.push(`${domain.domain}:dangling-owner`);
    if (domain.orphanBodyObjectIds.length > 0) warnings.push(`${domain.domain}:orphan-body`);
    return warnings;
  });
}

export function buildLocalDataCensusReport(source: LocalDataCensusReportSource): LocalDataCensusReport {
  const byKey = new Map(source.kv.map((entry) => [entry.key, entry.value]));
  const metaIds = new Set(source.assetMeta.map((entry) => entry.key));
  const binaryIds = new Set(source.assetBinary ? source.assetBinary.map((entry) => entry.key) : source.assetBinaryKeys ?? []);
  const previewIds = new Set(source.assetPreview ? source.assetPreview.map((entry) => entry.key) : source.assetPreviewKeys ?? []);
  const repositoryAssetFacts = collectLocalDataAssetRepositoryFacts(source.kv);
  const ownerRegistry = buildLocalDataOwnerRegistry(byKey);
  const knownCollaboratorIds = new Set(ownerRegistry.collaboratorIds);
  const knownOwnerIds = new Set(ownerRegistry.historicalOwnerIds);
  const chat = buildChatReport({ kv: source.kv, byKey, knownOwnerIds, metaIds, binaryIds });
  const persona = buildPersonaReport({ kv: source.kv, byKey, metaIds, binaryIds });
  const collection = buildCollectionCensusDomainReport({ kv: source.kv, byKey, knownOwnerIds, metaIds, binaryIds });
  const document = buildDocumentReport({ kv: source.kv, byKey });
  const projectIds = new Set(collection.baselineObjectIds
    .filter((id) => id.startsWith('project:'))
    .map((id) => id.slice('project:'.length)));
  const referencedAssetIds = collectReferencedAssetIds([chat, persona, collection, document]);
  collectRepositoryAssetReferenceIds(source.kv).forEach((assetId) => referencedAssetIds.add(assetId));
  const asset = buildAssetReport({
    kv: source.kv,
    metaIds,
    binaryIds,
    previewIds,
    referencedAssetIds,
    repositoryFacts: repositoryAssetFacts
  });
  const runtime = buildSettingsReport({
    domain: 'runtime',
    kv: source.kv,
    byKey,
    localStorage: source.localStorage,
    knownCollaboratorIds,
    projectIds
  });
  const space = buildSettingsReport({
    domain: 'space',
    kv: source.kv,
    byKey,
    localStorage: source.localStorage,
    knownCollaboratorIds,
    projectIds
  });
  const domains = [chat, persona, collection, document, asset, runtime, space];
  const blockers = buildBlockers(domains);
  const warnings = buildWarnings(domains);

  return {
    ok: domains.every((domain) => !reportHasBlockers(domain)),
    activeDataSource: readActiveDataSource(source.kv),
    repositoryRowCount: source.kv.filter((entry) => entry.key.startsWith(`${LOCAL_DATA_NAMESPACE}:row:`)).length,
    pointerCount: source.kv.filter((entry) => entry.key.startsWith(`${LOCAL_DATA_NAMESPACE}:pointer:`)).length,
    knownCollaboratorIds: uniqueSortedIds(knownCollaboratorIds),
    knownOwnerIds: uniqueSortedIds(knownOwnerIds),
    domains,
    totals: {
      baselineObjectCount: domains.reduce((sum, domain) => sum + domain.baselineObjectIds.length, 0),
      activeObjectCount: domains.reduce((sum, domain) => sum + domain.activeObjectIds.length, 0),
      legacySourceCount: domains.reduce((sum, domain) => sum + domain.legacySourceKeys.length, 0),
      repositoryRowCount: domains.reduce((sum, domain) => sum + domain.repositoryRowKeys.length, 0),
      missingOwnerObjectCount: domains.reduce((sum, domain) => sum + domain.missingOwnerObjectIds.length, 0),
      recoverableOwnerObjectCount: domains.reduce((sum, domain) => sum + domain.recoverableOwnerObjectIds.length, 0),
      unresolvedOwnerObjectCount: domains.reduce((sum, domain) => sum + domain.unresolvedOwnerObjectIds.length, 0),
      danglingOwnerObjectCount: domains.reduce((sum, domain) => sum + domain.danglingOwnerObjectIds.length, 0),
      missingBodyObjectCount: domains.reduce((sum, domain) => sum + domain.missingBodyObjectIds.length, 0),
      orphanBodyObjectCount: domains.reduce((sum, domain) => sum + domain.orphanBodyObjectIds.length, 0),
      missingAssetMetaRefCount: domains.reduce((sum, domain) => sum + domain.missingAssetMetaRefIds.length, 0),
      missingAssetBinaryRefCount: domains.reduce((sum, domain) => sum + domain.missingAssetBinaryRefIds.length, 0),
      metadataIssueCount: domains.reduce((sum, domain) => sum + domain.metadataIssueIds.length, 0)
    },
    blockers,
    warnings
  };
}
