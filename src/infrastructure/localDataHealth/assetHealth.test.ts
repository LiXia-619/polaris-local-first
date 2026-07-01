import { describe, expect, it } from 'vitest';
import { buildLocalAssetStorageHealth } from './assetHealth';

const meta = (id: string) => ({
  key: id,
  value: { id, kind: 'file' as const, name: `${id}.bin`, mimeType: 'application/octet-stream', size: 4, createdAt: 1 }
});

describe('buildLocalAssetStorageHealth', () => {
  it('reconciles meta against binary keys without reading blob bytes', () => {
    const health = buildLocalAssetStorageHealth({
      assetMeta: [meta('asset-1'), meta('asset-missing-binary')],
      assetBinaryKeys: ['asset-1', 'asset-orphan-binary'],
      assetPreviewKeys: ['asset-1', 'asset-preview-only']
    });

    expect(health).toEqual({
      metaCount: 2,
      binaryCount: 2,
      previewCount: 2,
      completeAssetCount: 1,
      missingBinaryAssetCount: 1,
      orphanBinaryAssetCount: 1,
      orphanPreviewCacheCount: 1,
      oversizedPreviewCount: 0
    });
  });

  it('flags previews that are not smaller than their backing binary', () => {
    const health = buildLocalAssetStorageHealth({
      assetMeta: [meta('asset-1')],
      assetBinarySizes: [{ key: 'asset-1', size: 100 }],
      assetPreviewSizes: [{ key: 'asset-1', size: 100 }]
    });

    expect(health.oversizedPreviewCount).toBe(1);
  });

  it('treats full blob entries and key/size pairs as the same evidence', () => {
    const fromEntries = buildLocalAssetStorageHealth({
      assetMeta: [meta('asset-1')],
      assetBinary: [{ key: 'asset-1', value: new Blob(['1234']) }],
      assetPreview: [{ key: 'asset-1', value: new Blob(['12']) }]
    });

    expect(fromEntries).toEqual({
      metaCount: 1,
      binaryCount: 1,
      previewCount: 1,
      completeAssetCount: 1,
      missingBinaryAssetCount: 0,
      orphanBinaryAssetCount: 0,
      orphanPreviewCacheCount: 0,
      oversizedPreviewCount: 0
    });
  });
});
