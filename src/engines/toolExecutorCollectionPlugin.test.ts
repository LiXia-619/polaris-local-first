import { describe, expect, it, vi } from 'vitest';
import { collectionToolExecutorPlugin } from './toolExecutorCollectionPlugin';
import type { ToolContext } from './toolExecutorTypes';
import type { ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../types/domain';

function createCollectionContext() {
  const project: RoomProject = {
    id: 'project-1',
    title: '视觉游戏',
    slug: 'visual-game',
    fileIds: ['file-1'],
    entryFileId: 'file-1',
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1
  };
  const file: ProjectFile = {
    id: 'file-1',
    projectId: 'project-1',
    filePath: 'index.html',
    fileRole: 'entry',
    language: 'html',
    content: '<main>Nova 在白树下醒来</main>',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1
  };
  const reference: WorkspaceReferenceDoc = {
    id: 'workspace-ref-1',
    projectId: 'project-1',
    title: '白树设定',
    summary: 'Nova 和白树的视觉设定',
    content: '白树会发光，Nova 看到旧世界的边界。',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1
  };

  return {
    readRoomProject: vi.fn((projectId: string) => projectId === project.id ? project : null),
    listCodeCards: vi.fn(() => []),
    listProjectFiles: vi.fn(() => [file]),
    readProjectFile: vi.fn((fileId: string) => fileId === file.id ? file : null),
    listWorkspaceReferenceDocs: vi.fn(() => [reference]),
    readWorkspaceReferenceDoc: vi.fn((docId: string) => docId === reference.id ? reference : null),
    listCollaboratorMemoryDocs: vi.fn(() => [{
      id: 'memory-doc-1',
      title: '协作者资料',
      summary: '白树风格',
      content: '白树的风格更像冷光。',
      source: 'user' as const,
      updatedAt: 1
    }])
  } as Partial<ToolContext> as ToolContext;
}

describe('collectionToolExecutorPlugin workspace references', () => {
  it('lists and reads workspace reference docs', async () => {
    const ctx = createCollectionContext();

    await expect(collectionToolExecutorPlugin.execute({
      kind: 'listWorkspaceReferences',
      projectId: 'project-1'
    }, ctx)).resolves.toMatchObject({
      ok: true,
      workspaceReferenceDocs: [{
        docId: 'workspace-ref-1',
        title: '白树设定'
      }]
    });

    await expect(collectionToolExecutorPlugin.execute({
      kind: 'readWorkspaceReference',
      projectId: 'project-1',
      docId: 'workspace-ref-1'
    }, ctx)).resolves.toMatchObject({
      ok: true,
      workspaceReferenceDocId: 'workspace-ref-1',
      detailText: expect.stringContaining('白树会发光')
    });
  });

  it('searches readable context across project files, workspace references, and memory docs', async () => {
    const ctx = createCollectionContext();

    const result = await collectionToolExecutorPlugin.execute({
      kind: 'searchReadableContext',
      projectId: 'project-1',
      query: '白树'
    }, ctx);

    expect(result).toMatchObject({
      ok: true,
      readableContextCandidates: expect.arrayContaining([
        expect.objectContaining({ source: 'project-file', readTool: 'readProjectFile' }),
        expect.objectContaining({ source: 'workspace-reference', readTool: 'readWorkspaceReference' }),
        expect.objectContaining({ source: 'memory-doc', readTool: 'readMemoryDoc' })
      ])
    });
  });
});
