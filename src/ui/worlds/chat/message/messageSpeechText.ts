import { TOOL_DRAFT_BLOCK_PATTERN } from '../../../../app/chat/chatMarkdownPatterns';
import { stripCodeBlocksFromMessage } from '../../../../engines/codeCardEngine';

function stripToolDraftBlocks(content: string) {
  return content
    .replace(TOOL_DRAFT_BLOCK_PATTERN, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownForSpeech(content: string) {
  return content
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+[.)]\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '');
}

function normalizeSpeechWhitespace(content: string) {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildAssistantSpeechText(content: string) {
  const withoutToolDrafts = stripToolDraftBlocks(content);
  const withoutCodeBlocks = stripCodeBlocksFromMessage(withoutToolDrafts);
  return normalizeSpeechWhitespace(stripMarkdownForSpeech(withoutCodeBlocks));
}
