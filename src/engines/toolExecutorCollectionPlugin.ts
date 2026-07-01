import { executeCollectionCodeCardAction } from './toolExecutorCollectionCodeCards';
import { executeCollectionProjectDiagnosticAction } from './toolExecutorCollectionProjectDiagnostics';
import { executeCollectionProjectFileReadAction } from './toolExecutorCollectionProjectFileReads';
import { executeCollectionProjectFileWriteAction } from './toolExecutorCollectionProjectFileWrites';
import { executeCollectionRoomProjectAction } from './toolExecutorCollectionRoomProjects';
import { executeCollectionWorkspacePreviewStateAction } from './toolExecutorCollectionWorkspacePreviewState';
import { executeCollectionWorkspaceReferenceAction } from './toolExecutorCollectionWorkspaceReferences';
import { isToolActionKindHandledByPlugin } from './tool-protocol/toolManifest';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { ToolExecutorPlugin } from './toolExecutorPlugins';

export type CollectionToolAction = Extract<
  ToolAction,
  {
    kind:
      | 'createRoomProject'
      | 'createCodeCard'
      | 'createProjectFile'
      | 'listCodeCards'
      | 'patchRoomProject'
      | 'writeProjectFiles'
      | 'listProjectFiles'
      | 'searchProjectFiles'
      | 'readWorkspacePreviewState'
      | 'listWorkspaceReferences'
      | 'searchWorkspaceReferences'
      | 'readWorkspaceReference'
      | 'promoteWorkspaceReferenceToProjectFile'
      | 'pinProjectFileAsReference'
      | 'searchReadableContext'
      | 'checkProjectPreview'
      | 'inspectProjectRuntime'
      | 'promoteCardToProject'
      | 'patchCodeCard'
      | 'editCodeCardText'
      | 'editProjectFileText'
      | 'replaceProjectFileLines'
      | 'deleteProjectFile'
      | 'insertProjectFile'
      | 'appendCodeCard'
      | 'appendProjectFile'
      | 'readCodeCard'
      | 'readProjectFile'
      | 'readProjectFileContext';
  }
>;

export function isCollectionToolAction(action: ToolAction): action is CollectionToolAction {
  return isToolActionKindHandledByPlugin(action.kind, 'collection');
}

async function executeCollectionToolAction(
  action: CollectionToolAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'listCodeCards':
    case 'createCodeCard':
    case 'patchCodeCard':
    case 'editCodeCardText':
    case 'appendCodeCard':
    case 'readCodeCard':
      return executeCollectionCodeCardAction(action, ctx);
    case 'createProjectFile':
    case 'writeProjectFiles':
    case 'editProjectFileText':
    case 'replaceProjectFileLines':
    case 'insertProjectFile':
    case 'deleteProjectFile':
    case 'appendProjectFile':
      return executeCollectionProjectFileWriteAction(action, ctx);
    case 'listProjectFiles':
    case 'searchProjectFiles':
    case 'readProjectFile':
    case 'readProjectFileContext':
      return executeCollectionProjectFileReadAction(action, ctx);
    case 'readWorkspacePreviewState':
      return executeCollectionWorkspacePreviewStateAction(action, ctx);
    case 'listWorkspaceReferences':
    case 'searchWorkspaceReferences':
    case 'readWorkspaceReference':
    case 'promoteWorkspaceReferenceToProjectFile':
    case 'pinProjectFileAsReference':
    case 'searchReadableContext':
      return executeCollectionWorkspaceReferenceAction(action, ctx);
    case 'checkProjectPreview':
    case 'inspectProjectRuntime':
      return executeCollectionProjectDiagnosticAction(action, ctx);
    case 'createRoomProject':
    case 'patchRoomProject':
    case 'promoteCardToProject':
      return executeCollectionRoomProjectAction(action, ctx);
  }
}

export const collectionToolExecutorPlugin: ToolExecutorPlugin = {
  name: 'collection',
  canHandle: isCollectionToolAction,
  execute: async (action, ctx) => {
    if (!isCollectionToolAction(action)) {
      return { ok: false, error: `收藏工具无法执行：${action.kind}` };
    }
    return executeCollectionToolAction(action, ctx);
  }
};
