import { asObject, normalizeStringArray } from './assistantToolProtocolShared';
import { normalizeOptionalFileRole } from './assistantToolProtocolActionProjectFiles';
import { normalizeOptionalString } from './assistantToolProtocolActionShared';
import type { ParseActionResult } from './assistantToolProtocolActionShared';

function normalizeOptionalCssText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

export function parseRoomProjectToolAction(action: Record<string, unknown>): ParseActionResult | null {
  switch (action.kind) {
    case 'createRoomProject': {
      const projectId = normalizeOptionalString(action.projectId);
      if (!projectId) {
        return { action: null, issue: '新建工作区时缺少 projectId。' };
      }
      return { action: {
        kind: 'createRoomProject',
        project: {
          projectId,
          title: normalizeOptionalString(action.title) ?? '未命名工作区',
          slug: normalizeOptionalString(action.slug),
          tags: normalizeStringArray(action.tags),
          coverNote: normalizeOptionalString(action.coverNote),
          coverStyle: normalizeOptionalCssText(action.coverStyle)
        },
        targetLabel: normalizeOptionalString(action.targetLabel),
        openInCollection: normalizeOptionalBoolean(action.openInCollection) ?? false
      } };
    }
    case 'patchRoomProject': {
      const patch = asObject(action.patch) ?? action;
      const tags = patch.tags === undefined ? undefined : normalizeStringArray(patch.tags);
      const nextPatch = {
        title: normalizeOptionalString(patch.title),
        slug: normalizeOptionalString(patch.slug),
        tags,
        coverNote: normalizeOptionalString(patch.coverNote),
        coverStyle: normalizeOptionalCssText(patch.coverStyle)
      };
      if (
        nextPatch.title === undefined
        && nextPatch.slug === undefined
        && nextPatch.tags === undefined
        && nextPatch.coverNote === undefined
        && nextPatch.coverStyle === undefined
      ) {
        return { action: null, issue: '修改工作区外壳时缺少 title / coverNote / coverStyle / tags。' };
      }
      return { action: {
        kind: 'patchRoomProject',
        projectId: normalizeOptionalString(action.projectId),
        targetLabel: normalizeOptionalString(action.targetLabel),
        patch: nextPatch,
        openInCollection: normalizeOptionalBoolean(action.openInCollection) ?? true
      } };
    }
    case 'promoteCardToProject': {
      return { action: {
        kind: 'promoteCardToProject',
        target: normalizeOptionalString(action.target),
        projectTitle: normalizeOptionalString(action.projectTitle),
        filePath: normalizeOptionalString(action.filePath),
        fileRole: normalizeOptionalFileRole(action.fileRole),
        targetLabel: normalizeOptionalString(action.targetLabel),
        openInCollection: normalizeOptionalBoolean(action.openInCollection) ?? false
      } };
    }
    default:
      return null;
  }
}
