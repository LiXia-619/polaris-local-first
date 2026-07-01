import type { PersistedDbEntry } from '../../infrastructure/persistence';
import { extractPolarisAssetIds } from '../assetReferences';
import {
  collectDocumentBodyCompletenessIndex,
  declaredReferenceDocCharCount
} from './documentBodyCompleteness';
import { LOCAL_DATA_NAMESPACE } from './types';
import { collectOwnerScopedObjects } from './localDataCensusReportOwners';
import type { LocalDataCensusDomainReport } from './localDataCensusReportTypes';

const CHAT_CATALOG_KEY = 'chat-catalog-v1';
const COLLECTION_STATE_KEY = 'collection-state-v2';
const WORKSPACE_DOC_SPLIT_PREFIX = 'workspace-reference-doc-content-v1:';
const WORKSPACE_DOC_CHUNK_PREFIX = 'workspace-reference-doc-content-v2:';

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

function collectTextAssetRefs(target: Set<string>, ...values: unknown[]) {
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    extractPolarisAssetIds(value).forEach((assetId) => target.add(assetId));
  });
}

function buildAssetClosure(assetRefs: Set<string>, metaIds: Set<string>, binaryIds: Set<string>) {
  return {
    missingMetaIds: uniqueSortedIds([...assetRefs].filter((assetId) => !metaIds.has(assetId))),
    missingBinaryIds: uniqueSortedIds([...assetRefs].filter((assetId) => !binaryIds.has(assetId)))
  };
}

function repositoryRowKeys(kv: PersistedDbEntry[]) {
  const prefix = `${LOCAL_DATA_NAMESPACE}:row:collection:`;
  return uniqueSortedIds(kv.filter((entry) => entry.key.startsWith(prefix)).map((entry) => entry.key));
}

