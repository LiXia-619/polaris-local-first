import { describe, expect, it, vi } from 'vitest';
import { executeCollectionRoomProjectAction } from './toolExecutorCollectionRoomProjects';
import type { ToolContext } from './toolExecutorTypes';
import type { CodeCard, ProjectFile, RoomProject } from '../types/domain';

function makeRoomProject(patch: Partial<RoomProject> = {}): RoomProject {
  return {
    id: 'project-1',
    title: 'Landing Refresh',
    slug: 'landing-refresh',
    fileIds: [],
    tags: ['首页'],
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function makeProjectFile(patch: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 'file-1',
    projectId: 'project-1',
    filePath: 'index.html',
    fileRole: 'entry',
    language: 'html',
    content: '<main />',
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function makeCodeCard(patch: Partial<CodeCard> = {}): CodeCard {
  return {
    id: 'card-1',
    title: 'Mini Phone',
    language: 'html',
    code: '<main />',
    tags: ['demo'],
    createdAt: 1,
    updatedAt: 2,
    kind: 'card',
    source: 'chat-generated',
    ...patch
  };
}

function createContext(project = makeRoomProject(), files: ProjectFile[] = []) {
  return {
    createRoomProject: vi.fn(() => project.id),
    readRoomProject: vi.fn((projectId: string) => projectId === project.id ? project : null),
    patchRoomProject: vi.fn(() => true),
    listProjectFiles: vi.fn(() => files),
    readCodeCard: vi.fn(() => makeCodeCard()),
    promoteCardToProject: vi.fn(() => ({ projectId: project.id, fileId: 'file-1' })),
    readProjectFile: vi.fn((fileId: string) => files.find((file) => file.id === fileId) ?? null),
    setCollectionShelf: vi.fn(),
    setWorld: vi.fn(),
    createProjectFile: vi.fn()
  } as Partial<ToolContext> as ToolContext;
}

describe('executeCollectionRoomProjectAction', () => {
  it('creates room projects and emits directory replay evidence', async () => {
    const project = makeRoomProject({ id: 'landing-refresh', fileIds: ['file-1'] });
    const file = makeProjectFile({ id: 'file-1', projectId: 'landing-refresh' });
    const ctx = createContext(project, [file]);

    await expect(executeCollectionRoomProjectAction({
      kind: 'createRoomProject',
      project: {
        projectId: 'landing-refresh',
        title: 'Landing Refresh',
        tags: ['首页']
      },
      openInCollection: true
    }, ctx)).resolves.toMatchObject({
      ok: true,
      roomProjectId: 'landing-refresh',
      summary: '已创建工作区 · Landing Refresh',
      projectFiles: [expect.objectContaining({ filePath: 'index.html' })],
      projectFileReads: [expect.objectContaining({
        kind: 'directory',
        projectId: 'landing-refresh',
        totalFiles: 1
      })]
    });

    expect(ctx.createRoomProject).toHaveBeenCalledWith({
      id: 'landing-refresh',
      title: 'Landing Refresh',
      slug: undefined,
      tags: ['首页'],
      coverNote: undefined,
      coverStyle: undefined,
      source: 'chat-generated'
    });
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('project');
  });

  it('patches room project cover metadata without touching project files', async () => {
    const ctx = createContext(makeRoomProject({ id: 'mini-phone', title: 'Mini Phone' }));

    await expect(executeCollectionRoomProjectAction({
      kind: 'patchRoomProject',
      projectId: 'mini-phone',
      patch: {
        coverNote: '小屏幕里的柔光入口。',
        coverStyle: '& { background: #10131c; }'
      },
      openInCollection: true
    }, ctx)).resolves.toEqual({
      ok: true,
      roomProjectId: 'mini-phone',
      summary: '已更新工作区封面 · Mini Phone'
    });

    expect(ctx.patchRoomProject).toHaveBeenCalledWith('mini-phone', {
      coverNote: '小屏幕里的柔光入口。',
      coverStyle: '& { background: #10131c; }'
    });
    expect(ctx.createProjectFile).not.toHaveBeenCalled();
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('project');
  });

  it('promotes regular cards into room projects and reports created file evidence', async () => {
    const project = makeRoomProject({ id: 'project-1', title: 'Mini Phone', fileIds: ['file-1'] });
    const file = makeProjectFile({ id: 'file-1', projectId: 'project-1', content: '<main />' });
    const ctx = createContext(project, [file]);

    await expect(executeCollectionRoomProjectAction({
      kind: 'promoteCardToProject',
      cardId: 'card-1',
      projectTitle: 'Mini Phone',
      filePath: 'index.html',
      fileRole: 'entry',
      openInCollection: true
    }, ctx)).resolves.toMatchObject({
      ok: true,
      roomProjectId: 'project-1',
      projectFileId: 'file-1',
      projectFilePaths: ['index.html'],
      projectFiles: [expect.objectContaining({ filePath: 'index.html' })],
      projectFileEffects: [expect.objectContaining({ operation: 'created' })]
    });

    expect(ctx.promoteCardToProject).toHaveBeenCalledWith({
      cardId: 'card-1',
      projectTitle: 'Mini Phone',
      filePath: 'index.html',
      fileRole: 'entry'
    });
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('project');
  });

  it('refuses to promote tool cards into room projects', async () => {
    const ctx = createContext();
    vi.mocked(ctx.readCodeCard).mockReturnValue(makeCodeCard({
      kind: 'tool',
      source: 'manual',
      tags: ['tool']
    }));

    await expect(executeCollectionRoomProjectAction({
      kind: 'promoteCardToProject',
      cardId: 'card-1',
      openInCollection: true
    }, ctx)).resolves.toEqual({
      ok: false,
      error: '工具卡不能直接升为工作区。请先另存为普通房间卡，或新建工作区后把内容放进去。'
    });

    expect(ctx.promoteCardToProject).not.toHaveBeenCalled();
    expect(ctx.setCollectionShelf).not.toHaveBeenCalled();
  });
});
