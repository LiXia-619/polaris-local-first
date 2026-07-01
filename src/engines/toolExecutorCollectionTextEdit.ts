import type { ProjectFile, ProjectFileEffect } from '../types/domain';

export function countStringOccurrences(source: string, needle: string) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (index <= source.length) {
    const nextIndex = source.indexOf(needle, index);
    if (nextIndex === -1) break;
    count += 1;
    index = nextIndex + needle.length;
  }
  return count;
}

export function buildAmbiguousSnippetError(args: {
  content: string;
  snippet: string;
  count: number;
  label: string;
  guidance: string;
  filePath?: string;
}) {
  const locations: string[] = [];
  let index = 0;
  while (locations.length < 5 && index <= args.content.length) {
    const nextIndex = args.content.indexOf(args.snippet, index);
    if (nextIndex === -1) break;
    const lineNumber = lineNumberAtOffset(args.content, nextIndex);
    const line = splitProjectFileLines(args.content)[lineNumber - 1]?.trim();
    const location = args.filePath ? `${args.filePath}:${lineNumber}` : `第 ${lineNumber} 行`;
    locations.push(`${location}${line ? ` · ${line}` : ''}`);
    index = nextIndex + args.snippet.length;
  }
  const locationText = locations.length ? `命中位置：${locations.join('；')}` : '';
  return [
    `${args.label}匹配到 ${args.count} 处，${args.guidance}`,
    locationText
  ].filter(Boolean).join('\n');
}

function summarizeMissingSnippet(snippet: string) {
  const compact = snippet
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' / ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!compact) return '';
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

export function buildMissingSnippetError(args: {
  label: string;
  snippet: string;
  filePath?: string;
  guidance: string;
}) {
  const location = args.filePath ? ` · ${args.filePath}` : '';
  const snippetSummary = summarizeMissingSnippet(args.snippet);
  return [
    `${args.label}没有命中${location}。`,
    snippetSummary ? `片段开头：${snippetSummary}` : '',
    args.guidance
  ].filter(Boolean).join('\n');
}

export function splitProjectFileLines(value: string) {
  return value.split(/\r\n|\r|\n/);
}

export function countProjectFileLines(value: string) {
  return splitProjectFileLines(value).length;
}

export function buildProjectFileExcerpt(content: string, anchorLine: number, before = 2, after = 2) {
  const lines = splitProjectFileLines(content);
  if (lines.length === 0) {
    return {
      startLine: 0,
      endLine: 0,
      excerpt: ''
    };
  }
  const safeAnchorIndex = Math.min(Math.max(0, Math.floor(anchorLine) - 1), lines.length - 1);
  const startIndex = Math.max(0, safeAnchorIndex - before);
  const endIndex = Math.min(lines.length - 1, safeAnchorIndex + after);
  return {
    startLine: startIndex + 1,
    endLine: endIndex + 1,
    excerpt: lines
      .slice(startIndex, endIndex + 1)
      .map((line, index) => `${startIndex + index + 1}: ${line}`)
      .join('\n')
  };
}

export function resolveProjectFileLineInsertion(
  currentContent: string,
  lineNumber: number,
  linePosition: 'before' | 'after'
) {
  const safeLineNumber = Math.floor(lineNumber);
  if (!Number.isFinite(safeLineNumber) || safeLineNumber < 1) return null;
  if (currentContent.length === 0) {
    return safeLineNumber === 1 ? { offset: 0, lineNumber: 1 } : null;
  }

  let currentLine = 1;
  let lineStart = 0;
  let cursor = 0;
  while (cursor <= currentContent.length) {
    if (currentLine === safeLineNumber) {
      if (linePosition === 'before') {
        return { offset: lineStart, lineNumber: safeLineNumber };
      }
      let lineEnd = lineStart;
      while (lineEnd < currentContent.length && currentContent[lineEnd] !== '\n' && currentContent[lineEnd] !== '\r') {
        lineEnd += 1;
      }
      if (lineEnd < currentContent.length) {
        if (currentContent[lineEnd] === '\r' && currentContent[lineEnd + 1] === '\n') {
          lineEnd += 2;
        } else {
          lineEnd += 1;
        }
      }
      return { offset: lineEnd, lineNumber: safeLineNumber };
    }
    if (cursor >= currentContent.length) break;
    const char = currentContent[cursor];
    if (char === '\r' || char === '\n') {
      if (char === '\r' && currentContent[cursor + 1] === '\n') cursor += 1;
      currentLine += 1;
      lineStart = cursor + 1;
    }
    cursor += 1;
  }

  return null;
}

function normalizeLineNumber(value: number) {
  const lineNumber = Math.floor(value);
  return Number.isFinite(lineNumber) && lineNumber >= 1 ? lineNumber : null;
}

function findLineStartOffset(content: string, lineNumber: number) {
  if (lineNumber === 1) return 0;

  let currentLine = 1;
  let cursor = 0;
  while (cursor < content.length) {
    const char = content[cursor];
    if (char === '\r' || char === '\n') {
      if (char === '\r' && content[cursor + 1] === '\n') cursor += 1;
      currentLine += 1;
      cursor += 1;
      if (currentLine === lineNumber) return cursor;
      continue;
    }
    cursor += 1;
  }

  return null;
}

function findLineEndOffset(content: string, lineNumber: number) {
  const lineStart = findLineStartOffset(content, lineNumber);
  if (lineStart === null) return null;

  let cursor = lineStart;
  while (cursor < content.length && content[cursor] !== '\n' && content[cursor] !== '\r') {
    cursor += 1;
  }
  if (cursor >= content.length) return cursor;
  if (content[cursor] === '\r' && content[cursor + 1] === '\n') return cursor + 2;
  return cursor + 1;
}

function detectLineBreak(content: string) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

export function resolveProjectFileLineReplacement(
  currentContent: string,
  startLine: number,
  endLine: number,
  code: string
) {
  const safeStartLine = normalizeLineNumber(startLine);
  const safeEndLine = normalizeLineNumber(endLine);
  if (!safeStartLine || !safeEndLine || safeEndLine < safeStartLine) return null;

  const startOffset = findLineStartOffset(currentContent, safeStartLine);
  const endOffset = findLineEndOffset(currentContent, safeEndLine);
  if (startOffset === null || endOffset === null) return null;

  const shouldPreserveFollowingLineBreak =
    code.length > 0
    && endOffset < currentContent.length
    && !/\r?\n$/.test(code);
  const replacement = shouldPreserveFollowingLineBreak
    ? `${code}${detectLineBreak(currentContent)}`
    : code;

  return {
    content: `${currentContent.slice(0, startOffset)}${replacement}${currentContent.slice(endOffset)}`,
    startOffset,
    endOffset,
    code: replacement,
    startLine: safeStartLine,
    endLine: safeEndLine
  };
}

function isHtmlProjectFile(file: Pick<ProjectFile, 'filePath' | 'language'>) {
  const language = file.language?.toLowerCase();
  const path = file.filePath.toLowerCase();
  return language === 'html' || path.endsWith('.html') || path.endsWith('.htm');
}

function findLastHtmlClosingTagOffset(content: string, tagName: 'body' | 'html') {
  const pattern = new RegExp(`</${tagName}\\s*>`, 'gi');
  let offset = -1;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    offset = match.index;
  }
  return offset;
}

