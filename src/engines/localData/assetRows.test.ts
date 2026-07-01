import { describe, expect, it } from 'vitest';
import type { StoredAssetMeta } from '../../infrastructure/assetStore';
import { buildAssetLocalDataProjection } from './assetRows';

function meta(seed: Partial<StoredAssetMeta> & Pick<StoredAssetMeta, 'id'>): StoredAssetMeta {
  return {
    kind: 'image',
    name: `${seed.id}.png`,
    mimeType: 'image/png',
    size: 10,
    createdAt: 1,
    ...seed
  };
}

describe('buildAssetLocalDataProjection', () => {
  it('projects complete asset rows and marks broken asset records as incomplete', () => {
    const projection = buildAssetLocalDataProjection({
      version: 7,
      updatedAt: 100,
      state: {
        meta: [
          meta({ id: 'asset-owned' }),
          meta({ id: 'asset-orphan', kind: 'file', name: 'old.txt', mimeType: 'text/plain' }),
          meta({ id: 'asset-missing-binary' })
        ],
        binary: [
          { id: 'asset-owned', bytes: 10 },
          { id: 'asset-orphan', bytes: 3 },
          { id: 'asset-missing-meta', bytes: 2 }
        ],
        preview: [
          { id: 'asset-owned', bytes: 4 },
          { id: 'asset-preview-only', bytes: 1 }
        ],
        ownersByAssetId: new Map([
          ['asset-owned', [{ kind: 'image-card', id: 'image-1', label: 'Hero' }]],
          ['asset-missing-binary', [{ kind: 'persona', id: 'pharos', label: 'Pharos' }]]
        ])
      }
    });

    const ownedRow = projection.objectRows.find((row) => row.ref.id === 'asset-owned');
    const orphanRow = projection.objectRows.find((row) => row.ref.id === 'asset-orphan');
    const missingBinaryRow = projection.objectRows.find((row) => row.ref.id === 'asset-missing-binary');
    const missingMetaRow = projection.objectRows.find((row) => row.ref.id === 'asset-missing-meta');
    const previewOnlyRow = projection.objectRows.find((row) => row.ref.id === 'asset-preview-only');

    expect(projection.domainMetaRow.value).toEqual(expect.objectContaining({
      activeObjectCount: 1,
      totalObjectCount: 5,
      objectCounts: { image: 2, file: 1, unknown: 2 },
      orphanObjectCount: 1,
      missingMetaCount: 2,
      missingBinaryCount: 1,
      previewOnlyCount: 1,
      totalBinaryBytes: 15,
      totalPreviewBytes: 5
    }));
    expect(ownedRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        id: 'asset-owned',
        ownerCount: 1,
        orphan: false,
        hasBinary: true,
        hasPreview: true,
        binaryBytes: 10,
        previewBytes: 4
      })
    }));
    expect(orphanRow).toEqual(expect.objectContaining({
      state: 'complete',
      value: expect.objectContaining({
        id: 'asset-orphan',
        kind: 'file',
        orphan: true
      })
    }));
    expect(missingBinaryRow).toEqual(expect.objectContaining({
      state: 'incomplete',
      reason: 'missing-binary',
      missingKeys: ['asset-binary:asset-missing-binary']
    }));
    expect(missingMetaRow).toEqual(expect.objectContaining({
      state: 'incomplete',
      reason: 'missing-meta',
      missingKeys: ['asset-meta:asset-missing-meta']
    }));
    expect(previewOnlyRow).toEqual(expect.objectContaining({
      state: 'incomplete',
      reason: 'preview-only',
      missingKeys: ['asset-meta:asset-preview-only', 'asset-binary:asset-preview-only']
    }));
  });
});
