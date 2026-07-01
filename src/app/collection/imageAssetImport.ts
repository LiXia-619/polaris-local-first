import { saveAsset } from '../../infrastructure/assetStore';
import { isGenericImageTitle } from '../../engines/imageAssetNaming';
import {
  prepareStoredImageBlob,
  resolveImageResizeDimensions,
  shouldProcessRasterImage,
  IMAGE_PREVIEW_MAX_EDGE_PX
} from '../../engines/imageAssetProcessing';
import { buildInternalApiEndpoint } from '../../engines/chat-api/chatApiEndpoint';
import type { CreateImageCardFromAssetInput } from '../../stores/collectionStoreImageCards';
import type { SaveFromChatResult } from '../../stores/collectionStoreCodeCards';
import type { ImageAssetCard } from '../../types/domain';

export type ImageCardAssetCreator = (input: CreateImageCardFromAssetInput) => SaveFromChatResult | null;

export type ImageBlobImport = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  title?: string;
};

type ImagePreviewDimensions = {
  width: number;
  height: number;
};

export function imageMimeFromFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  return '';
}

function imageExtensionFromMime(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'png';
}

export function shouldCreateImagePreview(mimeType: string) {
  return shouldProcessRasterImage(mimeType);
}

export function resolveImagePreviewDimensions(
  width: number,
  height: number,
  maxEdge = IMAGE_PREVIEW_MAX_EDGE_PX
): ImagePreviewDimensions | null {
  return resolveImageResizeDimensions(width, height, maxEdge);
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || Boolean(imageMimeFromFileName(file.name));
}

function resolveImageFileNameFromUrl(url: URL, mimeType: string) {
  const pathParts = url.pathname.split('/').filter(Boolean);
  const rawName = pathParts[pathParts.length - 1] ?? '';
  const decodedName = (() => {
    try {
      return decodeURIComponent(rawName).trim();
    } catch {
      return rawName.trim();
    }
  })();
  if (decodedName && imageMimeFromFileName(decodedName)) return decodedName;
  const extension = imageExtensionFromMime(mimeType);
  return decodedName ? `${decodedName}.${extension}` : `imported-image-${Date.now()}.${extension}`;
}

function cleanUrlCandidate(value: string) {
  return value.trim().replace(/[),，。；;、]+$/g, '');
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(cleanUrlCandidate(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function extractFirstHttpUrl(value: string) {
  const directUrl = parseHttpUrl(value);
  if (directUrl) return directUrl;

  const matches = value.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  const parsed = matches
    .map(parseHttpUrl)
    .filter((url): url is URL => Boolean(url));
  return parsed.find((url) => url.pathname.startsWith('/shared-materials/')) ?? parsed[0] ?? null;
}

function normalizeImageImportUrl(url: URL) {
  if (url.pathname.startsWith('/shared-materials/')) {
    return buildInternalApiEndpoint(`${url.pathname}${url.search}`);
  }
  return url.toString();
}

function resolveUrlForMetadata(rawUrl: string) {
  if (/^\//.test(rawUrl)) {
    const currentOrigin =
      typeof window !== 'undefined' && typeof window.location?.origin === 'string'
        ? window.location.origin
        : 'http://localhost';
    return new URL(rawUrl, currentOrigin);
  }
  return new URL(rawUrl);
}

export function parseImageImportTextInput(rawInput: string) {
  const lines = rawInput.split(/\r?\n/);
  const titleLine = lines
    .map((line) => line.match(/^\s*名称\s*[:：]\s*(.+?)\s*$/)?.[1]?.trim() ?? '')
    .find(Boolean);
  const linkLine = lines
    .map((line) => line.match(/^\s*链接\s*[:：]\s*(.+?)\s*$/)?.[1]?.trim() ?? '')
    .find(Boolean);
  const url = extractFirstHttpUrl(linkLine || rawInput);
  if (!url) {
    throw new Error('图片链接需要是 http 或 https 地址。');
  }

  const title = titleLine && !isGenericImageTitle(titleLine) ? titleLine : undefined;
  return { url: normalizeImageImportUrl(url), title };
}

export async function fetchImageBlobFromUrl(rawUrl: string): Promise<ImageBlobImport> {
  const parsedInput = parseImageImportTextInput(rawUrl);
  const url = resolveUrlForMetadata(parsedInput.url);

  let response: Response;
  try {
    response = await fetch(parsedInput.url);
  } catch {
    throw new Error('这个链接不允许 Polaris 直接读取，可以先下载图片再上传。');
  }
  if (!response.ok) {
    throw new Error(`图片链接读取失败（${response.status}）。`);
  }

  const blob = await response.blob();
  const fileName = resolveImageFileNameFromUrl(url, blob.type);
  const mimeType = blob.type.startsWith('image/') ? blob.type : imageMimeFromFileName(fileName);
  if (!mimeType) {
    throw new Error('这个链接返回的不是图片。');
  }
  return { blob, fileName, mimeType, title: parsedInput.title };
}

export async function saveImageAssetCard(params: {
  blob: Blob;
  fileName: string;
  mimeType: string;
  title?: string;
  source: ImageAssetCard['source'];
  ownerCollaboratorId?: string;
  createImageCardFromAsset: ImageCardAssetCreator;
}) {
  const processedImage = await prepareStoredImageBlob({
    blob: params.blob,
    mimeType: params.mimeType
  });
  const asset = await saveAsset({
    kind: 'image',
    name: params.fileName,
    mimeType: processedImage.mimeType,
    blob: processedImage.blob,
    previewBlob: processedImage.previewBlob
  });

  return params.createImageCardFromAsset({
    assetId: asset.id,
    imageName: params.fileName,
    title: params.title,
    ownerCollaboratorId: params.ownerCollaboratorId,
    source: params.source
  });
}
