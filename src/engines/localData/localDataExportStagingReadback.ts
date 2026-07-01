import { collectAssetReferenceOwners } from '../assetGovernance';
import type { StoredAssetMeta } from '../../infrastructure/assetStore';
import type { PersistedDbEntry } from '../../infrastructure/persistence';
import { buildChatMigrationRehearsalFromChatState } from './chatMigrationDryRun';
import { commitChatMigrationRehearsalAndBuildValidationReport } from './chatMigrationReadback';
import { buildCollectionMigrationCensusResult, buildCollectionMigrationPlan } from './collectionMigration';
import { buildPersonaMigrationCensusResult, buildPersonaMigrationPlan } from './personaMigration';
import { buildRuntimeMigrationCensusResult, buildRuntimeMigrationPlan } from './runtimeMigration';
import { buildSpaceMigrationCensusResult, buildSpaceMigrationPlan } from './spaceMigration';
import { buildDocumentMigrationCensusResult, buildDocumentMigrationPlan } from './documentMigration';
import { buildAssetMigrationCensusResult, buildAssetMigrationPlan } from './assetMigration';
import { buildDocumentLocalDataStateFromSources } from './documentSources';
import { buildLocalDataCensusReport } from './localDataCensusReport';
import type { LocalDataCensusReport } from './localDataCensusReportTypes';
import {
  buildLocalDataExportRehearsalFromZipReader,
  type LocalDataExportRehearsal,
  type LocalDataExportZipReader
} from './localDataExportRehearsal';
import { createLocalDataMemoryBackend } from './localDataMemoryBackend';
import { assertValidMigrationPromotionReport } from './migrationValidation';
import { buildLocalDataPromotionReadinessReport, type LocalDataPromotionReadinessReport } from './promotionReadiness';
import { createLocalDataRepository } from './repository';
import { buildLocalDataStoreHydrationValidationReports } from './storeHydrationValidation';
import {
  LOCAL_DATA_SCHEMA_VERSION,
  type LocalDataCommitMeta,
  type LocalDataDomain,
  type LocalDataMigrationValidationReport
} from './types';

type DomainCommitSummary = {
  commitMeta: LocalDataCommitMeta;
  expectedRepositoryRowCount: number;
  actualRepositoryRowCount: number;
  ok: boolean;
  blockers: string[];
  warnings: string[];
};

export type LocalDataExportStagingReadbackReport = {
  ok: boolean;
  source: {
    baselineObjectCount: number;
    activeObjectCount: number;
    legacySourceCount: number;
    missingBodyObjectCount: number;
    unresolvedOwnerObjectCount: number;
    danglingOwnerObjectCount: number;
    missingAssetMetaRefCount: number;
    missingAssetBinaryRefCount: number;
  };
  repository: {
    activeDataSource: LocalDataCensusReport['activeDataSource'];
    rowCount: number;
    pointerCount: number;
  };
  chat: DomainCommitSummary & {
    contentPromotionReady: boolean;
    stagingHydrated: boolean;
    conversationCount: number;
    quarantinedObjectCount: number;
    duplicateObjectIdCount: number;
    missingActiveCollaboratorIdCount: number;
  };
  collection: DomainCommitSummary;
  persona: DomainCommitSummary;
  runtime: DomainCommitSummary;
  space: DomainCommitSummary;
  document: DomainCommitSummary & {
    missingBodyCount: number;
    incompleteChunkCount: number;
    orphanBodyCount: number;
  };
  asset: DomainCommitSummary & {
    activeObjectCount: number;
    orphanObjectCount: number;
    missingMetaCount: number;
    missingBinaryCount: number;
    previewOnlyCount: number;
  };
  readiness: LocalDataPromotionReadinessReport;
  validationFailures: Partial<Record<Exclude<LocalDataDomain, 'chat'>, string>>;
  census: LocalDataCensusReport;
};

function repositoryRowsForDomain(report: LocalDataCensusReport, domain: LocalDataDomain) {
  return report.domains.find((entry) => entry.domain === domain)?.repositoryRowKeys.length ?? 0;
}

