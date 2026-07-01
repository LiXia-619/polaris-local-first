import { toProjectFileFactFromDomain } from './toolExecutorCollectionProjectFiles';
import {
  buildAmbiguousSnippetError,
  buildMissingSnippetError,
  buildTextEditEffect,
  buildWholeFileEffect,
  countStringOccurrences,
  resolveProjectFileAppend,
  resolveProjectFileLineInsertion,
  resolveProjectFileLineReplacement
} from './toolExecutorCollectionTextEdit';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { CollectionShelf, ProjectFileEffect, ProjectFileFact } from '../types/domain';

export type CollectionProjectFileWriteAction = Extract<
  ToolAction,
  {
    kind:
      | 'createProjectFile'
      | 'writeProjectFiles'
      | 'editProjectFileText'
      | 'insertProjectFile'
      | 'replaceProjectFileLines'
      | 'deleteProjectFile'
      | 'appendProjectFile';
  }
>;

function revealCollectionShelf(ctx: ToolContext, shelf: CollectionShelf) {
  ctx.setCollectionShelf(shelf);
  ctx.setWorld('collection');
}

export async function executeCollectionProjectFileWriteAction(
  action: CollectionProjectFileWriteAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'createProjectFile': {
      const beforeFile = action.file.projectId
        ? ctx.listProjectFiles(action.file.projectId).find((file) => file.filePath === action.file.filePath)
        : undefined;
      const fileId = ctx.createProjectFile({
        ...action.file,
        code: action.file.code ?? ''
      });
      if (!fileId) {
        return { ok: false, error: '新建工作区文件失败。' };
      }
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      const createdFile = ctx.readProjectFile(fileId);
      const projectFile = createdFile ? toProjectFileFactFromDomain(createdFile) : undefined;
      return {
        ok: true,
        projectFileId: fileId,
        projectFilePaths: [action.file.filePath],
        projectFiles: projectFile ? [projectFile] : undefined,
        projectFileEffects: createdFile ? [buildWholeFileEffect({
          projectId: createdFile.projectId,
          fileId,
          filePath: createdFile.filePath,
          operation: beforeFile ? 'overwritten' : 'created',
          beforeContent: beforeFile?.content,
          afterContent: createdFile.content
        })] : undefined,
        summary: `已创建工作区文件 · ${action.file.filePath}`
      };
    }
    case 'writeProjectFiles': {
      if (!action.projectId.trim()) {
        return { ok: false, error: '写入工作区文件失败：缺少工作区 id。' };
      }
      const invalidFile = action.files.find((file) => !file.filePath.trim());
      if (invalidFile) {
        return { ok: false, error: '写入工作区文件失败：文件路径不能为空。' };
      }
      const beforeFiles = new Map(
        ctx.listProjectFiles(action.projectId).map((file) => [file.filePath, file] as const)
      );
      const fileIds: string[] = [];
      const effects: ProjectFileEffect[] = [];
      const projectFiles: ProjectFileFact[] = [];
      for (const file of action.files) {
        const fileId = ctx.createProjectFile({
          ...file,
          code: file.code,
          replaceContent: file.replaceContent ?? true
        });
        if (!fileId) {
          return { ok: false, error: `写入工作区文件失败：${file.filePath}` };
        }
        fileIds.push(fileId);
        const afterFile = ctx.readProjectFile(fileId);
        if (afterFile) {
          projectFiles.push(toProjectFileFactFromDomain(afterFile));
          const beforeFile = beforeFiles.get(afterFile.filePath);
          const replaceContent = file.replaceContent ?? true;
          effects.push(buildWholeFileEffect({
            projectId: afterFile.projectId,
            fileId,
            filePath: afterFile.filePath,
            operation: beforeFile
              ? replaceContent ? 'overwritten' : 'appended'
              : 'created',
            beforeContent: beforeFile?.content,
            afterContent: afterFile.content
          }));
        }
      }
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      return {
        ok: true,
        projectFileId: fileIds[0],
        projectFileIds: fileIds,
        projectFilePaths: action.files.map((file) => file.filePath),
        projectFiles,
        projectFileEffects: effects,
        summary: `已写入 ${fileIds.length} 个工作区文件`,
        detailText: action.files.map((file) => `${file.filePath} · ${file.replaceContent === false ? '追加' : '覆盖'}`).join('\n')
      };
    }
    case 'editProjectFileText': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file || typeof file.content !== 'string') {
        return { ok: false, error: '没有找到要局部替换的工作区文件。' };
      }
      const currentContent = file.content;
      const matchCount = countStringOccurrences(currentContent, action.oldString);
      if (matchCount === 0) {
        return {
          ok: false,
          error: buildMissingSnippetError({
            label: '要替换的原文片段',
            snippet: action.oldString,
            filePath: file.filePath,
            guidance: '请先用 searchProjectFiles 搜更短的稳定片段，或用 readProjectFileContext 读取目标行附近；oldString 必须和当前文件完全一致，包括空格、换行和引号。'
          })
        };
      }
      if (matchCount > 1) {
        return {
          ok: false,
          error: buildAmbiguousSnippetError({
            content: currentContent,
            snippet: action.oldString,
            count: matchCount,
            label: '要替换的原文片段',
            guidance: '请提供更长的 oldString。',
            filePath: file.filePath
          })
        };
      }
      const matchOffset = currentContent.indexOf(action.oldString);
      const nextContent = currentContent.replace(action.oldString, action.newString);
      const updated = ctx.patchProjectFile(action.fileId, { content: nextContent });
      if (!updated) {
        return { ok: false, error: '没有找到要局部替换的工作区文件。' };
      }
      const updatedFile = ctx.readProjectFile(action.fileId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      return {
        ok: true,
        projectFileId: action.fileId,
        projectFilePaths: [file.filePath],
        projectFiles: updatedFile ? [toProjectFileFactFromDomain(updatedFile)] : undefined,
        projectFileEffects: [buildTextEditEffect({
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          operation: 'replaced',
          beforeContent: currentContent,
          afterContent: nextContent,
          oldString: action.oldString,
          newString: action.newString,
          matchOffset,
          matchCount
        })],
        summary: `已局部替换工作区文件 · ${file.filePath}`
      };
    }
    case 'insertProjectFile': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file || typeof file.content !== 'string') {
        return { ok: false, error: '没有找到要插入的工作区文件。' };
      }
      const currentContent = file.content;
      if (typeof action.lineNumber === 'number') {
        const linePosition = action.linePosition ?? 'after';
        const lineTarget = resolveProjectFileLineInsertion(currentContent, action.lineNumber, linePosition);
        if (!lineTarget) {
          return { ok: false, error: `没有找到要插入的第 ${action.lineNumber} 行。` };
        }
        const nextContent = `${currentContent.slice(0, lineTarget.offset)}${action.code}${currentContent.slice(lineTarget.offset)}`;
        const updated = ctx.patchProjectFile(action.fileId, { content: nextContent });
        if (!updated) {
          return { ok: false, error: '没有找到要插入的工作区文件。' };
        }
        const updatedFile = ctx.readProjectFile(action.fileId);
        if (action.openInCollection) {
          revealCollectionShelf(ctx, 'project');
        }
        return {
          ok: true,
          projectFileId: action.fileId,
          projectFilePaths: [file.filePath],
          projectFiles: updatedFile ? [toProjectFileFactFromDomain(updatedFile)] : undefined,
          projectFileEffects: [buildTextEditEffect({
            projectId: file.projectId,
            fileId: file.id,
            filePath: file.filePath,
            operation: 'inserted',
            beforeContent: currentContent,
            afterContent: nextContent,
            newString: action.code,
            matchOffset: lineTarget.offset,
            matchCount: 1
          })],
        summary: `已按行插入工作区文件 · ${file.filePath}:${lineTarget.lineNumber}`
        };
      }
      const anchor = action.beforeString ?? action.afterString ?? '';
      const matchCount = countStringOccurrences(currentContent, anchor);
      if (matchCount === 0) {
        return {
          ok: false,
          error: buildMissingSnippetError({
            label: '要插入的锚点片段',
            snippet: anchor,
            filePath: file.filePath,
            guidance: '请先用 searchProjectFiles 搜更短的稳定锚点，或用 readProjectFileContext 读取目标行后改用 lineNumber + linePosition 插入。'
          })
        };
      }
      if (matchCount > 1) {
        return {
          ok: false,
          error: buildAmbiguousSnippetError({
            content: currentContent,
            snippet: anchor,
            count: matchCount,
            label: '要插入的锚点片段',
            guidance: '请提供更长的 beforeString 或 afterString。',
            filePath: file.filePath
          })
        };
      }
      const matchOffset = currentContent.indexOf(anchor);
      const nextContent = action.beforeString !== undefined
        ? currentContent.replace(anchor, `${action.code}${anchor}`)
        : currentContent.replace(anchor, `${anchor}${action.code}`);
      const updated = ctx.patchProjectFile(action.fileId, { content: nextContent });
      if (!updated) {
        return { ok: false, error: '没有找到要插入的工作区文件。' };
      }
      const updatedFile = ctx.readProjectFile(action.fileId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      return {
        ok: true,
        projectFileId: action.fileId,
        projectFilePaths: [file.filePath],
        projectFiles: updatedFile ? [toProjectFileFactFromDomain(updatedFile)] : undefined,
        projectFileEffects: [buildTextEditEffect({
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          operation: 'inserted',
          beforeContent: currentContent,
          afterContent: nextContent,
          newString: action.code,
          matchOffset,
          matchCount
        })],
        summary: `已插入工作区文件 · ${file.filePath}`
      };
    }
    case 'replaceProjectFileLines': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file || typeof file.content !== 'string') {
        return { ok: false, error: '没有找到要按行替换的工作区文件。' };
      }
      const currentContent = file.content;
      const lineTarget = resolveProjectFileLineReplacement(
        currentContent,
        action.startLine,
        action.endLine ?? action.startLine,
        action.code
      );
      if (!lineTarget) {
        return {
          ok: false,
          error: `没有找到要替换的工作区文件行段 · ${file.filePath}:${action.startLine}${action.endLine ? `-${action.endLine}` : ''}。请先用 readProjectFileContext 读取目标行附近，再用返回的行号替换。`
        };
      }
      const updated = ctx.patchProjectFile(action.fileId, { content: lineTarget.content });
      if (!updated) {
        return { ok: false, error: '没有找到要按行替换的工作区文件。' };
      }
      const updatedFile = ctx.readProjectFile(action.fileId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      const replacedText = currentContent
        .slice(lineTarget.startOffset, lineTarget.endOffset)
        .replace(/\r?\n$/, '');
      return {
        ok: true,
        projectFileId: action.fileId,
        projectFilePaths: [file.filePath],
        projectFiles: updatedFile ? [toProjectFileFactFromDomain(updatedFile)] : undefined,
        projectFileEffects: [buildTextEditEffect({
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          operation: 'replaced',
          beforeContent: currentContent,
          afterContent: lineTarget.content,
          oldString: replacedText,
          newString: action.code,
          matchOffset: lineTarget.startOffset,
          matchCount: 1
        })],
        summary: `已按行替换工作区文件 · ${file.filePath}:${lineTarget.startLine}-${lineTarget.endLine}`
      };
    }
    case 'deleteProjectFile': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file) {
        return { ok: false, error: '没有找到要删除的工作区文件。' };
      }
      const deleted = ctx.deleteProjectFile(action.fileId);
      if (!deleted) {
        return { ok: false, error: '删除工作区文件失败。' };
      }
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      return {
        ok: true,
        projectFileId: action.fileId,
        projectFilePaths: [file.filePath],
        projectFileEffects: [buildWholeFileEffect({
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          operation: 'deleted',
          beforeContent: file.content
        })],
        summary: `已删除工作区文件 · ${file.filePath}`
      };
    }
    case 'appendProjectFile': {
      const file = ctx.readProjectFile(action.fileId);
      if (!file || typeof file.content !== 'string') {
        return { ok: false, error: '没有找到要追加的工作区文件。' };
      }
      const currentContent = file.content;
      const resolvedAppend = resolveProjectFileAppend(file, currentContent, action.code);
      const updated = ctx.patchProjectFile(action.fileId, { content: resolvedAppend.content });
      if (!updated) {
        return { ok: false, error: '没有找到要追加的工作区文件。' };
      }
      const updatedFile = ctx.readProjectFile(action.fileId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }
      return {
        ok: true,
        projectFileId: action.fileId,
        projectFilePaths: [file.filePath],
        projectFiles: updatedFile ? [toProjectFileFactFromDomain(updatedFile)] : undefined,
        projectFileEffects: [buildTextEditEffect({
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          operation: resolvedAppend.operation,
          beforeContent: currentContent,
          afterContent: resolvedAppend.content,
          newString: action.code,
          matchOffset: resolvedAppend.offset
        })],
        summary: `已续写工作区文件 · ${file.filePath}`
      };
    }
  }
}
