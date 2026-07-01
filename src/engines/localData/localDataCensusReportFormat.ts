import type { LocalDataCensusReport } from './localDataCensusReportTypes';

export function formatLocalDataCensusReport(report: LocalDataCensusReport) {
  const lines = [
    `ok: ${report.ok ? 'true' : 'false'}`,
    `activeDataSource: ${report.activeDataSource}`,
    `knownCollaborators: ${report.knownCollaboratorIds.length}`,
    `knownOwners: ${report.knownOwnerIds.length}`,
    `repositoryRows: ${report.repositoryRowCount}`,
    `pointers: ${report.pointerCount}`,
    `baselineObjects: ${report.totals.baselineObjectCount}`,
    `activeObjects: ${report.totals.activeObjectCount}`,
    `legacySources: ${report.totals.legacySourceCount}`,
    `missingOwners: ${report.totals.missingOwnerObjectCount}`,
    `recoverableOwners: ${report.totals.recoverableOwnerObjectCount}`,
    `unresolvedOwners: ${report.totals.unresolvedOwnerObjectCount}`,
    `danglingOwners: ${report.totals.danglingOwnerObjectCount}`,
    `missingBodies: ${report.totals.missingBodyObjectCount}`,
    `orphanBodies: ${report.totals.orphanBodyObjectCount}`,
    `missingAssetMetaRefs: ${report.totals.missingAssetMetaRefCount}`,
    `missingAssetBinaryRefs: ${report.totals.missingAssetBinaryRefCount}`,
    `metadataIssues: ${report.totals.metadataIssueCount}`,
    `blockers: ${report.blockers.join(',') || 'none'}`,
    `warnings: ${report.warnings.join(',') || 'none'}`
  ];

  report.domains.forEach((domain) => {
    lines.push(
      `${domain.domain}: baseline=${domain.baselineObjectIds.length} active=${domain.activeObjectIds.length} legacy=${domain.legacySourceKeys.length} repo=${domain.repositoryRowKeys.length} missingOwner=${domain.missingOwnerObjectIds.length} recoverableOwner=${domain.recoverableOwnerObjectIds.length} unresolvedOwner=${domain.unresolvedOwnerObjectIds.length} danglingOwner=${domain.danglingOwnerObjectIds.length} missingBody=${domain.missingBodyObjectIds.length} orphanBody=${domain.orphanBodyObjectIds.length} missingAssetMeta=${domain.missingAssetMetaRefIds.length} missingAssetBinary=${domain.missingAssetBinaryRefIds.length} metadataIssues=${domain.metadataIssueIds.length}`
    );
  });

  return lines.join('\n');
}