function knownCollaboratorIds(rehearsal: LocalDataExportRehearsal) {
  return Array.from(new Set([
    ...rehearsal.personaState.personas.map((persona) => persona.id),
    ...rehearsal.runtimeState.companionConnections
      .map((connection) => connection.collaboratorId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  ])).sort();
}

function assetBlobEntries(rehearsal: LocalDataExportRehearsal) {
  const binaryEntries = new Map(
    rehearsal.assetIndex.map((asset) => [asset.id, { id: asset.id, bytes: asset.size }])
  );
  const previewEntries = new Map(
    rehearsal.assetIndex
      .filter((asset) => typeof asset.previewPath === 'string' && asset.previewPath.trim().length > 0)
      .map((asset) => [asset.id, { id: asset.id, bytes: 0 }])
  );
  return {
    binary: Array.from(binaryEntries.values()),
    preview: Array.from(previewEntries.values())
  };
}

function assetMetaEntries(rehearsal: LocalDataExportRehearsal): StoredAssetMeta[] {
  return rehearsal.assetIndex.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    createdAt: asset.createdAt,
    textContent: asset.textContent
  }));
}

function buildCensusFromStagedEntries(args: {
  rehearsal: LocalDataExportRehearsal;
  kv: PersistedDbEntry[];
}) {
  return buildLocalDataCensusReport({
    ...args.rehearsal.source,
    kv: args.kv
  });
}

function summarizeDomain(args: {
  domain: LocalDataDomain;
  commitMeta: LocalDataCommitMeta;
  expectedRepositoryRowCount: number;
  census: LocalDataCensusReport;
  ok: boolean;
}): DomainCommitSummary {
  return {
    commitMeta: args.commitMeta,
    expectedRepositoryRowCount: args.expectedRepositoryRowCount,
    actualRepositoryRowCount: repositoryRowsForDomain(args.census, args.domain),
    ok: args.ok,
    blockers: args.census.blockers.filter((blocker) => blocker.startsWith(`${args.domain}:`)),
    warnings: args.census.warnings.filter((warning) => warning.startsWith(`${args.domain}:`))
  };
}

function isChatPromotionReady(commitMeta: LocalDataCommitMeta, report: LocalDataMigrationValidationReport) {
  try {
    assertValidMigrationPromotionReport(commitMeta, report);
    return true;
  } catch {
    return false;
  }
}

