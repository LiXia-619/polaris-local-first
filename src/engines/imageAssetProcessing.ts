export const IMAGE_STORAGE_MAX_EDGE_PX = 1080;
export const IMAGE_STORAGE_JPEG_QUALITY = 0.85;
export const IMAGE_PREVIEW_MAX_EDGE_PX = 768;
export const IMAGE_PREVIEW_JPEG_QUALITY = 0.82;

export type ImageResizeDimensions = {
  width: number;
  height: number;
};

function normalizedRasterMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase().split(';')[0];
  return normalized === 'image/png' || normalized === 'image/jpeg' || normalized === 'image/webp'
    ? normalized
    : null;
}

export function shouldProcessRasterImage(mimeType: string) {
  return normalizedRasterMimeType(mimeType) !== null;
}

export function resolveImageResizeDimensions(
  width: number,
  height: number,
  maxEdge: number
): ImageResizeDimensions | null {
  if (width <= 0 || height <= 0 || maxEdge <= 0) return null;
  const largestEdge = Math.max(width, height);
  if (largestEdge <= maxEdge) return null;
  const scale = maxEdge / largestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function loadImageElement(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('图片处理失败。'));
    };
    image.src = imageUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function renderImageBlob(
  image: HTMLImageElement,
  dimensions: ImageResizeDimensions,
  mimeType: string,
  quality?: number
) {
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  return await canvasToBlob(canvas, mimeType, quality);
}

export async function prepareStoredImageBlob(params: {
  blob: Blob;
  mimeType: string;
}): Promise<{ blob: Blob; mimeType: string; previewBlob: Blob | null }> {
  const mimeType = normalizedRasterMimeType(params.mimeType);
  if (
    !mimeType
    || typeof document === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return { blob: params.blob, mimeType: params.mimeType, previewBlob: null };
  }

  try {
    const image = await loadImageElement(params.blob);
    const originalDimensions = {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
    const storageResizeDimensions = resolveImageResizeDimensions(
      originalDimensions.width,
      originalDimensions.height,
      IMAGE_STORAGE_MAX_EDGE_PX
    );
    const storageDimensions = storageResizeDimensions ?? originalDimensions;
    const storageQuality =
      mimeType === 'image/jpeg' || mimeType === 'image/webp'
        ? IMAGE_STORAGE_JPEG_QUALITY
        : undefined;
    const compressedBlob = storageResizeDimensions === null
      ? null
      : await renderImageBlob(image, storageDimensions, mimeType, storageQuality);
    const storageBlob =
      compressedBlob && compressedBlob.size < params.blob.size
        ? compressedBlob
        : params.blob;

    const previewDimensions = resolveImageResizeDimensions(
      originalDimensions.width,
      originalDimensions.height,
      IMAGE_PREVIEW_MAX_EDGE_PX
    );
    const previewQuality =
      mimeType === 'image/jpeg' || mimeType === 'image/webp'
        ? IMAGE_PREVIEW_JPEG_QUALITY
        : undefined;
    const previewBlob = previewDimensions
      ? await renderImageBlob(image, previewDimensions, mimeType, previewQuality)
      : null;

    return {
      blob: storageBlob,
      mimeType,
      previewBlob: previewBlob && previewBlob.size < storageBlob.size ? previewBlob : null
    };
  } catch {
    return { blob: params.blob, mimeType: params.mimeType, previewBlob: null };
  }
}
