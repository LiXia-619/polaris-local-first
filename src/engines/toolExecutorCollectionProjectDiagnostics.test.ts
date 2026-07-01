import { describe, expect, it, vi } from 'vitest';
import { executeCollectionProjectDiagnosticAction } from './toolExecutorCollectionProjectDiagnostics';
import type { ToolContext } from './toolExecutorTypes';
import type { ProjectFile, RoomProject } from '../types/domain';

function makeRoomProject(patch: Partial<RoomProject> = {}): RoomProject {
  return {
    id: 'project-1',
    title: 'Mini Phone',
    slug: 'mini-phone',
    fileIds: ['file-html', 'file-css'],
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
    content: '<!doctype html><main>ready</main>',
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function createContext(files: ProjectFile[]) {
  return {
    readRoomProject: vi.fn((projectId: string) => projectId === 'project-1'
      ? makeRoomProject({ fileIds: files.map((file) => file.id) })
      : null),
    listProjectFiles: vi.fn(() => files)
  } as Partial<ToolContext> as ToolContext;
}

describe('executeCollectionProjectDiagnosticAction', () => {
  it('checks project preview and returns runnable evidence', async () => {
    const ctx = createContext([
      makeProjectFile({
        content: '<!doctype html><link rel="stylesheet" href="./styles/main.css"><main>ready</main>'
      }),
      makeProjectFile({
        id: 'file-css',
        filePath: 'styles/main.css',
        fileRole: 'style',
        language: 'css',
        content: 'body { margin: 0; }'
      })
    ]);

    await expect(executeCollectionProjectDiagnosticAction({
      kind: 'checkProjectPreview',
      projectId: 'project-1'
    }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '预览检查通过 · index.html',
      roomProjectId: 'project-1',
      projectFileId: 'file-html',
      projectDiagnostics: [expect.objectContaining({
        tool: 'checkProjectPreview',
        reason: 'ok',
        inlinedLocalAssets: ['styles/main.css']
      })],
      projectPreviewRunnable: true
    });
  });

  it('returns unavailable runtime inspection evidence outside browser runtime', async () => {
    const ctx = createContext([makeProjectFile()]);

    await expect(executeCollectionProjectDiagnosticAction({
      kind: 'inspectProjectRuntime',
      projectId: 'project-1',
      settleMs: 50
    }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '运行检查完成 · unavailable',
      roomProjectId: 'project-1',
      projectFileId: 'file-html',
      projectDiagnostics: [expect.objectContaining({
        tool: 'inspectProjectRuntime',
        reason: 'unavailable',
        entryFileId: 'file-html'
      })],
      projectPreviewRunnable: false
    });
  });
});
