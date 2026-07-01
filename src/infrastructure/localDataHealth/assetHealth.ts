import type { PersistedDbEntry, PersistedDbEntrySize } from '../persistence';
import type { StoredAssetMeta } from '../assetStore';

export type LocalAssetStorageHealth = {
  metaCount: number;
  binaryCount: number;
  previewCount: number;
  completeAssetCount: number;
  missingBinaryAssetCount: number;
  orphanBinaryAssetCount: number;
  orphanPreviewCacheCount: number;
  oversizedPreviewCount: number;
};

/**
 * Asset evidence the consistency check reads. Binary and preview blobs may arrive either as full
 * entries (`mode: 'full'`) or as key/size pairs (lightweight metadata mode); either form answers
 * meta/binary/preview reconciliation without loading blob bytes.
 */
export type AssetHealthSource = {
  assetMeta: PersistedDbEntry<StoredAssetMeta>[];
  assetBinary?: PersistedDbEntry<Blob>[];
  assetPreview?: PersistedDbEntry<Blob>[];
  assetBinarySizes?: PersistedDbEntrySize[];
  assetPreviewSizes?: PersistedDbEntrySize[];
  assetBinaryKeys?: string[];
  assetPreviewKeys?: string[];
};

function readAssetBinaryIds(source: Pick<AssetHealthSource, 'assetBinary' | 'assetBinaryKeys'>) {
  return source.assetBinary
    ? source.assetBinary.map((entry) => entry.key)
    : source.assetBinaryKeys ?? [];
}

function readAssetPreviewIds(source: Pick<AssetHealthSource, 'assetPreview' | 'assetPreviewKeys'>) {
  return source.assetPreview
    ? source.assetPreview.map((entry) => entry.key)
    : source.assetPreviewKeys ?? [];
}

function buildAssetSizeMap(
  entries: PersistedDbEntry<Blob>[] | undefined,
  sizes: PersistedDbEntrySize[] | undefined
) {
  if (sizes) return new Map(sizes.map((entry) => [entry.key, entry.size]));
  return new Map((entries ?? []).map((entry) => [entry.key, entry.value.size]));
}

export function buildLocalAssetStorageHealth(source: AssetHealthSource): LocalAssetStorageHealth {
  const metaIds = new Set(source.assetMeta.map((entry) => entry.key));
  const binarySizeById = buildAssetSizeMap(source.assetBinary, source.assetBinarySizes);
  const previewSizeById = buildAssetSizeMap(source.assetPreview, source.assetPreviewSizes);
  const binaryIds = new Set(readAssetBinaryIds(source));
  const previewIds = new Set(readAssetPreviewIds(source));

  return {
    metaCount: metaIds.size,
    binaryCount: binaryIds.size,
    previewCount: previewIds.size,
    completeAssetCount: [...metaIds].filter((assetId) => binaryIds.has(assetId)).length,
    missingBinaryAssetCount: [...metaIds].filter((assetId) => !binaryIds.has(assetId)).length,
    orphanBinaryAssetCount: [...binaryIds].filter((assetId) => !metaIds.has(assetId)).length,
    orphanPreviewCacheCount: [...previewIds].filter((assetId) => (
      !metaIds.has(assetId) && !binaryIds.has(assetId)
    )).length,
    oversizedPreviewCount: [...previewSizeById.entries()].filter(([assetId, previewBytes]) => {
      const binaryBytes = binarySizeById.get(assetId) ?? 0;
      return binaryBytes > 0 && previewBytes >= binaryBytes;
    }).length
  };
}
