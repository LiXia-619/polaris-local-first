import { asObject } from './assistantToolProtocolShared';
import {
  normalizeOptionalString,
  normalizePositiveInt
} from './assistantToolProtocolActionShared';
import type { ParseActionResult } from './assistantToolProtocolActionShared';
import type { AssistantToolActionParseContext } from './assistantToolProtocolActionContext';

function normalizeOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function normalizeOptionalFileRole(value: unknown) {
  switch (value) {
    case 'entry':
    case 'style':
    case 'logic':
    case 'content':
    case 'note':
    case 'asset-manifest':
      return value;
    default:
      return undefined;
  }
}

function normalizeLinePosition(value: unknown) {
  return value === 'before' || value === 'after' ? value : undefined;
}

function resolveProjectId(value: unknown, context?: AssistantToolActionParseContext) {
  return normalizeOptionalString(value)
    ?? normalizeOptionalString(context?.activeProjectId);
}

function normalizeProjectFileWriteDrafts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const file = asObject(entry);
      if (!file) return null;
      const filePath = normalizeOptionalString(file.filePath);
      if (!filePath || typeof file.code !== 'string') return null;
      return {
        filePath,
        fileRole: normalizeOptionalFileRole(file.fileRole),
        language: normalizeOptionalString(file.language),
        code: file.code,
        replaceContent: normalizeOptionalBoolean(file.replaceContent) ?? true
      };
    })
    .filter((file): file is NonNullable<typeof file> => Boolean(file));
}

export function parseProjectFileToolAction(
  action: Record<string, unknown>,
  context?: AssistantToolActionParseContext
): ParseActionResult | null {
  switch (action.kind) {
    case 'createProjectFile': {
      const file = asObject(action.file) ?? asObject(action.card);
      if (!file) return { action: null, issue: '新建工作区文件时缺少文件内容。' };
      const projectId = resolveProjectId(file.projectId, context);
      const filePath = normalizeOptionalString(file.filePath);
      if (!projectId) return { action: null, issue: '新建工作区文件时缺少 projectId。' };
      if (!filePath) return { action: null, issue: '新建工作区文件时缺少 filePath。' };
      return { action: {
        kind: 'createProjectFile',
        file: {
          projectId,
          filePath,
          fileRole: normalizeOptionalFileRole(file.fileRole),
          language: normalizeOptionalString(file.language),
          code: typeof file.code === 'string' ? file.code : ''
        },
        targetLabel: normalizeOptionalString(action.targetLabel),
        openInCollection: normalizeOptionalBoolean(action.openInCollection) ?? false
      } };
    }
    case 'appendProjectFile': {
      const code = typeof action.code === 'string' ? action.code : '';
      if (!code) return { action: null, issue: '追加工作区文件时缺少 code。' };
      return { action: {
        kind: 'appendProjectFile',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        targetLabel: normalizeOptionalString(action.targetLabel),
        code,
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'insertProjectFile': {
      const code = typeof action.code === 'string' ? action.code : '';
      const beforeString = typeof action.beforeString === 'string' ? action.beforeString : '';
      const afterString = typeof action.afterString === 'string' ? action.afterString : '';
      const lineNumber = normalizePositiveInt(action.lineNumber);
      if (!code) return { action: null, issue: '插入工作区文件时缺少 code。' };
      if (!beforeString && !afterString && !lineNumber) return { action: null, issue: '插入工作区文件时缺少 beforeString、afterString 或 lineNumber。' };
      return { action: {
        kind: 'insertProjectFile',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        targetLabel: normalizeOptionalString(action.targetLabel),
        beforeString: lineNumber ? undefined : beforeString || undefined,
        afterString: lineNumber || beforeString ? undefined : afterString,
        ...(lineNumber ? {
          lineNumber,
          linePosition: normalizeLinePosition(action.linePosition) ?? normalizeLinePosition(action.position)
        } : {}),
        code,
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'replaceProjectFileLines': {
      if (typeof action.code !== 'string') return { action: null, issue: '按行替换工作区文件时缺少 code。' };
      const startLine = normalizePositiveInt(action.startLine);
      const endLine = normalizePositiveInt(action.endLine);
      if (!startLine) return { action: null, issue: '按行替换工作区文件时缺少 startLine。' };
      if (endLine && endLine < startLine) return { action: null, issue: '按行替换工作区文件时 endLine 不能小于 startLine。' };
      return { action: {
        kind: 'replaceProjectFileLines',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        targetLabel: normalizeOptionalString(action.targetLabel),
        startLine,
        endLine,
        code: action.code,
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'writeProjectFiles': {
      const files = normalizeProjectFileWriteDrafts(action.files);
      if (!files.length) return { action: null, issue: '批量写入工作区文件时缺少 files。' };
      return { action: {
        kind: 'writeProjectFiles',
        projectId: resolveProjectId(action.projectId, context),
        targetLabel: normalizeOptionalString(action.targetLabel),
        files,
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'listProjectFiles': {
      return { action: {
        kind: 'listProjectFiles',
        projectId: resolveProjectId(action.projectId, context),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'searchProjectFiles': {
      const query = typeof action.query === 'string' ? action.query.trim() : '';
      if (!query) return { action: null, issue: '搜索工作区文件时缺少 query。' };
      return { action: {
        kind: 'searchProjectFiles',
        projectId: resolveProjectId(action.projectId, context),
        query,
        maxResults: normalizePositiveInt(action.maxResults),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'readWorkspacePreviewState': {
      return { action: {
        kind: 'readWorkspacePreviewState',
        projectId: resolveProjectId(action.projectId, context),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'editProjectFileText': {
      const oldString = typeof action.oldString === 'string' ? action.oldString : '';
      const newString = typeof action.newString === 'string' ? action.newString : '';
      if (!oldString) return { action: null, issue: '局部替换时缺少 oldString。' };
      return { action: {
        kind: 'editProjectFileText',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        targetLabel: normalizeOptionalString(action.targetLabel),
        oldString,
        newString,
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'deleteProjectFile': {
      return { action: {
        kind: 'deleteProjectFile',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        targetLabel: normalizeOptionalString(action.targetLabel),
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'readProjectFile': {
      return { action: {
        kind: 'readProjectFile',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'readProjectFileContext': {
      return { action: {
        kind: 'readProjectFileContext',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        query: normalizeOptionalString(action.query),
        lineNumber: normalizePositiveInt(action.lineNumber),
        before: normalizePositiveInt(action.before),
        after: normalizePositiveInt(action.after),
        occurrence: normalizePositiveInt(action.occurrence),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    default:
      return null;
  }
}
