import { describe, expect, it } from 'vitest';
import type { AssetAuditSummary } from '../../engines/assetGovernance';
import { buildAssetGovernanceDebugEntry } from './assetGovernanceDebug';

function makeAudit(overrides: Partial<AssetAuditSummary>): AssetAuditSummary {
  return {
    referencedAssetIds: new Set(),
    entries: [],
    ownerSummaries: [],
    totalAssetCount: 2,
    referencedAssetCount: 1,
    orphanAssetCount: 1,
    imageCount: 1,
    fileCount: 1,
    totalBinaryBytes: 160,
    totalPreviewBytes: 35,
    totalBytes: 195,
    orphanBinaryBytes: 40,
    orphanPreviewBytes: 0,
    orphanTotalBytes: 60,
    orphanAssetIds: ['asset-orphan'],
    orphanPreviewCacheCount: 1,
    orphanPreviewCacheBytes: 20,
    orphanPreviewCacheIds: ['asset-preview-only'],
    missingMetaAssetIds: [],
    missingBinaryAssetIds: [],
    largestAssets: [],
    largestOwners: [],
    ...overrides
  };
}

describe('buildAssetGovernanceDebugEntry', () => {
  it('subtracts deleted asset entities and preview caches from the right buckets', () => {
    const entry = buildAssetGovernanceDebugEntry({
      audit: makeAudit({}),
      deletedCount: 2,
      reason: 'manual-refresh'
    });

    expect(entry.totalAssetCount).toBe(1);
    expect(entry.orphanAssetCount).toBe(0);
    expect(entry.orphanPreviewCacheCount).toBe(0);
    expect(entry.totalBinaryBytes).toBe(120);
    expect(entry.totalPreviewBytes).toBe(15);
    expect(entry.totalBytes).toBe(135);
    expect(entry.deletedBytes).toBe(60);
  });
});
