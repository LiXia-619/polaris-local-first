export const IMAGE_ASSET_TAGS = [
  '二维码',
  '正片',
  '参考图',
  '截图',
  '生成图'
] as const;

export type ImageAssetTag = (typeof IMAGE_ASSET_TAGS)[number];

const IMAGE_ASSET_TAG_SET = new Set<string>(IMAGE_ASSET_TAGS);
const MAX_IMAGE_ASSET_TAGS = 3;

export function normalizeImageAssetTags(tags: string[] | undefined): ImageAssetTag[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => tag.trim())
    .filter((tag): tag is ImageAssetTag => IMAGE_ASSET_TAG_SET.has(tag))
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, MAX_IMAGE_ASSET_TAGS);
}

export function inferImageAssetTags(input: {
  title?: string;
  imageName: string;
}): ImageAssetTag[] {
  const haystack = [input.title, input.imageName].filter(Boolean).join('\n').toLowerCase();
  if (!haystack) return [];

  if (/(^|[^a-z])(qr|qrcode)([^a-z]|$)|二维码/.test(haystack)) return ['二维码'];
  if (/截图|截屏|screen\s?shot|screenshot/.test(haystack)) return ['截图'];
  if (/参考|ref\b|reference/.test(haystack)) return ['参考图'];
  if (/生成|generated|gen\b|render/.test(haystack)) return ['生成图'];
  if (/正片|final/.test(haystack)) return ['正片'];
  return [];
}
