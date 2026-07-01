const THEME_LAYER_BLOCK_PATTERN = /\/\*\s*polaris-layer:start\s+([^\s*]+)\s*\*\/\s*([\s\S]*?)\s*\/\*\s*polaris-layer:end\s+\1\s*\*\//gi;

export type ParsedThemeLayer = {
  id: string;
  cssText: string;
};

export function wrapThemeCssLayer(layerId: string, cssText: string): string {
  const normalizedCss = cssText.trim();
  if (!normalizedCss) return '';
  return `/* polaris-layer:start ${layerId} */\n${normalizedCss}\n/* polaris-layer:end ${layerId} */`;
}

export function parseThemeLayers(cssText: string) {
  const layers = new Map<string, ParsedThemeLayer>();
  const order: string[] = [];
  let remainder = '';
  let lastIndex = 0;

  for (const match of cssText.matchAll(THEME_LAYER_BLOCK_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const id = match[1]?.trim();
    const layerCss = match[2]?.trim();

    remainder += cssText.slice(lastIndex, start);
    lastIndex = end;

    if (!id || !layerCss) continue;
    if (!layers.has(id)) order.push(id);
    layers.set(id, { id, cssText: layerCss });
  }

  remainder += cssText.slice(lastIndex);

  return {
    layers: order.map((id) => layers.get(id)).filter((layer): layer is ParsedThemeLayer => Boolean(layer)),
    remainder: remainder.trim()
  };
}
