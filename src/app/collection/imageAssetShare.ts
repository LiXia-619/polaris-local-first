import { buildInternalApiEndpoint } from '../../engines/chat-api/chatApiEndpoint';
import { getAssetBlob, getAssetMeta } from '../../infrastructure/assetStore';
import type { ImageAssetCard } from '../../types/domain';

type MaterialShareResponse = {
  ok: true;
  shareId: string;
  url: string;
  mimeType: string;
  size: number;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('读取图片失败'));
        return;
      }
      const commaIndex = reader.result.indexOf(',');
      resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

async function parseMaterialShareResponse(response: Response): Promise<MaterialShareResponse> {
  const payload = await response.json().catch(() => null) as
    | MaterialShareResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    const message = payload && 'error' in payload && payload.error?.message
      ? payload.error.message
      : '素材分享发布失败。';
    throw new Error(message);
  }

  if (!payload || !('ok' in payload) || !payload.ok || !payload.url || !payload.shareId) {
    throw new Error('素材分享服务返回异常。');
  }

  return payload;
}

export async function publishImageAssetShare(card: ImageAssetCard) {
  const [blob, meta] = await Promise.all([
    getAssetBlob(card.assetId),
    getAssetMeta(card.assetId)
  ]);

  if (!blob) {
    throw new Error('这张素材的本地图片内容不存在。');
  }

  const mimeType = (meta?.mimeType || blob.type || '').trim().toLowerCase();
  if (!mimeType.startsWith('image/')) {
    throw new Error('只有图片素材可以带出门。');
  }

  const response = await fetch(buildInternalApiEndpoint('/api/material-shares'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: card.title || meta?.name || 'Polaris 素材',
      mimeType,
      dataBase64: await blobToBase64(blob)
    })
  });

  return await parseMaterialShareResponse(response);
}
