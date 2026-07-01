import { createAttachmentFromAsset, getAssetBlob, saveAsset } from '../infrastructure/assetStore';
import type { ChatAttachment } from '../types/domain';
import type { ToolResult } from './toolResult';

export type ImagePaletteColor = {
  hex: string;
  count: number;
  ratio: number;
  luminance: number;
};

export type ImageAssetInspection = {
  assetId: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  hasTransparency: boolean;
  averageColor: string;
  averageLuminance: number;
  suggestedTextColor: '#111827' | '#f8fafc';
  palette: ImagePaletteColor[];
  cssUrl: string;
};

export type ImageVariantPurpose = 'background' | 'bubble-sticker' | 'avatar' | 'thumbnail';
export type ImageVariantFit = 'cover' | 'contain';

export type CreateImageVariantOptions = {
  purpose?: ImageVariantPurpose;
  width?: number;
  height?: number;
  fit?: ImageVariantFit;
  blur?: number;
  dim?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  name?: string;
};

export type InspectImageAssetResult = ToolResult<ImageAssetInspection & {
  detailText: string;
}>;

export type ExtractImagePaletteResult = ToolResult<{
  assetId: string;
  name: string;
  cssUrl: string;
  averageColor: string;
  suggestedTextColor: '#111827' | '#f8fafc';
  palette: ImagePaletteColor[];
  themeVariables: {
    background: string;
    surface: string;
    accent: string;
    text: '#111827' | '#f8fafc';
  };
  detailText: string;
}>;

export type CreateImageVariantResult = ToolResult<{
  attachment: ChatAttachment;
  sourceAttachment: ChatAttachment;
  cssUrl: string;
  width: number;
  height: number;
  purpose: ImageVariantPurpose;
  detailText: string;
}>;

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

type Rgb = { r: number; g: number; b: number };

const PURPOSE_SIZE: Record<ImageVariantPurpose, { width: number; height: number }> = {
  background: { width: 1080, height: 1920 },
  'bubble-sticker': { width: 512, height: 512 },
  avatar: { width: 512, height: 512 },
  thumbnail: { width: 720, height: 720 }
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((part) => Math.round(clamp(part, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

function luminance({ r, g, b }: Rgb) {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

function buildCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('当前环境无法创建图片画布。');
  return { canvas, ctx };
}

async function loadImageFromBlob(blob: Blob): Promise<LoadedImage> {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('当前运行环境不支持本地图片处理。');
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('图片加载失败。'));
  });

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    dispose: () => URL.revokeObjectURL(objectUrl)
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('图片导出失败。'));
    }, mimeType, quality);
  });
}

function drawContainOrCover(
  ctx: CanvasRenderingContext2D,
  source: LoadedImage,
  width: number,
  height: number,
  fit: ImageVariantFit
) {
  const scale = fit === 'contain'
    ? Math.min(width / source.width, height / source.height)
    : Math.max(width / source.width, height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;
  ctx.drawImage(source.source, dx, dy, drawWidth, drawHeight);
}

function normalizeVariantOptions(options: CreateImageVariantOptions | undefined) {
  const purpose = options?.purpose ?? 'background';
  const fallback = PURPOSE_SIZE[purpose];
  const width = clamp(Math.round(options?.width ?? fallback.width), 64, 4096);
  const height = clamp(Math.round(options?.height ?? fallback.height), 64, 4096);
  const format = options?.format ?? (purpose === 'background' ? 'jpeg' : 'png');
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return {
    purpose,
    width,
    height,
    fit: options?.fit ?? 'cover',
    blur: clamp(options?.blur ?? 0, 0, 48),
    dim: clamp(options?.dim ?? 0, 0, 0.86),
    mimeType,
    quality: clamp(options?.quality ?? 0.88, 0.3, 1),
    name: options?.name?.trim()
  };
}

export function analyzeImageData(
  imageData: ImageData,
  maxPaletteColors = 6
): Pick<ImageAssetInspection, 'hasTransparency' | 'averageColor' | 'averageLuminance' | 'suggestedTextColor' | 'palette'> {
  const buckets = new Map<string, { rgb: Rgb; count: number }>();
  const data = imageData.data;
  let total = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let transparent = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 255;
    if (alpha < 250) transparent += 1;
    if (alpha < 16) continue;
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    total += 1;
    sumR += r;
    sumG += g;
    sumB += b;
    const bucketRgb = {
      r: Math.round(r / 32) * 32,
      g: Math.round(g / 32) * 32,
      b: Math.round(b / 32) * 32
    };
    const key = `${bucketRgb.r},${bucketRgb.g},${bucketRgb.b}`;
    const current = buckets.get(key);
    if (current) {
      current.count += 1;
    } else {
      buckets.set(key, { rgb: bucketRgb, count: 1 });
    }
  }

  const averageRgb = total > 0
    ? { r: sumR / total, g: sumG / total, b: sumB / total }
    : { r: 255, g: 255, b: 255 };
  const averageLuminance = luminance(averageRgb);
  const palette = [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, maxPaletteColors)
    .map((entry) => ({
      hex: toHex(entry.rgb),
      count: entry.count,
      ratio: total > 0 ? entry.count / total : 0,
      luminance: luminance(entry.rgb)
    }));

  return {
    hasTransparency: transparent > 0,
    averageColor: toHex(averageRgb),
    averageLuminance,
    suggestedTextColor: averageLuminance > 0.56 ? '#111827' : '#f8fafc',
    palette
  };
}

