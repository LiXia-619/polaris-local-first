export function buildNumberedPromptLines<T>(
  items: T[],
  formatItem: (item: T, index: number) => string
): string[] {
  return items.map((item, index) => `${index + 1}. ${formatItem(item, index)}`);
}

export function buildBulletPromptLines<T>(
  items: T[],
  formatItem: (item: T, index: number) => string
): string[] {
  return items.map((item, index) => `- ${formatItem(item, index)}`);
}

export function normalizePromptInlineText(value: string | undefined | null): string {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

export function summarizePromptInlineText(
  value: string | undefined | null,
  maxLength: number
): string {
  const normalized = normalizePromptInlineText(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}
