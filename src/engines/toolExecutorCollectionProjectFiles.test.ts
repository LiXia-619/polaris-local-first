import { describe, expect, it } from 'vitest';
import {
  formatProjectFileContext,
  formatProjectFileDirectory,
  formatProjectFileSearch,
  toProjectFileFact,
  toProjectFileFactFromDomain
} from './toolExecutorCollectionProjectFiles';
import type { ProjectFile } from '../types/domain';

describe('project file facts', () => {
  it('projects resolved room files into request-visible facts', () => {
    expect(toProjectFileFact('project-1', {
      fileId: 'file-1',
      title: 'index.html',
      path: 'index.html',
      language: 'html',
      role: 'entry',
      isEntry: true,
      content: '<main />\n<script />'
    })).toEqual({
      projectId: 'project-1',
      fileId: 'file-1',
      filePath: 'index.html',
      language: 'html',
      fileRole: 'entry',
      isEntry: true,
      totalLines: 2,
      totalChars: 19
    });
  });

  it('projects persisted project files without entry ownership guesses', () => {
    const file: ProjectFile = {
      id: 'file-1',
      projectId: 'project-1',
      filePath: 'src/app.ts',
      fileRole: 'logic',
      language: 'typescript',
      content: 'export const x = 1;',
      source: 'manual',
      createdAt: 1,
      updatedAt: 2
    };

    expect(toProjectFileFactFromDomain(file)).toMatchObject({
      projectId: 'project-1',
      fileId: 'file-1',
      filePath: 'src/app.ts',
      language: 'typescript',
      fileRole: 'logic',
      totalLines: 1,
      totalChars: 19
    });
  });
});

describe('project file detail formatting', () => {
  it('formats a project directory with entry and role markers', () => {
    expect(formatProjectFileDirectory('project-1', [{
      fileId: 'file-1',
      title: 'index.html',
      path: 'index.html',
      language: 'html',
      role: 'entry',
      isEntry: true,
      content: '<main />'
    }])).toContain('入口 · index.html · html · role=entry');
  });

  it('formats project file search results with match metadata and excerpts', () => {
    const text = formatProjectFileSearch('project-1', {
      query: 'white tree',
      totalMatches: 1,
      returnedMatches: [{
        fileId: 'file-1',
        filePath: 'story.md',
        language: 'markdown',
        matchKind: 'content',
        matchReason: '大小写宽松匹配',
        lineNumber: 3,
        line: 'The white tree glows.',
        excerptStartLine: 2,
        excerptEndLine: 4,
        excerpt: '2: before\n3: The white tree glows.\n4: after'
      }]
    });

    expect(text).toContain('命中：1 处，返回 1 处');
    expect(text).toContain('story.md:3 · The white tree glows.');
  });

  it('formats contextual reads with either matched or fallback anchors', () => {
    expect(formatProjectFileContext({
      fileId: 'file-1',
      filePath: 'story.md',
      language: 'markdown',
      lineCount: 10,
      anchorLineNumber: 4,
      totalMatches: 2,
      excerptStartLine: 3,
      excerptEndLine: 5,
      excerpt: '3: before\n4: anchor\n5: after'
    })).toContain('锚点：第 4 行 · query 命中 2 处');

    expect(formatProjectFileContext({
      fileId: 'file-1',
      filePath: 'story.md',
      language: 'markdown',
      lineCount: 10,
      anchorLineNumber: null,
      totalMatches: 0,
      excerptStartLine: 1,
      excerptEndLine: 2,
      excerpt: ''
    })).toContain('锚点：未命中 query · query 命中 0 处');
  });
});
