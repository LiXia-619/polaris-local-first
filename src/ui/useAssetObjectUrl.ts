import { useEffect, useState } from 'react';
import {
  getAssetBlob,
  getAssetMeta,
  getAssetPreviewBlob,
  type StoredAssetMeta
} from '../infrastructure/assetStore';
import { reportPersistenceError } from '../infrastructure/persistenceDiagnostics';

function canCreateObjectUrl() {
  return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
}

export function useAssetObjectUrl(assetId: string | undefined, preferPreview = false) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return;
    }

    let revokedUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const blob = preferPreview
          ? (await getAssetPreviewBlob(assetId)) ?? (await getAssetBlob(assetId))
          : await getAssetBlob(assetId);
        if (!blob || cancelled) {
          setUrl(null);
          return;
        }

        if (!canCreateObjectUrl()) {
          setUrl(null);
          return;
        }

        revokedUrl = URL.createObjectURL(blob);
        setUrl(revokedUrl);
      } catch (error) {
        reportPersistenceError({ label: '[asset:display]', store: 'asset', operation: 'read-url' }, error);
        if (!cancelled) {
          setUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [assetId, preferPreview]);

  return url;
}

export function useAssetMeta(assetId: string | undefined) {
  const [meta, setMeta] = useState<StoredAssetMeta | null>(null);

  useEffect(() => {
    if (!assetId) {
      setMeta(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const nextMeta = await getAssetMeta(assetId);
        if (!cancelled) {
          setMeta(nextMeta);
        }
      } catch (error) {
        reportPersistenceError({ label: '[asset:display]', store: 'asset', operation: 'read-meta' }, error);
        if (!cancelled) {
          setMeta(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return meta;
}