async function inspectBlob(blob: Blob, sourceAttachment: ChatAttachment): Promise<InspectImageAssetResult> {
  const loaded = await loadImageFromBlob(blob);
  try {
    const sampleWidth = Math.min(240, loaded.width);
    const sampleHeight = Math.max(1, Math.round((sampleWidth / loaded.width) * loaded.height));
    const { ctx } = buildCanvas(sampleWidth, sampleHeight);
    ctx.drawImage(loaded.source, 0, 0, sampleWidth, sampleHeight);
    const analysis = analyzeImageData(ctx.getImageData(0, 0, sampleWidth, sampleHeight));
    const cssUrl = `url("polaris-asset://${sourceAttachment.assetId}")`;
    const detailText = [
      `${sourceAttachment.name} · ${loaded.width}x${loaded.height} · ${sourceAttachment.mimeType}`,
      `css: ${cssUrl}`,
      `average: ${analysis.averageColor} · text: ${analysis.suggestedTextColor} · alpha: ${analysis.hasTransparency ? 'yes' : 'no'}`,
      `palette: ${analysis.palette.map((color) => color.hex).join(' / ')}`
    ].join('\n');
    return {
      ok: true,
      assetId: sourceAttachment.assetId,
      name: sourceAttachment.name,
      mimeType: sourceAttachment.mimeType,
      width: loaded.width,
      height: loaded.height,
      aspectRatio: loaded.width / loaded.height,
      cssUrl,
      detailText,
      ...analysis
    };
  } finally {
    loaded.dispose();
  }
}

export async function inspectImageAttachment(sourceAttachment: ChatAttachment): Promise<InspectImageAssetResult> {
  if (sourceAttachment.kind !== 'image') {
    return { ok: false, error: '目标附件不是图片。' };
  }
  const blob = await getAssetBlob(sourceAttachment.assetId);
  if (!blob) {
    return { ok: false, error: `图片资产不存在：${sourceAttachment.assetId}` };
  }
  return inspectBlob(blob, sourceAttachment);
}

export async function extractImageAttachmentPalette(sourceAttachment: ChatAttachment): Promise<ExtractImagePaletteResult> {
  const inspection = await inspectImageAttachment(sourceAttachment);
  if (!inspection.ok) return inspection;
  const accent = inspection.palette.find((color) => color.ratio >= 0.04)?.hex ?? inspection.averageColor;
  const surface = inspection.palette.find((color) => color.luminance > 0.72 || color.luminance < 0.28)?.hex ?? inspection.averageColor;
  return {
    ok: true,
    assetId: inspection.assetId,
    name: inspection.name,
    cssUrl: inspection.cssUrl,
    averageColor: inspection.averageColor,
    suggestedTextColor: inspection.suggestedTextColor,
    palette: inspection.palette,
    themeVariables: {
      background: inspection.averageColor,
      surface,
      accent,
      text: inspection.suggestedTextColor
    },
    detailText: [
      `${inspection.name} 调色板`,
      `background=${inspection.averageColor}`,
      `surface=${surface}`,
      `accent=${accent}`,
      `text=${inspection.suggestedTextColor}`,
      `palette=${inspection.palette.map((color) => color.hex).join(' / ')}`
    ].join('\n')
  };
}

export async function createImageAttachmentVariant(
  sourceAttachment: ChatAttachment,
  options?: CreateImageVariantOptions
): Promise<CreateImageVariantResult> {
  if (sourceAttachment.kind !== 'image') {
    return { ok: false, error: '目标附件不是图片。' };
  }
  const sourceBlob = await getAssetBlob(sourceAttachment.assetId);
  if (!sourceBlob) {
    return { ok: false, error: `图片资产不存在：${sourceAttachment.assetId}` };
  }

  const normalized = normalizeVariantOptions(options);
  const loaded = await loadImageFromBlob(sourceBlob);
  try {
    const { canvas, ctx } = buildCanvas(normalized.width, normalized.height);
    ctx.save();
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, normalized.width, normalized.height);
    if (normalized.blur > 0) {
      ctx.filter = `blur(${normalized.blur}px)`;
    }
    drawContainOrCover(ctx, loaded, normalized.width, normalized.height, normalized.fit);
    ctx.restore();
    if (normalized.dim > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${normalized.dim})`;
      ctx.fillRect(0, 0, normalized.width, normalized.height);
    }
    const blob = await canvasToBlob(canvas, normalized.mimeType, normalized.quality);
    const extension = normalized.mimeType === 'image/jpeg' ? 'jpg' : normalized.mimeType === 'image/webp' ? 'webp' : 'png';
    const baseName = sourceAttachment.name.replace(/\.[a-z0-9]+$/i, '').trim() || 'image';
    const name = normalized.name || `${baseName}-${normalized.purpose}.${extension}`;
    const meta = await saveAsset({
      kind: 'image',
      name,
      mimeType: normalized.mimeType,
      blob,
      previewBlob: blob
    });
    const attachment = await createAttachmentFromAsset({
      assetId: meta.id,
      kind: meta.kind,
      name: meta.name,
      mimeType: meta.mimeType,
      size: meta.size
    });
    const cssUrl = `url("polaris-asset://${meta.id}")`;
    return {
      ok: true,
      attachment,
      sourceAttachment,
      cssUrl,
      width: normalized.width,
      height: normalized.height,
      purpose: normalized.purpose,
      detailText: [
        `${sourceAttachment.name} -> ${name}`,
        `${normalized.purpose} · ${normalized.width}x${normalized.height} · ${normalized.fit}`,
        `css: ${cssUrl}`
      ].join('\n')
    };
  } finally {
    loaded.dispose();
  }
}
