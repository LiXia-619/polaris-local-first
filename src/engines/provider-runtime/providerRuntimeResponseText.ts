export function extractStructuredText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => extractStructuredText(item)).join('');
  }
  if (!value || typeof value !== 'object') return '';

  const parsed = value as {
    text?: unknown;
    content?: unknown;
    value?: unknown;
  };

  if (typeof parsed.text === 'string') return parsed.text;
  if (typeof parsed.value === 'string') return parsed.value;

  if (parsed.text && typeof parsed.text === 'object') {
    const nestedText = extractStructuredText(parsed.text);
    if (nestedText) return nestedText;
  }

  if (parsed.content) {
    const nestedContent = extractStructuredText(parsed.content);
    if (nestedContent) return nestedContent;
  }

  return '';
}

export function extractTextPayload(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';

  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      return typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '';
    })
    .join('');
}

export function extractThinkingPayload(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (typeof (item as { text?: unknown }).text === 'string') return (item as { text: string }).text;
      if (typeof (item as { content?: unknown }).content === 'string') return (item as { content: string }).content;
      if (typeof (item as { thinking?: unknown }).thinking === 'string') return (item as { thinking: string }).thinking;
      return '';
    })
    .join('');
}
