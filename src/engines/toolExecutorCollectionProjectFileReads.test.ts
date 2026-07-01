import { describe, expect, it, vi } from 'vitest';
import { executeCollectionProjectFileReadAction } from './toolExecutorCollectionProjectFileReads';
import type { ToolContext } from './toolExecutorTypes';
import type { ProjectFile, RoomProject } from '../types/domain';

function makeRoomProject(patch: Partial<RoomProject> = {}): RoomProject {
  return {
    id: 'project-1',
    title: 'Mini Phone',
    slug: 'mini-phone',
    fileIds: ['file-html', 'file-js'],
    tags: [],
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function makeProjectFile(patch: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 'file-html',
    projectId: 'project-1',
    filePath: 'index.html',
    fileRole: 'entry',
    language: 'html',
    content: '<main>hello</main>',
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function createContext(files: ProjectFile[] = [makeProjectFile()]) {
  return {
    readRoomProject: vi.fn(() => makeRoomProject({ fileIds: files.map((file) => file.id) })),
    listProjectFiles: vi.fn(() => files),
    readProjectFile: vi.fn((fileId: string) => files.find((file) => file.id === fileId) ?? null)
  } as Partial<ToolContext> as ToolContext;
}

describe('executeCollectionProjectFileReadAction', () => {
  it('lists project file facts and directory replay evidence', async () => {
    const ctx = createContext([
      makeProjectFile(),
      makeProjectFile({
        id: 'file-js',
        filePath: 'scripts/app.js',
        fileRole: 'logic',
        language: 'javascript',
        content: 'console.log("ready");'
      })
    ]);

    await expect(executeCollectionProjectFileReadAction({
      kind: 'listProjectFiles',
      projectId: 'project-1'
    }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '已列出工作区文件 · Mini Phone',
      roomProjectId: 'project-1',
      projectFiles: [
        expect.objectContaining({ filePath: 'index.html', totalLines: 1 }),
        expect.objectContaining({ filePath: 'scripts/app.js', totalLines: 1 })
      ],
      projectFileReads: [
        expect.objectContaining({
          kind: 'directory',
          projectId: 'project-1',
          totalFiles: 2
        })
      ]
    });
  });

  it('searches project files and returns matched-line evidence', async () => {
    const ctx = createContext([
      makeProjectFile({
        id: 'file-js',
        filePath: 'scripts/app.js',
        fileRole: 'logic',
        language: 'javascript',
        content: 'function saveState() {}\nbutton.addEventListener("click", saveState);'
      })
    ]);

    await expect(executeCollectionProjectFileReadAction({
      kind: 'searchProjectFiles',
      projectId: 'project-1',
      query: 'saveState',
      maxResults: 4
    }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '已搜索工作区 · 2 处命中',
      roomProjectId: 'project-1',
      projectFileReads: [
        expect.objectContaining({
          kind: 'search',
          query: 'saveState',
          totalMatches: 2,
          returnedMatches: 2
        })
      ]
    });
  });

  it('reads full project file content with stable file evidence', async () => {
    const ctx = createContext([makeProjectFile()]);

    await expect(executeCollectionProjectFileReadAction({
      kind: 'readProjectFile',
      fileId: 'file-html',
      targetLabel: 'index.html'
    }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '已读取工作区文件 · index.html',
      detailText: [
        '文件：index.html',
        '语言：html',
        '工作区：project-1',
        '角色：entry',
        '<main>hello</main>'
      ].join('\n'),
      projectFileId: 'file-html',
      projectFiles: [expect.objectContaining({ filePath: 'index.html', totalChars: 18 })],
      projectFileReads: [expect.objectContaining({ kind: 'file', projectId: 'project-1' })]
    });
  });

  it('reads query-centered project file context', async () => {
    const ctx = createContext([makeProjectFile({
      id: 'file-js',
      filePath: 'scripts/app.js',
      fileRole: 'logic',
      language: 'javascript',
      content: [
        'const root = document.querySelector("#app");',
        'function render() {',
        '  root.textContent = "ready";',
        '}',
        'render();'
      ].join('\n')
    })]);

    const result = await executeCollectionProjectFileReadAction({
      kind: 'readProjectFileContext',
      fileId: 'file-js',
      query: 'root.textContent',
      before: 1,
      after: 1
    }, ctx);

    expect(result).toMatchObject({
      ok: true,
      summary: '已读取上下文 · scripts/app.js:3',
      projectFileId: 'file-js',
      projectFileReads: [
        expect.objectContaining({
          kind: 'context',
          startLine: 2,
          endLine: 4,
          totalMatches: 1
        })
      ]
    });
    expect(result.ok ? result.detailText : '').toContain('3:   root.textContent = "ready";');
  });
});
