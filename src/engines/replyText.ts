export function normalizeReplySpacing(content: string) {
  return content.replace(/\n{3,}/g, '\n\n').trim();
}
