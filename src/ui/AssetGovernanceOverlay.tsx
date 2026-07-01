import type { AssetGovernanceDebugEntry } from '../app/developer/assetGovernanceDebug';

type AssetGovernanceOverlayProps = {
  enabled: boolean;
  latestEntry: AssetGovernanceDebugEntry | null;
  entryCount: number;
  clearEntries: () => void;
  refresh: () => Promise<void>;
  onClose: () => void;
};

function formatTimestamp(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function formatOwnerKind(kind: AssetGovernanceDebugEntry['largestOwners'][number]['kind']) {
  if (kind === 'conversation') return 'chat';
  if (kind === 'image-card') return 'image';
  return 'pending';
}

export function AssetGovernanceOverlay({
  enabled,
  latestEntry,
  entryCount,
  clearEntries,
  refresh,
  onClose
}: AssetGovernanceOverlayProps) {
  if (!enabled) return null;

  const largestAssetSummary = latestEntry?.largestAssets
    .slice(0, 3)
    .map((asset) => `${asset.name.slice(0, 18)} ${formatBytes(asset.totalBytes)}`)
    .join(' · ');
  const largestOwnerSummary = latestEntry?.largestOwners
    .slice(0, 3)
    .map((owner) => `${formatOwnerKind(owner.kind)} ${owner.label.slice(0, 14)} ${formatBytes(owner.totalBytes)}`)
    .join(' · ');
  const heaviestOwner = latestEntry?.largestOwners[0] ?? null;
  const heaviestOwnerAssets = heaviestOwner?.topAssets
    .map((asset) => `${asset.name.slice(0, 14)} ${formatBytes(asset.totalBytes)}`)
    .join(' · ');

  return (
    <aside className="asset-governance-overlay">
      <div className="asset-governance-header">
        <strong>asset audit</strong>
        <div className="asset-governance-actions">
          <button type="button" onClick={() => { void refresh(); }}>refresh</button>
          <button type="button" onClick={clearEntries}>clear</button>
          <button type="button" className="debug-overlay-close-button" onClick={onClose} aria-label="关闭 asset audit">×</button>
        </div>
      </div>

      {latestEntry ? (
        <>
          <span>{formatTimestamp(latestEntry.at)}</span>
          <span>{`reason ${latestEntry.reason}`}</span>
          <span>{`entries ${entryCount}`}</span>
          <span>{`assets ${latestEntry.referencedAssetCount}/${latestEntry.totalAssetCount}`}</span>
          <span>{`images ${latestEntry.imageCount} · files ${latestEntry.fileCount}`}</span>
          <span>{`size ${formatBytes(latestEntry.totalBytes)}`}</span>
          <span>{`binary ${formatBytes(latestEntry.totalBinaryBytes)} · preview ${formatBytes(latestEntry.totalPreviewBytes)}`}</span>
          <span>{`orphans ${latestEntry.orphanAssetCount} · preview cache ${latestEntry.orphanPreviewCacheCount} · cleaned ${latestEntry.deletedCount}`}</span>
          <span>{`cleaned size ${formatBytes(latestEntry.deletedBytes)}`}</span>
          <span>{`missing meta ${latestEntry.missingMetaAssetIds.length} · binary ${latestEntry.missingBinaryAssetIds.length}`}</span>
          <span>{`largest ${largestAssetSummary || 'none'}`}</span>
          <span>{`owners ${largestOwnerSummary || 'none'}`}</span>
          <span>{`focus ${heaviestOwner ? `${heaviestOwner.label.slice(0, 16)} -> ${heaviestOwnerAssets || 'none'}` : 'none'}`}</span>
        </>
      ) : (
        <span>no asset audit captured</span>
      )}
    </aside>
  );
}
