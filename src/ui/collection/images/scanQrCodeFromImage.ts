import jsQR from 'jsqr';

const MAX_SCAN_EDGE = 2048;

export type QrCodeScanResult = {
  text: string;
  openUrl: string | null;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，无法识别二维码。'));
    image.src = src;
  });
}

function resolveOpenUrl(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return /^https?:$/i.test(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function scanQrCodeFromImage(src: string): Promise<QrCodeScanResult> {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持识别二维码。');
  }

  const image = await loadImage(src);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('图片尺寸异常，无法识别二维码。');
  }

  const scale = Math.min(1, MAX_SCAN_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前设备不支持图片识别。');
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth'
  });

  if (!decoded?.data?.trim()) {
    throw new Error('这张图里没认到二维码。');
  }

  const text = decoded.data.trim();
  return {
    text,
    openUrl: resolveOpenUrl(text)
  };
}
