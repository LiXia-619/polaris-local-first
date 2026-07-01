const POLARIS_ASSET_URL_PATTERN = /polaris-asset:\/\/([^"')\s<>`\\,;，。！？、：；（）【】《》“”‘’{}\[\]]+)/g;
const PLACEHOLDER_ASSET_IDS = new Set(['...', 'assetId']);

function decodeAssetId(rawAssetId: string) {
  try {
    return decodeURIComponent(rawAssetId);
  } catch {
    return rawAssetId;
  }
}

export function extractPolarisAssetIds(text: string | undefined | null) {
  if (!text) return [];

  const ids = new Set<string>();
  for (const match of text.matchAll(POLARIS_ASSET_URL_PATTERN)) {
    const rawAssetId = match[1]?.trim();
    const assetId = rawAssetId ? decodeAssetId(rawAssetId) : '';
    if (assetId && !PLACEHOLDER_ASSET_IDS.has(assetId)) ids.add(assetId);
  }
  return Array.from(ids);
}
