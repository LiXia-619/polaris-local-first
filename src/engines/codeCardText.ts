import { inferCodeLanguage, normalizeCodeLanguage } from './codeCardLanguage';

export type CodeBlockCandidate = {
  blockIndex: number;
  language: string;
  code: string;
  title: string;
  tags: string[];
};

export const MAX_CODE_CARD_TAGS = 4;

export function parseCodeCardTags(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, MAX_CODE_CARD_TAGS);
}

export function normalizeCodeCardTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, MAX_CODE_CARD_TAGS);
}

export function formatCodeCardTags(tags: string[]): string {
  return normalizeCodeCardTags(tags).join(', ');
}

function stripTitleDecorators(value: string): string {
  return value.replace(/^[/#*\-\s]+/, '').replace(/\*\/$/, '').trim();
}

function formatIdentifierTitle(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function deriveStructuredTitle(code: string, language: string): string | null {
  if (language === 'html') {
    const htmlTitle = code.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    if (htmlTitle) return htmlTitle.slice(0, 40);

    const headingTitle = code.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
    if (headingTitle) return headingTitle.slice(0, 40);

    const semanticNode = code.match(/<([a-z][\w-]*)(?:\s+[^>]*)?>/i)?.[1];
    if (semanticNode) return `${semanticNode} 片段`;
  }

  if (language === 'css') {
    const selector = code.match(/(^|\n)\s*([^@\n][^{\n]+)\s*\{/m)?.[2]?.trim();
    if (selector) return selector.slice(0, 40);
  }

  if (language === 'javascript' || language === 'typescript') {
    const patterns = [
      /export\s+default\s+function\s+([A-Za-z][\w$]*)/,
      /export\s+function\s+([A-Za-z][\w$]*)/,
      /function\s+([A-Za-z][\w$]*)/,
      /class\s+([A-Za-z][\w$]*)/,
      /const\s+([A-Za-z][\w$]*)\s*=\s*(?:async\s*)?\(/,
      /const\s+([A-Za-z][\w$]*)\s*=\s*</
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern)?.[1];
      if (match) return formatIdentifierTitle(match).slice(0, 40);
    }
  }

  if (language === 'json') {
    const key = code.match(/"([^"]+)"\s*:/)?.[1]?.trim();
    if (key) return `${key} 配置`;
  }

  if (language === 'python') {
    const fnName = code.match(/(^|\n)\s*def\s+([A-Za-z_][\w]*)/m)?.[2];
    if (fnName) return formatIdentifierTitle(fnName).slice(0, 40);
  }

  return null;
}

export function deriveCodeCardTitle(
  code: string,
  fallback = '未命名房间',
  preferredLanguage?: string
): string {
  const language = inferCodeLanguage(code, preferredLanguage);
  const lines = code.split('\n').map((line) => line.trim()).filter(Boolean);
  const first = lines[0];
  if (!first) return fallback;

  const titlePatterns = [
    /^\/\/\s*(.+)$/,
    /^#\s*(.+)$/,
    /^\/\*\s*(.+)\s*\*\/$/,
    /^<!--\s*(.+)\s*-->$/
  ];

  for (const pattern of titlePatterns) {
    const match = first.match(pattern);
    if (match?.[1]) {
      return stripTitleDecorators(match[1]).slice(0, 40) || fallback;
    }
  }

  const structuredTitle = deriveStructuredTitle(code, language);
  if (structuredTitle) {
    return structuredTitle;
  }

  if (/^[a-z0-9_-]+\s*[:=]/i.test(first)) {
    return first.slice(0, 32);
  }

  return fallback;
}

export function extractCodeBlocksFromMessage(content: string): CodeBlockCandidate[] {
  const matches = Array.from(content.matchAll(/```([\w#+.-]*)[^\n]*\n([\s\S]*?)```/g));
  return matches
    .map((match, blockIndex) => {
      if (normalizeCodeLanguage(match[1]) === 'polaris-tools') {
        return null;
      }
      const language = inferCodeLanguage(match[2] ?? '', match[1]);
      const code = (match[2] ?? '').trim();
      if (!code) return null;

      return {
        blockIndex,
        language,
        code,
        title: deriveCodeCardTitle(code, `${language} 片段`, language),
        tags: language === 'text' ? [] : [language]
      };
    })
    .filter((candidate): candidate is CodeBlockCandidate => Boolean(candidate));
}

export function stripCodeBlocksFromMessage(content: string): string {
  return content
    .replace(/```[\w#+.-]*[^\n]*\n[\s\S]*?```/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
