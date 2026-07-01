import {
  toProjectFileFact,
  toProjectFileFactFromDomain
} from './toolExecutorCollectionProjectFiles';
import { resolveRoomProjectFiles } from './roomProjects';
import { buildWholeFileEffect } from './toolExecutorCollectionTextEdit';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { CollectionShelf } from '../types/domain';

export type CollectionRoomProjectAction = Extract<
  ToolAction,
  {
    kind:
      | 'createRoomProject'
      | 'patchRoomProject'
      | 'promoteCardToProject';
  }
>;

function revealCollectionShelf(ctx: ToolContext, shelf: CollectionShelf) {
  ctx.setCollectionShelf(shelf);
  ctx.setWorld('collection');
}

export async function executeCollectionRoomProjectAction(
  action: CollectionRoomProjectAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'createRoomProject': {
      const roomProjectId = ctx.createRoomProject({
        id: action.project.projectId,
        title: action.project.title,
        slug: action.project.slug,
        tags: action.project.tags,
        coverNote: action.project.coverNote,
        coverStyle: action.project.coverStyle,
        source: 'chat-generated'
      });
      if (!roomProjectId) {
        return { ok: false, error: '新建工作区失败。' };
      }
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      const project = ctx.readRoomProject(roomProjectId);
      const files = project ? resolveRoomProjectFiles(project, ctx.listProjectFiles(roomProjectId)) : [];
      const projectFiles = files.map((file) => toProjectFileFact(roomProjectId, file));
      return {
        ok: true,
        roomProjectId,
        projectFiles,
        projectFileReads: [{
          kind: 'directory',
          projectId: roomProjectId,
          totalFiles: projectFiles.length,
          files: projectFiles
        }],
        summary: `已创建工作区 · ${project?.title ?? action.project.title}`
      };
    }
    case 'patchRoomProject': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const updated = ctx.patchRoomProject(project.id, action.patch);
      if (!updated) {
        return { ok: false, error: '修改工作区封面失败。' };
      }
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      return {
        ok: true,
        roomProjectId: project.id,
        summary: `已更新工作区封面 · ${action.patch.title ?? project.title}`
      };
    }
    case 'promoteCardToProject': {
      const card = ctx.readCodeCard(action.cardId);
      if (!card) {
        return { ok: false, error: '没有找到要升为工作区的房间。' };
      }
      if (card.kind === 'tool') {
        return { ok: false, error: '工具卡不能直接升为工作区。请先另存为普通房间卡，或新建工作区后把内容放进去。' };
      }
      const promoted = ctx.promoteCardToProject({
        cardId: action.cardId,
        projectTitle: action.projectTitle,
        filePath: action.filePath,
        fileRole: action.fileRole
      });
      if (!promoted) {
        return { ok: false, error: '升为工作区失败。' };
      }
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      const promotedFile = ctx.readProjectFile(promoted.fileId);
      return {
        ok: true,
        roomProjectId: promoted.projectId,
        projectFileId: promoted.fileId,
        projectFilePaths: promotedFile ? [promotedFile.filePath] : undefined,
        projectFiles: promotedFile ? [toProjectFileFactFromDomain(promotedFile)] : undefined,
        projectFileEffects: promotedFile ? [buildWholeFileEffect({
          projectId: promotedFile.projectId,
          fileId: promotedFile.id,
          filePath: promotedFile.filePath,
          operation: 'created',
          afterContent: promotedFile.content
        })] : undefined
      };
    }
  }
}
