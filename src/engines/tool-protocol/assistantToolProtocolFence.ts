type AssistantToolFenceBlock = {
  label: string;
  body: string;
};

const CODE_FENCE_PATTERN = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
const INLINE_TOOL_LABEL_PATTERN = /^(polaris[-_]tools)\b(.*)$/i;

function normalizeFenceLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isAssistantToolFenceLabel(label: string) {
  if (!label) return false;
  const normalized = normalizeFenceLabel(label);
  return /\bpolaris[-_]tools\b/i.test(normalized);
}

function splitAssistantToolFence(label: string, body: string) {
  const trimmedLabel = label.trim();
  const trimmedBody = body.trim();

  if (trimmedBody) {
    return {
      label: trimmedLabel,
      body: trimmedBody
    };
  }

  const inlineMatch = trimmedLabel.match(INLINE_TOOL_LABEL_PATTERN);
  if (!inlineMatch) {
    return {
      label: trimmedLabel,
      body: trimmedBody
    };
  }

  return {
    label: inlineMatch[1].trim(),
    body: inlineMatch[2].trim()
  };
}

function normalizeDisplayContent(content: string) {
  return content
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractAssistantToolFenceBlocks(content: string): {
  displayContent: string;
  blocks: AssistantToolFenceBlock[];
} {
  const blocks: AssistantToolFenceBlock[] = [];
  const visibleSegments: string[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CODE_FENCE_PATTERN)) {
    const matchIndex = match.index ?? 0;
    visibleSegments.push(content.slice(lastIndex, matchIndex));

    const label = (match[1] ?? '').trim();
    const body = (match[2] ?? '').trim();
    if (isAssistantToolFenceLabel(label)) {
      blocks.push(splitAssistantToolFence(label, body));
    } else {
      visibleSegments.push(match[0]);
    }

    lastIndex = matchIndex + match[0].length;
  }

  visibleSegments.push(content.slice(lastIndex));

  return {
    displayContent: normalizeDisplayContent(visibleSegments.join('')),
    blocks
  };
}
