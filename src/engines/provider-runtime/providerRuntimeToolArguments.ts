function looksLikeJsonObjectPrefix(input: string) {
  return input.trimStart().startsWith('{');
}

function parsesAsJsonObject(input: string) {
  try {
    const parsed = JSON.parse(input);
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function mergeToolCallArgumentsText(existingText: string, nextText: string) {
  if (!existingText) return nextText;
  if (!nextText) return existingText;

  const existing = existingText.trim();
  const next = nextText.trim();

  if (!existing || !next) {
    return existingText + nextText;
  }

  if (next.startsWith(existing)) {
    return nextText;
  }

  if (
    looksLikeJsonObjectPrefix(existing)
    && looksLikeJsonObjectPrefix(next)
    && (parsesAsJsonObject(existing) || parsesAsJsonObject(next))
  ) {
    return nextText;
  }

  return existingText + nextText;
}
