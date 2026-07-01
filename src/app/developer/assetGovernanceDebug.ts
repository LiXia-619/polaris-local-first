import { isDeveloperModeEnabled } from './developerModeRuntime';
import type { AssetAuditOwnerSummary, AssetAuditSummary } from '../../engines/assetGovernance';

export type AssetGovernanceDebugEntry = {
  at: number;
  reason: 'startup-audit' | 'manual-refresh';
  totalAssetCount: number;
  referencedAssetCount: number;
  orphanAssetCount: number;
  orphanPreviewCacheCount: number;
  imageCount: number;
  fileCount: number;
  totalBytes: number;
  totalBinaryBytes: number;
  totalPreviewBytes: number;
  deletedCount: number;
  deletedBytes: number;
  largestAssets: AssetAuditSummary['largestAssets'];
  largestOwners: AssetAuditOwnerSummary[];
  missingMetaAssetIds: string[];
  missingBinaryAssetIds: string[];
};

export const ASSET_GOVERNANCE_DEBUG_EVENT = 'polaris:asset-governance-updated';
const ASSET_GOVERNANCE_DEBUG_LIMIT = 12;

let entries: AssetGovernanceDebugEntry[] = [];

function dispatchAssetGovernanceDebugEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ASSET_GOVERNANCE_DEBUG_EVENT));
}

function isAssetGovernanceDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return isDeveloperModeEnabled() || new URLSearchParams(window.location.search).get('debugAssets') === '1';
  } catch {
    return isDeveloperModeEnabled();
  }
}

export function readAssetGovernanceDebugEntries() {
  return entries;
}

export function clearAssetGovernanceDebugEntries() {
  entries = [];
  dispatchAssetGovernanceDebugEvent();
}

export function buildAssetGovernanceDebugEntry(params: {
  audit: AssetAuditSummary;
  deletedCount?: number;
  reason: AssetGovernanceDebugEntry['reason'];
}) {
  const { audit, deletedCount = 0, reason } = params;
  const deletedBytes = deletedCount > 0 ? audit.orphanTotalBytes : 0;
  const deletedAssetCount = deletedCount > 0 ? audit.orphanAssetCount : 0;
  const deletedPreviewCacheCount = deletedCount > 0 ? audit.orphanPreviewCacheCount : 0;
  const deletedPreviewBytes = deletedCount > 0
    ? audit.orphanPreviewBytes + audit.orphanPreviewCacheBytes
    : 0;

  return {
    at: Date.now(),
    reason,
    totalAssetCount: Math.max(0, audit.totalAssetCount - deletedAssetCount),
    referencedAssetCount: audit.referencedAssetCount,
    orphanAssetCount: Math.max(0, audit.orphanAssetCount - deletedAssetCount),
    orphanPreviewCacheCount: Math.max(0, audit.orphanPreviewCacheCount - deletedPreviewCacheCount),
    imageCount: audit.imageCount,
    fileCount: audit.fileCount,
    totalBytes: Math.max(0, audit.totalBytes - deletedBytes),
    totalBinaryBytes: Math.max(0, audit.totalBinaryBytes - (deletedCount > 0 ? audit.orphanBinaryBytes : 0)),
    totalPreviewBytes: Math.max(0, audit.totalPreviewBytes - deletedPreviewBytes),
    deletedCount,
    deletedBytes,
    largestAssets: audit.largestAssets,
    largestOwners: audit.largestOwners,
    missingMetaAssetIds: audit.missingMetaAssetIds,
    missingBinaryAssetIds: audit.missingBinaryAssetIds
  } satisfies AssetGovernanceDebugEntry;
}

export function recordAssetGovernanceDebugEntry(entry: AssetGovernanceDebugEntry) {
  if (!isAssetGovernanceDebugEnabled()) return;

  entries = [...entries, entry].slice(-ASSET_GOVERNANCE_DEBUG_LIMIT);
  console.info('[asset-governance]', {
    reason: entry.reason,
    assets: entry.totalAssetCount,
    referenced: entry.referencedAssetCount,
    orphan: entry.orphanAssetCount,
    deleted: entry.deletedCount,
    totalBytes: entry.totalBytes
  });
  dispatchAssetGovernanceDebugEvent();
}
