import { Capacitor } from '@capacitor/core';
import { getAssetBlob } from '../infrastructure/assetStore';
import { bytesToBase64 } from './nativeBase64';

const POLARIS_ALBUM_NAME = 'Polaris';

export function canSaveToPhotoAlbum() {
  return Capacitor.isNativePlatform();
}

// Android 的 savePhoto 必须落在某个相册里；iOS 不传就进相机胶卷
async function resolveAndroidAlbumIdentifier(media: typeof import('@capacitor-community/media').Media) {
  const { albums } = await media.getAlbums();
  const existing = albums.find((album) => album.name === POLARIS_ALBUM_NAME);
  if (existing) return existing.identifier;
  await media.createAlbum({ name: POLARIS_ALBUM_NAME });
  const refreshed = await media.getAlbums();
  return refreshed.albums.find((album) => album.name === POLARIS_ALBUM_NAME)?.identifier;
}

/**
 * 把素材图片存进系统相册（原生端），网页端降级为下载。
 * 返回去向，调用方据此给提示。
 */
export async function saveAssetToPhotoAlbum(assetId: string, fileName?: string): Promise<'album' | 'download'> {
  const blob = await getAssetBlob(assetId);
  if (!blob) throw new Error('图片数据不在本机。');

  if (Capacitor.isNativePlatform()) {
    const { Media } = await import('@capacitor-community/media');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = blob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
    const albumIdentifier = Capacitor.getPlatform() === 'android'
      ? await resolveAndroidAlbumIdentifier(Media)
      : undefined;
    await Media.savePhoto({
      path: dataUrl,
      fileName,
      ...(albumIdentifier ? { albumIdentifier } : {})
    });
    return 'album';
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || `polaris-${assetId.slice(0, 8)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
  return 'download';
}
