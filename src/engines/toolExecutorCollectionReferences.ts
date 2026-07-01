import type {
  ReadableContextCandidate,
  WorkspaceReferenceDoc,
  WorkspaceReferenceDocFact
} from '../types/domain';

export function normalizeReferenceSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function buildReferenceExcerpt(content: string, query: string) {
  const normalizedContent = content.replace(/\s+/g, ' ').trim();
  if (!normalizedContent) return '';
  const normalizedQuery = normalizeReferenceSearchText(query);
  const matchIndex = normalizedContent.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex < 0) return normalizedContent.slice(0, 220);
  const start = Math.max(0, matchIndex - 90);
  const end = Math.min(normalizedContent.length, matchIndex + normalizedQuery.length + 130);
  return `${start > 0 ? '...' : ''}${normalizedContent.slice(start, end)}${end < normalizedContent.length ? '...' : ''}`;
}

export function toWorkspaceReferenceFact(doc: WorkspaceReferenceDoc): WorkspaceReferenceDocFact {
  return {
    projectId: doc.projectId,
    docId: doc.id,
    title: doc.title,
    summary: doc.summary,
    totalChars: doc.charCount ?? doc.content.length,
    updatedAt: doc.updatedAt
  };
}

export function findWorkspaceReferenceDoc(
  docs: WorkspaceReferenceDoc[],
  target: { docId?: string; title?: string }
) {
  const docId = target.docId?.trim();
  if (docId) {
    const byId = docs.find((doc) => doc.id === docId) ?? null;
    if (byId) return { ok: true as const, doc: byId };
  }

  const title = target.title?.trim();
  if (!title) return { ok: false as const, error: '缺少要读取的参考资料 docId 或 title。' };
  const normalizedTitle = normalizeReferenceSearchText(title);
  const matches = docs.filter((doc) => normalizeReferenceSearchText(doc.title) === normalizedTitle);
  if (matches.length === 1) return { ok: true as const, doc: matches[0] };
  if (matches.length > 1) {
    return { ok: false as const, error: `“${title}”匹配到 ${matches.length} 份参考资料，请改用 docId。` };
  }
  return { ok: false as const, error: `没有找到参考资料“${title}”。` };
}

export type WorkspaceReferenceSearchMatch = {
  docId: string;
  title: string;
  matchKind: 'title' | 'summary' | 'content';
  excerpt: string;
};

export function searchWorkspaceReferenceDocs(
  docs: WorkspaceReferenceDoc[],
  query: string,
  maxResults = 12
) {
  const normalizedQuery = normalizeReferenceSearchText(query);
  const matches: WorkspaceReferenceSearchMatch[] = [];
  if (!normalizedQuery) {
    return {
      query,
      totalMatches: 0,
      returnedMatches: [] as WorkspaceReferenceSearchMatch[]
    };
  }

  for (const doc of docs) {
    const title = normalizeReferenceSearchText(doc.title);
    const summary = normalizeReferenceSearchText(doc.summary);
    const content = normalizeReferenceSearchText(doc.content);
    const matchKind =
      title.includes(normalizedQuery)
        ? 'title' as const
        : summary.includes(normalizedQuery)
          ? 'summary' as const
          : content.includes(normalizedQuery)
            ? 'content' as const
            : null;
    if (!matchKind) continue;
    matches.push({
      docId: doc.id,
      title: doc.title,
      matchKind,
      excerpt: matchKind === 'title'
        ? doc.title
        : matchKind === 'summary'
          ? doc.summary
          : buildReferenceExcerpt(doc.content, query)
    });
  }

  return {
    query,
    totalMatches: matches.length,
    returnedMatches: matches.slice(0, Math.max(1, maxResults))
  };
}

export function formatWorkspaceReferenceDirectory(projectId: string, docs: WorkspaceReferenceDoc[]) {
  return [
    `工作区：${projectId}`,
    `参考资料：${docs.length} 份`,
    '',
    ...docs.map((doc) => [
      doc.title,
      `docId=${doc.id}`,
      `${doc.charCount ?? doc.content.length} 字`,
      doc.summary || '无摘要'
    ].join(' · '))
  ].join('\n');
}

export function formatWorkspaceReferenceSearch(
  projectId: string,
  result: ReturnType<typeof searchWorkspaceReferenceDocs>
) {
  return [
    `工作区：${projectId}`,
    `搜索：${result.query}`,
    `命中：${result.totalMatches} 份，返回 ${result.returnedMatches.length} 份`,
    '',
    ...result.returnedMatches.map((match) => [
      `${match.title} · docId=${match.docId} · ${match.matchKind}`,
      match.excerpt || '[空]'
    ].join('\n'))
  ].join('\n');
}

export function formatReadableContextCandidates(candidates: ReadableContextCandidate[]) {
  if (!candidates.length) return '没有找到可读取候选。';
  return candidates.map((candidate, index) => [
    `${index + 1}. ${candidate.source} · ${candidate.title}`,
    candidate.path ? `路径：${candidate.path}` : null,
    candidate.summary ? `摘要：${candidate.summary}` : null,
    candidate.excerpt ? `片段：${candidate.excerpt}` : null,
    `下一步：${candidate.readTool} ${JSON.stringify(candidate.readArgs)}`
  ].filter(Boolean).join('\n')).join('\n\n');
}
