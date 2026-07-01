import {
  readProjectFileContext,
  searchProjectFiles
} from './projectFileInspection';
import {
  formatProjectFileContext,
  formatProjectFileDirectory,
  formatProjectFileSearch,
  toProjectFileFact,
  toProjectFileFactFromDomain
} from './toolExecutorCollectionProjectFiles';
import { resolveRoomProjectFiles } from './roomProjects';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';

export type CollectionProjectFileReadAction = Extract<
  ToolAction,
  {
    kind:
      | 'listProjectFiles'
      | 'searchProjectFiles'
      | 'readProjectFile'
      | 'readProjectFileContext';
  }
>;

export async function executeCollectionProjectFileReadAction(
  action: CollectionProjectFileReadAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'listProjectFiles': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const files = resolveRoomProjectFiles(project, ctx.listProjectFiles(action.projectId));
      return {
        ok: true,
        summary: `已列出工作区文件 · ${project.title}`,
        detailText: formatProjectFileDirectory(project.id, files),
        projectFiles: files.map((file) => toProjectFileFact(project.id, file)),
        projectFileReads: [{
          kind: 'directory',
          projectId: project.id,
          totalFiles: files.length,
          files: files.map((file) => toProjectFileFact(project.id, file))
        }],
        roomProjectId: project.id
      };
    }
    case 'searchProjectFiles': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const files = resolveRoomProjectFiles(project, ctx.listProjectFiles(action.projectId));
      const result = searchProjectFiles(files, {
        query: action.query,
        maxResults: action.maxResults
      });
      return {
        ok: true,
        summary: `已搜索工作区 · ${result.totalMatches} 处命中`,
        detailText: formatProjectFileSearch(project.id, result),
        projectFileReads: [{
          kind: 'search',
          projectId: project.id,
          query: result.query,
          totalMatches: result.totalMatches,
          returnedMatches: result.returnedMatches.length,
          matches: result.returnedMatches
        }],
        roomProjectId: project.id
      };
    }
    case 'readProjectFile': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file) {
        return { ok: false, error: '没有找到要读取的工作区文件。' };
      }
      return {
        ok: true,
        summary: `已读取工作区文件 · ${file.filePath}`,
        detailText: [
          `文件：${file.filePath}`,
          `语言：${file.language}`,
          `工作区：${file.projectId}`,
          file.fileRole ? `角色：${file.fileRole}` : null,
          '',
          file.content.trim() || '[空]'
        ].filter(Boolean).join('\n'),
        projectFileId: file.id,
        projectFiles: [toProjectFileFactFromDomain(file)],
        projectFileReads: [{
          kind: 'file',
          projectId: file.projectId,
          file: toProjectFileFactFromDomain(file)
        }]
      };
    }
    case 'readProjectFileContext': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file) {
        return { ok: false, error: '没有找到要读取的工作区文件。' };
      }
      const result = readProjectFileContext({
        fileId: file.id,
        title: file.filePath.split('/').pop() || file.filePath,
        language: file.language,
        path: file.filePath,
        role: file.fileRole,
        isEntry: file.fileRole === 'entry',
        content: file.content
      }, {
        query: action.query,
        lineNumber: action.lineNumber,
        before: action.before,
        after: action.after,
        occurrence: action.occurrence
      });
      return {
        ok: true,
        summary: result.anchorLineNumber
          ? `已读取上下文 · ${file.filePath}:${result.anchorLineNumber}`
          : `已读取上下文 · ${file.filePath}`,
        detailText: formatProjectFileContext(result),
        projectFileId: file.id,
        projectFileReads: [{
          kind: 'context',
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          language: file.language,
          startLine: result.excerptStartLine,
          endLine: result.excerptEndLine,
          totalLines: result.lineCount,
          anchorLineNumber: result.anchorLineNumber,
          totalMatches: result.totalMatches
        }]
      };
    }
  }
}
