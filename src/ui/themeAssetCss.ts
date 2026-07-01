import { getAssetDataUrl } from '../infrastructure/assetStore';
import { extractPolarisAssetIds } from '../engines/assetReferences';

const POLARIS_ASSET_URL_PATTERN = /url\(\s*(["']?)polaris-asset:\/\/([^"')\s]+)\1\s*\)/g;

function escapeCssString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function extractThemeAssetIds(cssText: string) {
  return extractPolarisAssetIds(cssText);
}

export async function resolveThemeAssetUrls(cssText: string) {
  const assetIds = extractThemeAssetIds(cssText);
  if (assetIds.length === 0) return cssText;

  const dataUrlByAssetId = new Map<string, string | null>();
  await Promise.all(
    assetIds.map(async (assetId) => {
      try {
        dataUrlByAssetId.set(assetId, await getAssetDataUrl(assetId));
      } catch {
        dataUrlByAssetId.set(assetId, null);
      }
    })
  );

  return cssText.replace(POLARIS_ASSET_URL_PATTERN, (match, _quote: string, rawAssetId: string) => {
    const assetId = extractPolarisAssetIds(`polaris-asset://${rawAssetId.trim()}`)[0] ?? rawAssetId.trim();
    const dataUrl = dataUrlByAssetId.get(assetId);
    return dataUrl ? `url("${escapeCssString(dataUrl)}")` : match;
  });
}
