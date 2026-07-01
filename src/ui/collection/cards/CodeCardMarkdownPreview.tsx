import { useMemo, type ReactNode } from 'react';
import { cleanDisplayText } from '../../text/displayText';
import { renderRichInlineContent } from '../../worlds/chat/message/messageRichMarkup';

type CodeCardMarkdownPreviewProps = {
  content: string;
  title?: string;
};

type CardMarkdownBlock =
  | { type: 'heading'; depth: number; content: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'code'; language: string; code: string };

const MAX_PREVIEW_BLOCKS = 5;
const MAX_LIST_ITEMS = 4;
const MAX_CODE_LINES = 3;

function isBlockStart(line: string) {
  return /^(#{1,6})\s+/.test(line)
    || /^>\s?/.test(line)
    || /^[-*+]\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || /^```/.test(line);
}

function parsePreviewBlocks(content: string, title?: string) {
  const blocks: CardMarkdownBlock[] = [];
  const lines = cleanDisplayText(content).replace(/\r\n/g, '\n').split('\n');
  const normalizedTitle = title?.trim();
  let index = 0;

  const pushBlock = (block: CardMarkdownBlock) => {
    if (
      block.type === 'heading'
      && blocks.length === 0
      && normalizedTitle
      && block.content.trim() === normalizedTitle
    ) {
      return;
    }
    if (blocks.length < MAX_PREVIEW_BLOCKS) {
      blocks.push(block);
    }
  };

  while (index < lines.length && blocks.length < MAX_PREVIEW_BLOCKS) {
    const rawLine = lines[index] ?? '';
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index] ?? '')) {
        if (codeLines.length < MAX_CODE_LINES) {
          codeLines.push(lines[index] ?? '');
        }
        index += 1;
      }
      if (index < lines.length) index += 1;
      pushBlock({ type: 'code', language: fenceMatch[1] ?? '', code: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pushBlock({ type: 'heading', depth: headingMatch[1].length, content: headingMatch[2].trim() });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test((lines[index] ?? '').trimEnd())) {
        quoteLines.push((lines[index] ?? '').trimEnd().replace(/^>\s?/, ''));
        index += 1;
      }
      pushBlock({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test((lines[index] ?? '').trimEnd())) {
        if (items.length < MAX_LIST_ITEMS) {
          items.push((lines[index] ?? '').trimEnd().replace(/^[-*+]\s+/, ''));
        }
        index += 1;
      }
      pushBlock({ type: 'unordered-list', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test((lines[index] ?? '').trimEnd())) {
        if (items.length < MAX_LIST_ITEMS) {
          items.push((lines[index] ?? '').trimEnd().replace(/^\d+\.\s+/, ''));
        }
        index += 1;
      }
      pushBlock({ type: 'ordered-list', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = (lines[index] ?? '').trimEnd();
      if (!currentLine.trim()) break;
      if (paragraphLines.length > 0 && isBlockStart(currentLine)) break;
      paragraphLines.push(currentLine);
      index += 1;
    }
    if (paragraphLines.length > 0) {
      pushBlock({ type: 'paragraph', lines: paragraphLines });
    }
  }

  return blocks;
}

function renderInline(content: string) {
  return renderRichInlineContent(content);
}

function renderLines(lines: string[]) {
  return lines.map((line, index) => (
    <span key={`line-${index}`} className="code-card-markdown-line">
      {renderInline(line)}
    </span>
  ));
}

function renderBlock(block: CardMarkdownBlock, index: number): ReactNode {
  if (block.type === 'heading') {
    const HeadingTag = block.depth <= 1 ? 'h4' : 'h5';
    return (
      <HeadingTag key={`heading-${index}`} className={`code-card-markdown-heading depth-${block.depth}`}>
        {renderInline(block.content)}
      </HeadingTag>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <p key={`paragraph-${index}`} className="code-card-markdown-paragraph">
        {renderLines(block.lines)}
      </p>
    );
  }

  if (block.type === 'blockquote') {
    return (
      <blockquote key={`quote-${index}`} className="code-card-markdown-blockquote">
        {renderLines(block.lines)}
      </blockquote>
    );
  }

  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    const ListTag = block.type === 'unordered-list' ? 'ul' : 'ol';
    return (
      <ListTag key={`list-${index}`} className={`code-card-markdown-list ${block.type}`}>
        {block.items.map((item, itemIndex) => (
          <li key={`item-${itemIndex}`}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
  }

  return (
    <pre key={`code-${index}`} className="code-card-markdown-code">
      <code>{block.code}</code>
    </pre>
  );
}

export function CodeCardMarkdownPreview({ content, title }: CodeCardMarkdownPreviewProps) {
  const blocks = useMemo(() => parsePreviewBlocks(content, title), [content, title]);
  if (!blocks.length) return null;

  return (
    <div className="code-card-snippet code-card-markdown-preview">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
