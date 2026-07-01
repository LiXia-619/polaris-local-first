import type { ProjectFileContextResult, ProjectFileSearchResult } from './projectFileInspection';
import type { ResolvedRoomProjectFile } from './roomProjects';
import { countProjectFileLines } from './toolExecutorCollectionTextEdit';
import type { ProjectFile, ProjectFileFact } from '../types/domain';

export function toProjectFileFact(
  projectId: string,
  file: ResolvedRoomProjectFile
): ProjectFileFact {
  return {
    projectId,
    fileId: file.fileId,
    filePath: file.path,
    language: file.language,
    fileRole: file.role,
    isEntry: file.isEntry,
    totalLines: countProjectFileLines(file.content),
    totalChars: file.content.length
  };
}

export function toProjectFileFactFromDomain(file: ProjectFile): ProjectFileFact {
  return {
    projectId: file.projectId,
    fileId: file.id,
    filePath: file.filePath,
    language: file.language,
    fileRole: file.fileRole,
    totalLines: countProjectFileLines(file.content),
    totalChars: file.content.length
  };
}

export function formatProjectFileDirectory(projectId: string, files: ResolvedRoomProjectFile[]) {
  return [
    `工作区：${projectId}`,
    `文件数：${files.length}`,
    '',
    ...files.map((file) => [
      file.isEntry ? '入口' : '文件',
      file.path,
      file.language,
      file.role ? `role=${file.role}` : null
    ].filter(Boolean).join(' · '))
  ].join('\n');
}

export function formatProjectFileSearch(projectId: string, result: ProjectFileSearchResult) {
  return [
    `工作区：${projectId}`,
    `搜索：${result.query}`,
    `命中：${result.totalMatches} 处，返回 ${result.returnedMatches.length} 处`,
    '',
    ...result.returnedMatches.map((match) => [
      `${match.filePath}:${match.lineNumber} · ${match.line}`,
      `匹配：${match.matchReason}${match.matchKind === 'path' ? ' · 文件路径' : ''}`,
      `范围：${match.excerptStartLine}-${match.excerptEndLine}`,
      match.excerpt || '[空]'
    ].join('\n'))
  ].join('\n');
}

export function formatProjectFileContext(result: ProjectFileContextResult) {
  return [
    `文件：${result.filePath}`,
    `语言：${result.language}`,
    `行数：${result.lineCount}`,
    result.anchorLineNumber
      ? `锚点：第 ${result.anchorLineNumber} 行${typeof result.totalMatches === 'number' ? ` · query 命中 ${result.totalMatches} 处` : ''}`
      : typeof result.totalMatches === 'number'
        ? `锚点：未命中 query · query 命中 ${result.totalMatches} 处`
        : '锚点：文件开头',
    `范围：${result.excerptStartLine}-${result.excerptEndLine}`,
    '',
    result.excerpt || '[空]'
  ].join('\n');
}
