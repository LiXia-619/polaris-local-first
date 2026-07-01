export type PolarisCssPartBlock = {
  target: string;
  name?: string;
  css: string;
  raw: string;
};

export type PolarisCssPartUpsertResult = {
  changed: boolean;
  nextCss: string;
  parts: PolarisCssPartBlock[];
};

const POLARIS_PART_BLOCK_PATTERN = /\/\*\s*@polaris-part\s+([^*]*?)\*\/([\s\S]*?)\/\*\s*@end-polaris-part\s*\*\//gi;
const POLARIS_PART_ATTR_PATTERN = /([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;

function readPartAttributes(source: string) {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(POLARIS_PART_ATTR_PATTERN)) {
    const key = match[1]?.trim();
    const value = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (key && value) attributes.set(key, value);
  }
  return attributes;
}

export function parsePolarisCssParts(cssText: string): PolarisCssPartBlock[] {
  const parts: PolarisCssPartBlock[] = [];
  for (const match of cssText.matchAll(POLARIS_PART_BLOCK_PATTERN)) {
    const attributes = readPartAttributes(match[1] ?? '');
    const target = attributes.get('target')?.trim();
    const css = match[2]?.trim() ?? '';
    if (!target || !css) continue;
    parts.push({
      target,
      name: attributes.get('name'),
      css,
      raw: match[0].trim()
    });
  }
  return parts;
}

export function hasPolarisCssParts(cssText: string) {
  return parsePolarisCssParts(cssText).length > 0;
}

export function upsertPolarisCssParts(baseCss: string, incomingCss: string): PolarisCssPartUpsertResult {
  const incomingParts = parsePolarisCssParts(incomingCss);
  if (incomingParts.length === 0) {
    return {
      changed: false,
      nextCss: incomingCss,
      parts: []
    };
  }

  const incomingByTarget = new Map(incomingParts.map((part) => [part.target, part]));
  let lastIndex = 0;
  const preservedBlocks: string[] = [];

  for (const match of baseCss.matchAll(POLARIS_PART_BLOCK_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before = baseCss.slice(lastIndex, start).trim();
    if (before) preservedBlocks.push(before);
    lastIndex = end;

    const attributes = readPartAttributes(match[1] ?? '');
    const target = attributes.get('target')?.trim();
    if (!target || !incomingByTarget.has(target)) {
      preservedBlocks.push(match[0].trim());
    }
  }

  const tail = baseCss.slice(lastIndex).trim();
  if (tail) preservedBlocks.push(tail);

  return {
    changed: true,
    nextCss: [...preservedBlocks, ...incomingParts.map((part) => part.raw)].filter(Boolean).join('\n\n').trim(),
    parts: incomingParts
  };
}