export function resolveProjectFileAppend(
  file: Pick<ProjectFile, 'filePath' | 'language'>,
  currentContent: string,
  code: string
) {
  if (!isHtmlProjectFile(file)) {
    return {
      content: `${currentContent}${code}`,
      operation: 'appended' as const,
      offset: currentContent.length
    };
  }

  const closingBodyOffset = findLastHtmlClosingTagOffset(currentContent, 'body');
  const closingHtmlOffset = findLastHtmlClosingTagOffset(currentContent, 'html');
  const insertionOffset = closingBodyOffset >= 0 ? closingBodyOffset : closingHtmlOffset;

  if (insertionOffset < 0) {
    return {
      content: `${currentContent}${code}`,
      operation: 'appended' as const,
      offset: currentContent.length
    };
  }

  return {
    content: `${currentContent.slice(0, insertionOffset)}${code}${currentContent.slice(insertionOffset)}`,
    operation: 'inserted' as const,
    offset: insertionOffset
  };
}

export function lineNumberAtOffset(source: string, offset: number) {
  return source.slice(0, Math.max(0, offset)).split(/\r\n|\r|\n/).length;
}

export function buildWholeFileEffect(args: {
  projectId: string;
  fileId: string;
  filePath: string;
  operation: ProjectFileEffect['operation'];
  beforeContent?: string;
  afterContent?: string;
}): ProjectFileEffect {
  const beforeLines = typeof args.beforeContent === 'string' ? countProjectFileLines(args.beforeContent) : undefined;
  const afterLines = typeof args.afterContent === 'string' ? countProjectFileLines(args.afterContent) : undefined;
  const changedEnd = afterLines ?? beforeLines ?? 1;
  return {
    projectId: args.projectId,
    fileId: args.fileId,
    filePath: args.filePath,
    operation: args.operation,
    beforeLines,
    afterLines,
    changedLines: {
      start: 1,
      end: Math.max(1, changedEnd)
    },
    insertedChars: args.afterContent?.length,
    removedChars: args.beforeContent?.length
  };
}

export function buildTextEditEffect(args: {
  projectId: string;
  fileId: string;
  filePath: string;
  operation: ProjectFileEffect['operation'];
  beforeContent: string;
  afterContent: string;
  oldString?: string;
  newString: string;
  matchOffset: number;
  matchCount?: number;
}): ProjectFileEffect {
  const startLine = lineNumberAtOffset(args.beforeContent, args.matchOffset);
  const beforeSpanLines = args.oldString ? countProjectFileLines(args.oldString) : 1;
  const afterSpanLines = countProjectFileLines(args.newString);
  const changedLines = {
    start: startLine,
    end: startLine + Math.max(beforeSpanLines, afterSpanLines) - 1
  };
  const afterExcerpt = buildProjectFileExcerpt(args.afterContent, changedLines.end);
  return {
    projectId: args.projectId,
    fileId: args.fileId,
    filePath: args.filePath,
    operation: args.operation,
    beforeLines: countProjectFileLines(args.beforeContent),
    afterLines: countProjectFileLines(args.afterContent),
    changedLines,
    afterExcerptStartLine: afterExcerpt.startLine,
    afterExcerptEndLine: afterExcerpt.endLine,
    afterExcerpt: afterExcerpt.excerpt,
    insertedChars: args.newString.length,
    removedChars: args.oldString?.length ?? 0,
    matchCount: args.matchCount
  };
}
