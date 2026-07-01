type InlineThinkingReply = {
  content: string;
  thinkingText?: string;
};

export type InlineThinkingTagParseResult = {
  visibleContent: string;
  thinkingTexts: string[];
};

const OPEN_TAG_PATTERN = /<\s*(think|thinking|thought)\s*>/gi;

function createCloseTagPattern(tagName: string) {
  return new RegExp(`<\\s*/\\s*${tagName}\\s*>`, 'i');
}

function appendThinkingText(existing: string | undefined, additions: string[]) {
  const existingText = existing?.trim();
  const addedText = additions
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n\n');
  if (!addedText) return existing;
  return existingText ? `${existingText}\n\n${addedText}` : addedText;
}

export function parseInlineThinkingTags(input: string): InlineThinkingTagParseResult {
  const visible: string[] = [];
  const thinkingTexts: string[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    OPEN_TAG_PATTERN.lastIndex = cursor;
    const openMatch = OPEN_TAG_PATTERN.exec(input);
    if (!openMatch) {
      visible.push(input.slice(cursor));
      break;
    }

    const openStart = openMatch.index;
    const openEnd = openStart + openMatch[0].length;
    const tagName = openMatch[1].toLowerCase();
    const closeMatch = createCloseTagPattern(tagName).exec(input.slice(openEnd));

    if (!closeMatch) {
      visible.push(input.slice(cursor));
      break;
    }

    const closeStart = openEnd + closeMatch.index;
    const closeEnd = closeStart + closeMatch[0].length;
    const thinkingText = input.slice(openEnd, closeStart).trim();

    visible.push(input.slice(cursor, openStart));
    if (thinkingText) {
      thinkingTexts.push(thinkingText);
    }
    cursor = closeEnd;
  }

  return {
    visibleContent: visible.join('').trim(),
    thinkingTexts
  };
}

export function promoteInlineThinkingTags<T extends InlineThinkingReply>(reply: T): T {
  const parsed = parseInlineThinkingTags(reply.content);
  if (parsed.thinkingTexts.length === 0) return reply;
  return {
    ...reply,
    content: parsed.visibleContent,
    thinkingText: appendThinkingText(reply.thinkingText, parsed.thinkingTexts)
  };
}
