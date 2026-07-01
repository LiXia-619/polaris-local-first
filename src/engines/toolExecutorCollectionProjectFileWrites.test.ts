import { describe, expect, it, vi } from 'vitest';
import { executeCollectionProjectFileWriteAction } from './toolExecutorCollectionProjectFileWrites';
import type { ToolContext } from './toolExecutorTypes';
import type { ProjectFile } from '../types/domain';

function makeProjectFile(patch: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 'file-1',
    projectId: 'project-1',
    filePath: 'index.html',
    fileRole: 'entry',
    language: 'html',
    content: '<main>\n</main>',
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function createContext(file = makeProjectFile()) {
  return {
    listProjectFiles: vi.fn(() => []),
    createProjectFile: vi.fn(() => file.id),
    readProjectFile: vi.fn((fileId: string) => fileId === file.id ? file : null),
    patchProjectFile: vi.fn(() => true),
    deleteProjectFile: vi.fn(() => true),
    setCollectionShelf: vi.fn(),
    setWorld: vi.fn()
  } as Partial<ToolContext> as ToolContext;
}

describe('executeCollectionProjectFileWriteAction', () => {
  it('creates project files with empty code allowed and emits write evidence', async () => {
    const file = makeProjectFile({ content: '' });
    const ctx = createContext(file);

    await expect(executeCollectionProjectFileWriteAction({
      kind: 'createProjectFile',
      file: {
        projectId: 'project-1',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html'
      },
      openInCollection: true
    }, ctx)).resolves.toMatchObject({
      ok: true,
      projectFileId: 'file-1',
      projectFilePaths: ['index.html'],
      projectFiles: [expect.objectContaining({ filePath: 'index.html' })],
      projectFileEffects: [expect.objectContaining({ operation: 'created', filePath: 'index.html' })],
      summary: '已创建工作区文件 · index.html'
    });

    expect(ctx.createProjectFile).toHaveBeenCalledWith({
      projectId: 'project-1',
      filePath: 'index.html',
      fileRole: 'entry',
      language: 'html',
      code: ''
    });
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('project');
  });

  it('writes multiple project files and records created/append operations', async () => {
    const afterFiles = new Map([
      ['project-1:index.html', makeProjectFile({
        id: 'project-1:index.html',
        filePath: 'index.html',
        content: '<main />'
      })],
      ['project-1:style.css', makeProjectFile({
        id: 'project-1:style.css',
        filePath: 'style.css',
        fileRole: 'style',
        language: 'css',
        content: 'body {}'
      })]
    ]);
    const ctx = createContext();
    vi.mocked(ctx.listProjectFiles).mockReturnValue([
      makeProjectFile({ id: 'old-style', filePath: 'style.css', content: 'html {}' })
    ]);
    vi.mocked(ctx.createProjectFile).mockImplementation((input) => `${input.projectId}:${input.filePath}`);
    vi.mocked(ctx.readProjectFile).mockImplementation((fileId) => afterFiles.get(fileId) ?? null);

    await expect(executeCollectionProjectFileWriteAction({
      kind: 'writeProjectFiles',
      projectId: 'project-1',
      files: [
        {
          projectId: 'project-1',
          filePath: 'index.html',
          fileRole: 'entry',
          language: 'html',
          code: '<main />'
        },
        {
          projectId: 'project-1',
          filePath: 'style.css',
          fileRole: 'style',
          language: 'css',
          code: 'body {}',
          replaceContent: false
        }
      ],
      openInCollection: true
    }, ctx)).resolves.toMatchObject({
      ok: true,
      projectFileIds: ['project-1:index.html', 'project-1:style.css'],
      projectFilePaths: ['index.html', 'style.css'],
      projectFileEffects: [
        expect.objectContaining({ operation: 'created', filePath: 'index.html' }),
        expect.objectContaining({ operation: 'appended', filePath: 'style.css' })
      ],
      detailText: 'index.html · 覆盖\nstyle.css · 追加'
    });
  });

  it('edits project file text with exact matching and emits changed-line evidence', async () => {
    const ctx = createContext(makeProjectFile({ content: '<main>\n  old\n</main>' }));

    await expect(executeCollectionProjectFileWriteAction({
      kind: 'editProjectFileText',
      fileId: 'file-1',
      oldString: '  old',
      newString: '  new',
      openInCollection: true
    }, ctx)).resolves.toMatchObject({
      ok: true,
      projectFileId: 'file-1',
      projectFilePaths: ['index.html'],
      projectFileEffects: [
        expect.objectContaining({
          operation: 'replaced',
          matchCount: 1,
          changedLines: { start: 2, end: 2 }
        })
      ],
      summary: '已局部替换工作区文件 · index.html'
    });

    expect(ctx.patchProjectFile).toHaveBeenCalledWith('file-1', {
      content: '<main>\n  new\n</main>'
    });
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('project');
  });

  it('rejects missing and ambiguous project file snippets without patching', async () => {
    const ctx = createContext(makeProjectFile({ content: 'same one same two' }));

    await expect(executeCollectionProjectFileWriteAction({
      kind: 'editProjectFileText',
      fileId: 'file-1',
      oldString: 'missing',
      newString: 'x'
    }, ctx)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('要替换的原文片段没有命中 · index.html。')
    });

    await expect(executeCollectionProjectFileWriteAction({
      kind: 'insertProjectFile',
      fileId: 'file-1',
      afterString: 'same',
      code: 'x'
    }, ctx)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('要插入的锚点片段匹配到 2 处')
    });

    expect(ctx.patchProjectFile).not.toHaveBeenCalled();
  });

  it('inserts by line, appends before closing html tags, and deletes with evidence', async () => {
    const lineCtx = createContext(makeProjectFile({ content: 'one\ntwo\nthree' }));
    await expect(executeCollectionProjectFileWriteAction({
      kind: 'insertProjectFile',
      fileId: 'file-1',
      lineNumber: 2,
      linePosition: 'after',
      code: 'inserted\n'
    }, lineCtx)).resolves.toMatchObject({
      ok: true,
      summary: '已按行插入工作区文件 · index.html:2',
      projectFileEffects: [expect.objectContaining({ operation: 'inserted', matchCount: 1 })]
    });
    expect(lineCtx.patchProjectFile).toHaveBeenCalledWith('file-1', {
      content: 'one\ntwo\ninserted\nthree'
    });

    const replaceLinesCtx = createContext(makeProjectFile({ content: 'one\ntwo\nthree\nfour' }));
    await expect(executeCollectionProjectFileWriteAction({
      kind: 'replaceProjectFileLines',
      fileId: 'file-1',
      startLine: 2,
      endLine: 3,
      code: 'new two\nnew three'
    }, replaceLinesCtx)).resolves.toMatchObject({
      ok: true,
      summary: '已按行替换工作区文件 · index.html:2-3',
      projectFileEffects: [
        expect.objectContaining({
          operation: 'replaced',
          matchCount: 1,
          changedLines: { start: 2, end: 3 }
        })
      ]
    });
    expect(replaceLinesCtx.patchProjectFile).toHaveBeenCalledWith('file-1', {
      content: 'one\nnew two\nnew three\nfour'
    });

    const appendCtx = createContext(makeProjectFile({
      content: '<html><body><main /></body></html>'
    }));
    await expect(executeCollectionProjectFileWriteAction({
      kind: 'appendProjectFile',
      fileId: 'file-1',
      code: '<script />'
    }, appendCtx)).resolves.toMatchObject({
      ok: true,
      summary: '已续写工作区文件 · index.html',
      projectFileEffects: [expect.objectContaining({ operation: 'inserted' })]
    });
    expect(appendCtx.patchProjectFile).toHaveBeenCalledWith('file-1', {
      content: '<html><body><main /><script /></body></html>'
    });

    const deleteCtx = createContext(makeProjectFile({ content: 'body {}' }));
    await expect(executeCollectionProjectFileWriteAction({
      kind: 'deleteProjectFile',
      fileId: 'file-1'
    }, deleteCtx)).resolves.toMatchObject({
      ok: true,
      summary: '已删除工作区文件 · index.html',
      projectFileEffects: [expect.objectContaining({ operation: 'deleted', beforeLines: 1 })]
    });
    expect(deleteCtx.deleteProjectFile).toHaveBeenCalledWith('file-1');
  });
});
