import { inferCodeLanguage, normalizeCodeCardTags, stripCodeBlocksFromMessage } from './codeCardEngine';

export type MessageDocumentDraft = {
  title: string;
  language: string;
  content: string;
  tags: string[];
};

const MIN_DOCUMENT_CHARS = 220;

function cleanTitleLine(value: string) {
  return value
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*_`>#-]+$/g, '')
    .trim();
}

function deriveDocumentTitle(content: string) {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const headingLine = lines.find((line) => /^#{1,6}\s+/.test(line)) ?? lines[0] ?? '';
  const normalized = cleanTitleLine(headingLine);
  if (normalized) return normalized.slice(0, 40);
  return '对话草稿';
}

function looksLikeDocument(content: string) {
  if (content.length < MIN_DOCUMENT_CHARS) return false;
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const paragraphCount = content.split(/\n\s*\n/).filter((block) => block.trim().length > 0).length;
  const hasStructuredMarkdown = lines.some((line) => /^#{1,6}\s+|^[-*]\s+|^\d+\.\s+|\|.+\|/.test(line));
  return hasStructuredMarkdown || paragraphCount >= 3 || lines.length >= 6;
}

export function extractMessageDocumentDraft(content: string): MessageDocumentDraft | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  if (/```[\w#+.-]*[^\n]*\n[\s\S]*?```/g.test(trimmed)) return null;

  const plainBody = stripCodeBlocksFromMessage(trimmed);
  if (!plainBody || plainBody.length < MIN_DOCUMENT_CHARS) return null;
  if (!looksLikeDocument(plainBody)) return null;

  const language = inferCodeLanguage(plainBody, 'markdown');
  const tags = normalizeCodeCardTags(language === 'markdown' ? ['文档', 'markdown'] : ['文档']);
  return {
    title: deriveDocumentTitle(plainBody),
    language,
    content: plainBody,
    tags
  };
}
