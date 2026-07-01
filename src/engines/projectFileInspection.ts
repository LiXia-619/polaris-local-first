import type { ResolvedRoomProjectFile } from './roomProjects';

export type ProjectFileSearchMatch = {
  fileId: string;
  filePath: string;
  language: string;
  matchKind: 'content' | 'path';
  matchReason: string;
  lineNumber: number;
  line: string;
  excerptStartLine: number;
  excerptEndLine: number;
  excerpt: string;
};

export type ProjectFileSearchResult = {
  query: string;
  totalMatches: number;
  returnedMatches: ProjectFileSearchMatch[];
};

export type ProjectFileContextResult = {
  fileId: string;
  filePath: string;
  language: string;
  lineCount: number;
  anchorLineNumber: number | null;
  totalMatches?: number;
  excerptStartLine: number;
  excerptEndLine: number;
  excerpt: string;
};

function splitLines(value: string) {
  return value.split(/\r\n|\r|\n/);
}

function normalizeLineWindow(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase();
}

function splitSearchTerms(query: string) {
  return Array.from(new Set(
    query
      .split(/[^\p{L}\p{N}_$.-]+/u)
      .map((term) => normalizeSearchText(term.trim()))
      .filter((term) => term.length >= 2)
  ));
}

function findLineMatchReason(line: string, query: string, terms: string[]) {
  if (line.includes(query)) return '精确匹配';
  const normalizedLine = normalizeSearchText(line);
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedLine.includes(normalizedQuery)) return '大小写宽松匹配';
  if (terms.length > 1 && terms.every((term) => normalizedLine.includes(term))) {
    return '多词匹配';
  }
  return null;
}

function pathMatches(path: string, query: string, terms: string[]) {
  const normalizedPath = normalizeSearchText(path);
  const normalizedQuery = normalizeSearchText(query);
  return normalizedPath.includes(normalizedQuery) ||
    (terms.length > 1 && terms.every((term) => normalizedPath.includes(term)));
}

function buildExcerpt(lines: string[], anchorLineIndex: number, before = 2, after = 2) {
  if (lines.length === 0) {
    return {
      excerptStartLine: 0,
      excerptEndLine: 0,
      excerpt: ''
    };
  }
  const safeAnchor = Math.min(Math.max(0, anchorLineIndex), lines.length - 1);
  const startIndex = Math.max(0, safeAnchor - before);
  const endIndex = Math.min(lines.length - 1, safeAnchor + after);
  return {
    excerptStartLine: startIndex + 1,
    excerptEndLine: endIndex + 1,
    excerpt: lines
      .slice(startIndex, endIndex + 1)
      .map((line, index) => `${startIndex + index + 1}: ${line}`)
      .join('\n')
  };
}

function findLineIndexByQuery(lines: string[], query: string, occurrence: number) {
  const normalizedOccurrence = normalizePositiveInteger(occurrence, 1);
  let seen = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index]!.includes(query)) continue;
    seen += 1;
    if (seen === normalizedOccurrence) {
      return {
        index,
        totalMatches: lines.filter((line) => line.includes(query)).length
      };
    }
  }

  return {
    index: -1,
    totalMatches: seen
  };
}

export function searchProjectFiles(
  files: ResolvedRoomProjectFile[],
  args: {
    query: string;
    maxResults?: number;
  }
): ProjectFileSearchResult {
  const query = args.query.trim();
  const maxResults = normalizePositiveInteger(args.maxResults, 20);
  const matches: ProjectFileSearchMatch[] = [];
  let totalMatches = 0;

  if (!query) {
    return {
      query,
      totalMatches: 0,
      returnedMatches: []
    };
  }

  files.forEach((file) => {
    const lines = splitLines(file.content);
    const terms = splitSearchTerms(query);
    if (pathMatches(file.path, query, terms)) {
      totalMatches += 1;
      if (matches.length < maxResults) {
        const excerpt = buildExcerpt(lines, 0, 0, 3);
        matches.push({
          fileId: file.fileId,
          filePath: file.path,
          language: file.language,
          matchKind: 'path',
          matchReason: '路径匹配',
          lineNumber: lines.length > 0 ? 1 : 0,
          line: lines[0] ?? '',
          ...excerpt
        });
      }
    }

    lines.forEach((line, lineIndex) => {
      const matchReason = findLineMatchReason(line, query, terms);
      if (!matchReason) return;
      totalMatches += 1;
      if (matches.length >= maxResults) return;
      matches.push({
        fileId: file.fileId,
        filePath: file.path,
        language: file.language,
        matchKind: 'content',
        matchReason,
        lineNumber: lineIndex + 1,
        line,
        ...buildExcerpt(lines, lineIndex)
      });
    });
  });

  return {
    query,
    totalMatches,
    returnedMatches: matches
  };
}

export function readProjectFileContext(
  file: ResolvedRoomProjectFile,
  args: {
    query?: string;
    lineNumber?: number;
    before?: number;
    after?: number;
    occurrence?: number;
  }
): ProjectFileContextResult {
  const lines = splitLines(file.content);
  const query = args.query?.trim();
  const before = normalizeLineWindow(args.before, 8);
  const after = normalizeLineWindow(args.after, 8);
  let anchorLineIndex = -1;
  let totalMatches: number | undefined;

  if (query) {
    const queryMatch = findLineIndexByQuery(lines, query, args.occurrence ?? 1);
    anchorLineIndex = queryMatch.index;
    totalMatches = queryMatch.totalMatches;
  } else if (typeof args.lineNumber === 'number' && Number.isFinite(args.lineNumber)) {
    anchorLineIndex = Math.min(Math.max(0, Math.floor(args.lineNumber) - 1), Math.max(0, lines.length - 1));
  }

  const effectiveAnchor = anchorLineIndex >= 0 ? anchorLineIndex : 0;
  const excerpt = buildExcerpt(lines, effectiveAnchor, before, after);

  return {
    fileId: file.fileId,
    filePath: file.path,
    language: file.language,
    lineCount: lines.length,
    anchorLineNumber: anchorLineIndex >= 0 ? anchorLineIndex + 1 : null,
    totalMatches,
    excerptStartLine: excerpt.excerptStartLine,
    excerptEndLine: excerpt.excerptEndLine,
    excerpt: excerpt.excerpt
  };
}