function emptyCollectionReport(): LocalDataCensusDomainReport {
  return {
    domain: 'collection',
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

function buildConversationOwnerMaps(catalog: unknown) {
  const ownerByConversationId = new Map<string, string>();
  const ownerByProjectId = new Map<string, string>();
  readArray(catalog, 'conversations').forEach((conversation) => {
    if (!isPlainRecord(conversation)) return;
    const conversationId = readString(conversation.id);
    const collaboratorId = readString(conversation.collaboratorId);
    if (!conversationId || !collaboratorId) return;
    ownerByConversationId.set(conversationId, collaboratorId);
    const projectId = readString(conversation.activeProjectId);
    if (projectId && !ownerByProjectId.has(projectId)) ownerByProjectId.set(projectId, collaboratorId);
  });
  return { ownerByConversationId, ownerByProjectId };
}

function sortCollectionReport(report: LocalDataCensusDomainReport): LocalDataCensusDomainReport {
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

export function buildCollectionCensusDomainReport(args: {
  kv: PersistedDbEntry[];
  byKey: Map<string, unknown>;
  knownOwnerIds: Set<string>;
  metaIds: Set<string>;
  binaryIds: Set<string>;
}): LocalDataCensusDomainReport {
  const report = emptyCollectionReport();
  const state = args.byKey.get(COLLECTION_STATE_KEY);
  const conversationOwners = buildConversationOwnerMaps(args.byKey.get(CHAT_CATALOG_KEY));
  const cards = readArray(state, 'cards');
  const imageCards = readArray(state, 'imageCards');
  const projectFiles = readArray(state, 'projectFiles');
  const roomProjects = readArray(state, 'roomProjects');
  const workspaceReferenceDocs = readArray(state, 'workspaceReferenceDocs');
  const assetRefs = new Set<string>();
  const declaredBodyKeys = new Set<string>();
  const declaredCharCounts = new Map<string, number>();
  const projectIds = new Set<string>();
  const projectOwnerById = new Map<string, string>();

  roomProjects.forEach((project) => {
    if (!isPlainRecord(project)) return;
    const projectId = readString(project.id);
    if (!projectId) return;
    const ownerCollaboratorId =
      readString(project.ownerCollaboratorId)
      ?? conversationOwners.ownerByProjectId.get(projectId)
      ?? null;
    if (ownerCollaboratorId) projectOwnerById.set(projectId, ownerCollaboratorId);
  });

  report.repositoryRowKeys = repositoryRowKeys(args.kv);
  report.legacySourceKeys = uniqueSortedIds(args.kv
    .filter((entry) => entry.key === 'collection-state-v1')
    .map((entry) => entry.key));

  collectOwnerScopedObjects({
    items: cards,
    kind: 'card',
    report,
    knownOwnerIds: args.knownOwnerIds,
    resolveRecoveredOwnerCollaboratorId: (item) => {
      const originConversationId = readString(item.originConversationId);
      return originConversationId ? conversationOwners.ownerByConversationId.get(originConversationId) ?? null : null;
    },
    onItem(item) {
      collectTextAssetRefs(assetRefs, item.code, item.cardFaceCss, item.cardNote);
    }
  });
  collectOwnerScopedObjects({
    items: imageCards,
    kind: 'image-card',
    report,
    knownOwnerIds: args.knownOwnerIds,
    resolveRecoveredOwnerCollaboratorId: (item) => {
      const originConversationId = readString(item.originConversationId);
      return originConversationId ? conversationOwners.ownerByConversationId.get(originConversationId) ?? null : null;
    },
    onItem(item) {
      const assetId = readString(item.assetId);
      if (assetId) assetRefs.add(assetId);
    }
  });
  collectOwnerScopedObjects({
    items: roomProjects,
    kind: 'project',
    report,
    knownOwnerIds: args.knownOwnerIds,
    resolveRecoveredOwnerCollaboratorId: (item) => {
      const projectId = readString(item.id);
      return projectId ? conversationOwners.ownerByProjectId.get(projectId) ?? null : null;
    },
    onItem(item) {
      const id = readString(item.id);
      if (id) projectIds.add(id);
      collectTextAssetRefs(assetRefs, item.coverStyle, item.coverNote);
    }
  });
  collectOwnerScopedObjects({
    items: projectFiles,
    kind: 'project-file',
    report,
    knownOwnerIds: args.knownOwnerIds,
    resolveRecoveredOwnerCollaboratorId: (item) => {
      const projectId = readString(item.projectId);
      return projectId ? projectOwnerById.get(projectId) ?? conversationOwners.ownerByProjectId.get(projectId) ?? null : null;
    },
    onItem(item, objectId) {
      const projectId = readString(item.projectId);
      if (!projectId || !projectIds.has(projectId)) report.metadataIssueIds.push(`projectFileProject:${objectId}`);
      collectTextAssetRefs(assetRefs, item.content);
    }
  });
  collectOwnerScopedObjects({
    items: workspaceReferenceDocs,
    kind: 'workspace-doc',
    report,
    knownOwnerIds: args.knownOwnerIds,
    resolveRecoveredOwnerCollaboratorId: (item) => {
      const projectId = readString(item.projectId);
      return projectId ? projectOwnerById.get(projectId) ?? conversationOwners.ownerByProjectId.get(projectId) ?? null : null;
    },
    onItem(item, objectId) {
      const projectId = readString(item.projectId);
      if (!projectId || !projectIds.has(projectId)) report.metadataIssueIds.push(`workspaceDocProject:${objectId}`);
      const bodyKey = encodedKey(objectId);
      declaredBodyKeys.add(bodyKey);
      declaredCharCounts.set(bodyKey, declaredReferenceDocCharCount(item));
      collectTextAssetRefs(assetRefs, item.content, item.summary);
    }
  });

  const bodyIndex = collectDocumentBodyCompletenessIndex({
    kv: args.kv,
    splitPrefix: WORKSPACE_DOC_SPLIT_PREFIX,
    chunkPrefix: WORKSPACE_DOC_CHUNK_PREFIX,
    declaredCharCounts
  });
  report.missingBodyObjectIds = uniqueSortedIds([...declaredBodyKeys].filter((docKey) => !bodyIndex.completeKeys.has(docKey)));
  report.orphanBodyObjectIds = uniqueSortedIds([...bodyIndex.bodyKeys].filter((docKey) => !declaredBodyKeys.has(docKey)));
  const assetClosure = buildAssetClosure(assetRefs, args.metaIds, args.binaryIds);
  report.assetRefIds = uniqueSortedIds(assetRefs);
  report.missingAssetMetaRefIds = assetClosure.missingMetaIds;
  report.missingAssetBinaryRefIds = assetClosure.missingBinaryIds;
  return sortCollectionReport(report);
}
