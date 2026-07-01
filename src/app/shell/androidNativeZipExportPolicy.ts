import type { StoredAssetMeta } from '../../infrastructure/assetStore';

const ANDROID_NATIVE_ZIP_JS_BLOB_FALLBACK_MAX_BYTES = 32 * 1024 * 1024;

export function shouldReadPersistedAssetBlobDuringAndroidNativeZip(
  asset: StoredAssetMeta,
  role: 'primary' | 'preview'
) {
  if (role === 'preview') return true;

  // Large persisted assets must be streamed by native file copy. Reading them
  // through NativePersistence.get() turns the file into one base64 bridge payload.
  return asset.size <= ANDROID_NATIVE_ZIP_JS_BLOB_FALLBACK_MAX_BYTES;
}
