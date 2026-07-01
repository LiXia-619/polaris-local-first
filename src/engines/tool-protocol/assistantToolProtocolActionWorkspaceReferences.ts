import {
  normalizeOptionalString,
  normalizePositiveInt
} from './assistantToolProtocolActionShared';
import { normalizeOptionalFileRole } from './assistantToolProtocolActionProjectFiles';
import type { ParseActionResult } from './assistantToolProtocolActionShared';
import type { AssistantToolActionParseContext } from './assistantToolProtocolActionContext';

function normalizeOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function resolveProjectId(value: unknown, context?: AssistantToolActionParseContext) {
  return normalizeOptionalString(value)
    ?? normalizeOptionalString(context?.activeProjectId);
}

export function parseWorkspaceReferenceToolAction(
  action: Record<string, unknown>,
  context?: AssistantToolActionParseContext
): ParseActionResult | null {
  switch (action.kind) {
    case 'listWorkspaceReferences': {
      return { action: {
        kind: 'listWorkspaceReferences',
        projectId: resolveProjectId(action.projectId, context),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'searchWorkspaceReferences': {
      const query = typeof action.query === 'string' ? action.query.trim() : '';
      if (!query) return { action: null, issue: '搜索工作区参考资料时缺少 query。' };
      return { action: {
        kind: 'searchWorkspaceReferences',
        projectId: resolveProjectId(action.projectId, context),
        query,
        maxResults: normalizePositiveInt(action.maxResults),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'readWorkspaceReference': {
      const docId = normalizeOptionalString(action.docId) ?? normalizeOptionalString(action.target);
      const title = normalizeOptionalString(action.title);
      if (!docId && !title) return { action: null, issue: '读取工作区参考资料时缺少 docId 或 title。' };
      return { action: {
        kind: 'readWorkspaceReference',
        projectId: resolveProjectId(action.projectId, context),
        docId,
        title,
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    case 'promoteWorkspaceReferenceToProjectFile': {
      const docId = normalizeOptionalString(action.docId) ?? normalizeOptionalString(action.target);
      const title = normalizeOptionalString(action.title);
      const filePath = normalizeOptionalString(action.filePath);
      if (!docId && !title) return { action: null, issue: '参考资料转工作区文件时缺少 docId 或 title。' };
      if (!filePath) return { action: null, issue: '参考资料转工作区文件时缺少 filePath。' };
      return { action: {
        kind: 'promoteWorkspaceReferenceToProjectFile',
        projectId: resolveProjectId(action.projectId, context),
        docId,
        title,
        filePath,
        fileRole: normalizeOptionalFileRole(action.fileRole),
        language: normalizeOptionalString(action.language),
        replaceContent: normalizeOptionalBoolean(action.replaceContent) ?? true,
        targetLabel: normalizeOptionalString(action.targetLabel),
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'pinProjectFileAsReference': {
      return { action: {
        kind: 'pinProjectFileAsReference',
        target: normalizeOptionalString(action.target),
        projectId: resolveProjectId(action.projectId, context),
        filePath: normalizeOptionalString(action.filePath),
        title: normalizeOptionalString(action.title),
        summary: normalizeOptionalString(action.summary),
        targetLabel: normalizeOptionalString(action.targetLabel),
        openInCollection: normalizeOptionalBoolean(action.openInCollection)
      } };
    }
    case 'searchReadableContext': {
      const query = typeof action.query === 'string' ? action.query.trim() : '';
      if (!query) return { action: null, issue: '搜索可读上下文时缺少 query。' };
      return { action: {
        kind: 'searchReadableContext',
        query,
        projectId: resolveProjectId(action.projectId, context),
        maxResults: normalizePositiveInt(action.maxResults),
        targetLabel: normalizeOptionalString(action.targetLabel)
      } };
    }
    default:
      return null;
  }
}