export async function buildLocalDataExportStagingReadbackReportFromZipReader(args: {
  zip: LocalDataExportZipReader;
  version?: number;
  committedAt?: number;
  validatedAt?: number;
}): Promise<LocalDataExportStagingReadbackReport> {
  const committedAt = args.committedAt ?? Date.now();
  const validatedAt = args.validatedAt ?? committedAt;
  const version = args.version ?? LOCAL_DATA_SCHEMA_VERSION;
  const rehearsal = await buildLocalDataExportRehearsalFromZipReader(args.zip);
  const backend = createLocalDataMemoryBackend(rehearsal.source.kv);
  const repository = createLocalDataRepository({
    backend,
    now: () => committedAt
  });

  const chatRehearsal = buildChatMigrationRehearsalFromChatState({
    chatState: rehearsal.chatState,
    version,
    committedAt,
    unitId: `export-chat-staging-${committedAt}`,
    knownCollaboratorIds: knownCollaboratorIds(rehearsal)
  });
  const chatReadback = await commitChatMigrationRehearsalAndBuildValidationReport({
    repository,
    rehearsal: chatRehearsal,
    validatedAt
  });
  const chatContentPromotionReady = isChatPromotionReady(chatReadback.commitMeta, chatReadback.validationReport);

  const collectionPlan = buildCollectionMigrationPlan({
    id: `export-collection-staging-${committedAt}`,
    state: rehearsal.collectionState,
    activeProjectId: rehearsal.spaceState.collectionProjectId,
    version,
    updatedAt: committedAt
  });
  const collectionMeta = await repository.commit(collectionPlan.unitOfWork);

  const personaPlan = buildPersonaMigrationPlan({
    id: `export-persona-staging-${committedAt}`,
    state: {
      personas: rehearsal.personaState.personas,
      activeCollaboratorId: rehearsal.personaState.activeCollaboratorId ?? null,
      seededDefaultPersonaIds: rehearsal.personaState.seededDefaultPersonaIds ?? []
    },
    version,
    updatedAt: committedAt
  });
  const personaMeta = await repository.commit(personaPlan.unitOfWork);

  const runtimePlan = buildRuntimeMigrationPlan({
    id: `export-runtime-staging-${committedAt}`,
    state: rehearsal.runtimeState,
    version,
    updatedAt: committedAt
  });
  const runtimeMeta = await repository.commit(runtimePlan.unitOfWork);

  const spacePlan = buildSpaceMigrationPlan({
    id: `export-space-staging-${committedAt}`,
    state: rehearsal.spaceState,
    version,
    updatedAt: committedAt
  });
  const spaceMeta = await repository.commit(spacePlan.unitOfWork);

  const documentPlan = buildDocumentMigrationPlan({
    id: `export-document-staging-${committedAt}`,
    state: buildDocumentLocalDataStateFromSources({
      kv: rehearsal.source.kv,
      personas: rehearsal.personaState.personas,
      workspaceReferenceDocs: rehearsal.collectionState.workspaceReferenceDocs,
      updatedAt: committedAt
    }),
    version,
    updatedAt: committedAt
  });
  const documentMeta = await repository.commit(documentPlan.unitOfWork);

  const assetBlobs = assetBlobEntries(rehearsal);
  const assetPlan = buildAssetMigrationPlan({
    id: `export-asset-staging-${committedAt}`,
    state: {
      meta: assetMetaEntries(rehearsal),
      binary: assetBlobs.binary,
      preview: assetBlobs.preview,
      ownersByAssetId: collectAssetReferenceOwners({
        conversations: rehearsal.chatState.conversations,
        codeCards: rehearsal.collectionState.cards,
        imageCards: rehearsal.collectionState.imageCards,
        projectFiles: rehearsal.collectionState.projectFiles,
        workspaceReferenceDocs: rehearsal.collectionState.workspaceReferenceDocs,
        roomProjects: rehearsal.collectionState.roomProjects,
        personas: rehearsal.personaState.personas,
        theme: rehearsal.spaceState.theme,
        collaboratorThemes: rehearsal.spaceState.collaboratorThemes,
        customization: rehearsal.spaceState.customization,
        pendingAttachments: []
      })
    },
    version,
    updatedAt: committedAt
  });
  const assetMeta = await repository.commit(assetPlan.unitOfWork);

  const census = buildCensusFromStagedEntries({
    rehearsal,
    kv: backend.entries()
  });
  const storeValidation = buildLocalDataStoreHydrationValidationReports({
    kv: backend.entries(),
    censusDomains: census.domains,
    validatedAt
  });
  const validationReports: Partial<Record<LocalDataDomain, LocalDataMigrationValidationReport>> = {
    chat: chatReadback.validationReport,
    ...storeValidation.validationReports
  };
  const readiness = buildLocalDataPromotionReadinessReport({
    kv: backend.entries(),
    censusReport: census,
    validationReports
  });
  const collectionCensus = buildCollectionMigrationCensusResult({
    plan: collectionPlan,
    commitMeta: collectionMeta,
    censusReport: census
  });
  const personaCensus = buildPersonaMigrationCensusResult({
    plan: personaPlan,
    commitMeta: personaMeta,
    censusReport: census
  });
  const runtimeCensus = buildRuntimeMigrationCensusResult({
    plan: runtimePlan,
    commitMeta: runtimeMeta,
    censusReport: census
  });
  const spaceCensus = buildSpaceMigrationCensusResult({
    plan: spacePlan,
    commitMeta: spaceMeta,
    censusReport: census
  });
  const documentCensus = buildDocumentMigrationCensusResult({
    plan: documentPlan,
    commitMeta: documentMeta,
    censusReport: census
  });
  const assetCensus = buildAssetMigrationCensusResult({
    plan: assetPlan,
    commitMeta: assetMeta,
    censusReport: census
  });
  const domainPromotionReady = (domain: LocalDataDomain) => (
    readiness.domains.find((entry) => entry.domain === domain)?.promotionReady === true
  );

  return {
    ok: readiness.canHydrate && readiness.canPromote,
    source: {
      baselineObjectCount: census.totals.baselineObjectCount,
      activeObjectCount: census.totals.activeObjectCount,
      legacySourceCount: census.totals.legacySourceCount,
      missingBodyObjectCount: census.totals.missingBodyObjectCount,
      unresolvedOwnerObjectCount: census.totals.unresolvedOwnerObjectCount,
      danglingOwnerObjectCount: census.totals.danglingOwnerObjectCount,
      missingAssetMetaRefCount: census.totals.missingAssetMetaRefCount,
      missingAssetBinaryRefCount: census.totals.missingAssetBinaryRefCount
    },
    repository: {
      activeDataSource: census.activeDataSource,
      rowCount: census.repositoryRowCount,
      pointerCount: census.pointerCount
    },
    chat: {
      ...summarizeDomain({
        domain: 'chat',
        commitMeta: chatReadback.commitMeta,
        expectedRepositoryRowCount: chatRehearsal.unitOfWork.mutations.length,
        census,
        ok: domainPromotionReady('chat')
      }),
      contentPromotionReady: chatContentPromotionReady,
      stagingHydrated: chatReadback.validationReport.stagingHydrated,
      conversationCount: chatReadback.validationReport.activeObjectCount,
      quarantinedObjectCount: chatReadback.validationReport.quarantinedObjectCount,
      duplicateObjectIdCount: chatReadback.validationReport.duplicateObjectIdCount,
      missingActiveCollaboratorIdCount: chatReadback.validationReport.missingActiveCollaboratorIdCount
    },
    collection: summarizeDomain({
      domain: 'collection',
      commitMeta: collectionMeta,
      expectedRepositoryRowCount: collectionCensus.expectedRepositoryRowCount,
      census,
      ok: domainPromotionReady('collection')
    }),
    persona: summarizeDomain({
      domain: 'persona',
      commitMeta: personaMeta,
      expectedRepositoryRowCount: personaCensus.expectedRepositoryRowCount,
      census,
      ok: domainPromotionReady('persona')
    }),
    runtime: summarizeDomain({
      domain: 'runtime',
      commitMeta: runtimeMeta,
      expectedRepositoryRowCount: runtimeCensus.expectedRepositoryRowCount,
      census,
      ok: domainPromotionReady('runtime')
    }),
    space: summarizeDomain({
      domain: 'space',
      commitMeta: spaceMeta,
      expectedRepositoryRowCount: spaceCensus.expectedRepositoryRowCount,
      census,
      ok: domainPromotionReady('space')
    }),
    document: {
      ...summarizeDomain({
        domain: 'document',
        commitMeta: documentMeta,
        expectedRepositoryRowCount: documentCensus.expectedRepositoryRowCount,
        census,
        ok: domainPromotionReady('document')
      }),
      missingBodyCount: documentCensus.missingBodyCount,
      incompleteChunkCount: documentCensus.incompleteChunkCount,
      orphanBodyCount: documentCensus.orphanBodyCount
    },
    asset: {
      ...summarizeDomain({
        domain: 'asset',
        commitMeta: assetMeta,
        expectedRepositoryRowCount: assetCensus.expectedRepositoryRowCount,
        census,
        ok: domainPromotionReady('asset')
      }),
      activeObjectCount: assetCensus.activeObjectCount,
      orphanObjectCount: assetCensus.orphanObjectCount,
      missingMetaCount: assetCensus.missingMetaCount,
      missingBinaryCount: assetCensus.missingBinaryCount,
      previewOnlyCount: assetCensus.previewOnlyCount
    },
    readiness,
    validationFailures: storeValidation.failures,
    census
  };
}

