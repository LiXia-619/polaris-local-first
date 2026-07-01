import type { StoredAssetMeta } from '../../infrastructure/assetStore';
import type { PersistedDbEntry } from '../../infrastructure/persistence';

export type LocalDataCensusReportDomain =
  | 'asset'
  | 'chat'
  | 'collection'
  | 'document'
  | 'persona'
  | 'runtime'
  | 'space';

export type LocalDataCensusReportSource = {
  kv: PersistedDbEntry[];
  assetMeta: PersistedDbEntry<StoredAssetMeta>[];
  assetBinary?: PersistedDbEntry<Blob>[];
  assetPreview?: PersistedDbEntry<Blob>[];
  assetBinaryKeys?: string[];
  assetPreviewKeys?: string[];
  localStorage: Array<{ key: string; value: string }>;
};

export type LocalDataCensusDomainReport = {
  domain: LocalDataCensusReportDomain;
  baselineObjectIds: string[];
  activeObjectIds: string[];
  repositoryRowKeys: string[];
  legacySourceKeys: string[];
  missingOwnerObjectIds: string[];
  recoverableOwnerObjectIds: string[];
  unresolvedOwnerObjectIds: string[];
  danglingOwnerObjectIds: string[];
  missingBodyObjectIds: string[];
  orphanBodyObjectIds: string[];
  assetRefIds: string[];
  missingAssetMetaRefIds: string[];
  missingAssetBinaryRefIds: string[];
  metadataIssueIds: string[];
};

export type LocalDataCensusReport = {
  ok: boolean;
  activeDataSource: 'repository' | 'unknown';
  repositoryRowCount: number;
  pointerCount: number;
  knownCollaboratorIds: string[];
  knownOwnerIds: string[];
  domains: LocalDataCensusDomainReport[];
  totals: {
    baselineObjectCount: number;
    activeObjectCount: number;
    legacySourceCount: number;
    repositoryRowCount: number;
    missingOwnerObjectCount: number;
    recoverableOwnerObjectCount: number;
    unresolvedOwnerObjectCount: number;
    danglingOwnerObjectCount: number;
    missingBodyObjectCount: number;
    orphanBodyObjectCount: number;
    missingAssetMetaRefCount: number;
    missingAssetBinaryRefCount: number;
    metadataIssueCount: number;
  };
  blockers: string[];
  warnings: string[];
};
