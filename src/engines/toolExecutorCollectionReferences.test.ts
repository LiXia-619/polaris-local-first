import { describe, expect, it } from 'vitest';
import {
  buildReferenceExcerpt,
  findWorkspaceReferenceDoc,
  formatReadableContextCandidates,
  formatWorkspaceReferenceDirectory,
  formatWorkspaceReferenceSearch,
  normalizeReferenceSearchText,
  searchWorkspaceReferenceDocs,
  toWorkspaceReferenceFact
} from './toolExecutorCollectionReferences';
import type { ReadableContextCandidate, WorkspaceReferenceDoc } from '../types/domain';

function makeDoc(patch: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'title'>): WorkspaceReferenceDoc {
  return {
    projectId: 'project-1',
    summary: '',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

describe('workspace reference facts', () => {
  it('projects stable request-visible metadata without document body', () => {
    expect(toWorkspaceReferenceFact(makeDoc({
      id: 'doc-1',
      title: '白树设定',
      summary: '冷光和边界',
      content: '完整正文'
    }))).toEqual({
      projectId: 'project-1',
      docId: 'doc-1',
      title: '白树设定',
      summary: '冷光和边界',
      totalChars: 4,
      updatedAt: 2
    });
  });
});

describe('findWorkspaceReferenceDoc', () => {
  it('prefers exact doc ids and falls back to normalized titles', () => {
    const docs = [
      makeDoc({ id: 'doc-1', title: '白树设定' }),
      makeDoc({ id: 'doc-2', title: '边界设定' })
    ];

    expect(findWorkspaceReferenceDoc(docs, { docId: 'doc-2', title: '白树设定' })).toMatchObject({
      ok: true,
      doc: { id: 'doc-2' }
    });
    expect(findWorkspaceReferenceDoc(docs, { title: ' 白树设定 ' })).toMatchObject({
      ok: true,
      doc: { id: 'doc-1' }
    });
  });

  it('reports ambiguous title matches with a docId hint', () => {
    const result = findWorkspaceReferenceDoc([
      makeDoc({ id: 'doc-1', title: '白树设定' }),
      makeDoc({ id: 'doc-2', title: '白树设定' })
    ], { title: '白树设定' });

    expect(result).toEqual({
      ok: false,
      error: '“白树设定”匹配到 2 份参考资料，请改用 docId。'
    });
  });
});

describe('searchWorkspaceReferenceDocs', () => {
  it('normalizes reference text and builds compact body excerpts', () => {
    expect(normalizeReferenceSearchText('  白树 \n 设定  ')).toBe('白树 \n 设定');
    expect(buildReferenceExcerpt('第一段\n\n白树会发光\n后文', '白树')).toContain('白树会发光');
  });

  it('searches title, summary, and content in that order', () => {
    const result = searchWorkspaceReferenceDocs([
      makeDoc({ id: 'doc-title', title: '白树设定', summary: '', content: '' }),
      makeDoc({ id: 'doc-summary', title: '资料', summary: '白树会发光', content: '' }),
      makeDoc({ id: 'doc-content', title: '正文', summary: '', content: '旧世界边界有一棵白树。'.repeat(20) })
    ], '白树', 2);

    expect(result.totalMatches).toBe(3);
    expect(result.returnedMatches).toEqual([
      expect.objectContaining({ docId: 'doc-title', matchKind: 'title', excerpt: '白树设定' }),
      expect.objectContaining({ docId: 'doc-summary', matchKind: 'summary', excerpt: '白树会发光' })
    ]);
  });

  it('returns an empty search result for blank query', () => {
    expect(searchWorkspaceReferenceDocs([
      makeDoc({ id: 'doc-1', title: '白树设定' })
    ], '   ')).toEqual({
      query: '   ',
      totalMatches: 0,
      returnedMatches: []
    });
  });
});

describe('workspace reference formatting', () => {
  it('formats directories and searches for tool detail text', () => {
    const docs = [
      makeDoc({ id: 'doc-1', title: '白树设定', summary: '冷光', content: '完整正文' })
    ];
    const search = searchWorkspaceReferenceDocs(docs, '冷光');

    expect(formatWorkspaceReferenceDirectory('project-1', docs)).toContain('白树设定 · docId=doc-1');
    expect(formatWorkspaceReferenceSearch('project-1', search)).toContain('命中：1 份，返回 1 份');
  });

  it('formats readable context candidates with the next read action', () => {
    const candidates: ReadableContextCandidate[] = [{
      source: 'workspace-reference',
      id: 'doc-1',
      projectId: 'project-1',
      title: '白树设定',
      summary: '冷光',
      readTool: 'readWorkspaceReference',
      readArgs: { projectId: 'project-1', docId: 'doc-1' },
      excerpt: '白树会发光'
    }];

    expect(formatReadableContextCandidates(candidates)).toContain('下一步：readWorkspaceReference');
    expect(formatReadableContextCandidates([])).toBe('没有找到可读取候选。');
  });
});