export function formatLocalDataExportStagingReadbackReport(report: LocalDataExportStagingReadbackReport) {
  const domainLine = (label: string, domain: DomainCommitSummary) => (
    `${label}: ok=${domain.ok} rows=${domain.actualRepositoryRowCount}/${domain.expectedRepositoryRowCount} warnings=${domain.warnings.length} blockers=${domain.blockers.length}`
  );
  return [
    `ok: ${report.ok}`,
    `activeDataSource: ${report.repository.activeDataSource}`,
    `repository: rows=${report.repository.rowCount} pointers=${report.repository.pointerCount}`,
    `source: baseline=${report.source.baselineObjectCount} active=${report.source.activeObjectCount} legacySources=${report.source.legacySourceCount} missingBodies=${report.source.missingBodyObjectCount} unresolvedOwners=${report.source.unresolvedOwnerObjectCount} danglingOwners=${report.source.danglingOwnerObjectCount} missingAssets=${report.source.missingAssetMetaRefCount}/${report.source.missingAssetBinaryRefCount}`,
    `chat: ok=${report.chat.ok} contentReady=${report.chat.contentPromotionReady} stagingHydrated=${report.chat.stagingHydrated} conversations=${report.chat.conversationCount} rows=${report.chat.actualRepositoryRowCount}/${report.chat.expectedRepositoryRowCount} missingCollaborators=${report.chat.missingActiveCollaboratorIdCount}`,
    domainLine('collection', report.collection),
    domainLine('persona', report.persona),
    domainLine('runtime', report.runtime),
    domainLine('space', report.space),
    `${domainLine('document', report.document)} missingBodies=${report.document.missingBodyCount} orphanBodies=${report.document.orphanBodyCount}`,
    `${domainLine('asset', report.asset)} active=${report.asset.activeObjectCount} orphan=${report.asset.orphanObjectCount} missing=${report.asset.missingMetaCount}/${report.asset.missingBinaryCount} previewOnly=${report.asset.previewOnlyCount}`,
    `readiness: canHydrate=${report.readiness.canHydrate} canPromote=${report.readiness.canPromote} blockers=${report.readiness.blockers.length} warnings=${report.readiness.warnings.length} validationFailures=${Object.keys(report.validationFailures).length}`
  ].join('\n');
}
