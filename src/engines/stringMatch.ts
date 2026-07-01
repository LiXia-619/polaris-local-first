const MATCH_PUNCTUATION_PATTERN = /[\s。！？，、,.!?;:："'“”‘’（）()【】\[\]<>《》…—·-]+/g;
const MATCH_QUOTE_PATTERN = /[《》"'“”‘’]/g;

export function normalizeForMatch(
  value: string,
  opts?: { stripPunctuation?: boolean; stripQuotes?: boolean }
): string {
  let normalized = value.trim().toLowerCase();
  if (opts?.stripPunctuation) {
    normalized = normalized.replace(MATCH_PUNCTUATION_PATTERN, '');
  }
  if (opts?.stripQuotes) {
    normalized = normalized.replace(MATCH_QUOTE_PATTERN, '');
  }
  return normalized;
}
