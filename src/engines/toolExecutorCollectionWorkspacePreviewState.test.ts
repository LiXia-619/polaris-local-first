import { describe, expect, it, vi } from 'vitest';
import { executeCollectionWorkspacePreviewStateAction } from './toolExecutorCollectionWorkspacePreviewState';
import type { ToolContext } from './toolExecutorTypes';
import type { RoomProject } from '../types/domain';

function makeProject(patch: Partial<RoomProject> = {}): RoomProject {
  return {
    id: 'project-1',
    title: 'Mood Board',
    slug: 'mood-board',
    fileIds: [],
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function createContext(project: RoomProject | null, state: Record<string, unknown> = {}) {
  return {
    readRoomProject: vi.fn((projectId: string) => projectId === 'project-1' ? project : null),
    readCodeCardState: vi.fn(async () => state)
  } as Partial<ToolContext> as ToolContext;
}

describe('executeCollectionWorkspacePreviewStateAction', () => {
  it('refuses to read preview state when the workspace has not granted access', async () => {
    const ctx = createContext(makeProject());

    await expect(executeCollectionWorkspacePreviewStateAction({
      kind: 'readWorkspacePreviewState',
      projectId: 'project-1'
    }, ctx)).resolves.toEqual({
      ok: false,
      error: '这个工作区没有允许协作者读取预览状态。请先在工作区设置里打开权限。'
    });
    expect(ctx.readCodeCardState).not.toHaveBeenCalled();
  });

  it('reads the hosted preview room state for an opted-in workspace', async () => {
    const ctx = createContext(makeProject({
      previewStateAccess: {
        assistantReadEnabled: true,
        updatedAt: 12
      }
    }), {
      currentNode: 'intro',
      __polarisStorage: {
        draft: 'blue house'
      },
      __polarisSessionStorage: {
        tab: 'notes'
      },
      __polarisForm: {
        'input[name="title"]': '秘密设定'
      }
    });

    const result = await executeCollectionWorkspacePreviewStateAction({
      kind: 'readWorkspacePreviewState',
      projectId: 'project-1'
    }, ctx);

    expect(result).toMatchObject({
      ok: true,
      summary: '已读取工作区预览状态 · Mood Board · 4 项',
      roomProjectId: 'project-1'
    });
    expect(ctx.readCodeCardState).toHaveBeenCalledWith('project:project-1');
    expect(result.ok ? result.detailText : '').toContain('PolarisRoom 显式状态：1 项');
    expect(result.ok ? result.detailText : '').toContain('"currentNode": "intro"');
    expect(result.ok ? result.detailText : '').toContain('预览 localStorage：1 项');
    expect(result.ok ? result.detailText : '').toContain('"draft": "blue house"');
    expect(result.ok ? result.detailText : '').toContain('自动保存表单字段：1 项');
    expect(result.ok ? result.detailText : '').toContain('"input[name=\\"title\\"]": "秘密设定"');
  });
});
