import type { ToolAction, ToolExecutionResult } from '../../engines/toolExecutorTypes';
import type { CodeCardFileRole, ToolInvocation } from '../../types/domain';
import { buildThemeHistoryLabel } from './themeHistoryLabel';
import { buildToolCodeWriteDetails } from './chatToolWriteDetails';

type ToolActionDescription = Pick<
  ToolInvocation,
  | 'kind'
  | 'title'
  | 'summary'
  | 'themeIntentLabel'
  | 'themeRecipe'
  | 'themeSurfaceIds'
  | 'themeSurfaceLabels'
  | 'themePatchMode'
  | 'themeTransactionReason'
  | 'targetLabel'
> & {
  themeScope?: ToolInvocation['themeScope'];
  memoryItems?: string[];
};

type ProjectFileFrame = {
  fileId: string;
  filePath: string;
  projectId: string;
  language: string;
  fileRole?: CodeCardFileRole;
  updatedAt: number;
};

type ToolInvocationBuilderOptions = {
  insertBeforeMessageId?: string;
  sourceToolCallId?: string;
};

function themeActionDetailText(action: ToolAction) {
  if (
    action.kind === 'patchRawCss' ||
    action.kind === 'appendThemeCss' ||
    action.kind === 'insertThemeCss' ||
    action.kind === 'replaceThemeCss'
  ) {
    return action.css.trim();
  }
  if (action.kind === 'editThemeCss') return action.newString.trim();
  if (action.kind === 'deleteThemeCss') return action.oldString.trim();
  return undefined;
}

function buildInvocationHistoryLabel(description: ToolActionDescription) {
  return buildThemeHistoryLabel({
    scope: description.themeScope,
    title: description.title,
    themeIntentLabel: description.themeIntentLabel,
    targetLabel: description.targetLabel
  });
}

function actionCanCarryProjectFileEvidence(action: ToolAction) {
  return (
    action.kind === 'createProjectFile' ||
    action.kind === 'writeProjectFiles' ||
    action.kind === 'promoteCardToProject' ||
    action.kind === 'checkProjectPreview' ||
    action.kind === 'inspectProjectRuntime' ||
    action.kind === 'editProjectFileText' ||
    action.kind === 'deleteProjectFile' ||
    action.kind === 'appendProjectFile' ||
    action.kind === 'replaceProjectFileLines' ||
    action.kind === 'insertProjectFile' ||
    action.kind === 'readProjectFile' ||
    action.kind === 'readProjectFileContext' ||
    action.kind === 'listWorkspaceReferences' ||
    action.kind === 'searchWorkspaceReferences' ||
    action.kind === 'readWorkspaceReference' ||
    action.kind === 'searchReadableContext'
  );
}

function failedActionProjectFileId(action: ToolAction) {
  if (
    action.kind === 'editProjectFileText' ||
    action.kind === 'deleteProjectFile' ||
    action.kind === 'appendProjectFile' ||
    action.kind === 'replaceProjectFileLines' ||
    action.kind === 'insertProjectFile' ||
    action.kind === 'readProjectFileContext'
  ) {
    return action.fileId;
  }
  return undefined;
}

function actionCardId(action: ToolAction, result: ToolExecutionResult) {
  if (
    action.kind !== 'createCodeCard' &&
    action.kind !== 'patchCodeCard' &&
    action.kind !== 'editCodeCardText' &&
    action.kind !== 'appendCodeCard' &&
    action.kind !== 'invokeCodeCardTool' &&
    action.kind !== 'readCodeCard' &&
    action.kind !== 'saveAttachmentAsCodeCard' &&
    action.kind !== 'saveArchiveEntryAsCodeCard'
  ) {
    return undefined;
  }
  if (result.ok) return result.cardId;
  if (
    action.kind === 'patchCodeCard' ||
    action.kind === 'editCodeCardText' ||
    action.kind === 'appendCodeCard'
  ) {
    return action.cardId;
  }
  return undefined;
}

export function buildRunningToolInvocation(args: {
  id: string;
  action: ToolAction;
  description: ToolActionDescription;
  options?: ToolInvocationBuilderOptions;
}): ToolInvocation {
  const { action, description } = args;

  return {
    id: args.id,
    kind: description.kind,
    status: 'running',
    title: description.title,
    summary: description.summary,
    themeIntentLabel: description.themeIntentLabel,
    themeRecipe: description.themeRecipe,
    themeSurfaceIds: description.themeSurfaceIds,
    themeSurfaceLabels: description.themeSurfaceLabels,
    themePatchMode: description.themePatchMode,
    themeTransactionReason: description.themeTransactionReason,
    targetLabel: description.targetLabel,
    detailText: themeActionDetailText(action),
    codeWriteDetails: buildToolCodeWriteDetails(action),
    originMessageId: args.options?.insertBeforeMessageId,
    toolCallId: args.options?.sourceToolCallId,
    historyLabel: buildInvocationHistoryLabel(description)
  };
}

export function buildDirectToolInvocation(args: {
  id: string;
  action: ToolAction;
  description: ToolActionDescription;
  result: ToolExecutionResult;
  projectFileFrames: ProjectFileFrame[];
  options?: ToolInvocationBuilderOptions;
}): ToolInvocation {
  const { action, description, result } = args;

  return {
    id: args.id,
    kind: description.kind,
    toolName: action.kind === 'invokeCodeCardTool' || action.kind === 'invokeMcpTool' ? action.toolName : undefined,
    status: result.ok ? 'executed' : 'failed',
    title: description.title,
    summary: result.ok ? result.summary ?? description.summary : result.error,
    world: action.kind === 'switchWorld' ? action.world : undefined,
    cardId: actionCardId(action, result),
    projectFileId:
      actionCanCarryProjectFileEvidence(action)
        ? result.ok
          ? result.projectFileId
          : failedActionProjectFileId(action)
        : undefined,
    projectFileIds:
      action.kind === 'writeProjectFiles' && result.ok
        ? result.projectFileIds
        : undefined,
    projectFilePaths:
      result.ok && result.projectFilePaths?.length
        ? result.projectFilePaths
        : args.projectFileFrames.length > 0
        ? args.projectFileFrames.map((file) => file.filePath)
        : undefined,
    projectFiles: result.ok ? result.projectFiles : undefined,
    projectFileReads: result.ok ? result.projectFileReads : undefined,
    projectFileEffects: result.ok ? result.projectFileEffects : undefined,
    workspaceReferenceDocId: result.ok ? result.workspaceReferenceDocId : undefined,
    workspaceReferenceDocTitle: result.ok ? result.workspaceReferenceDocTitle : undefined,
    workspaceReferenceDocs: result.ok ? result.workspaceReferenceDocs : undefined,
    workspaceReferenceDocReads: result.ok ? result.workspaceReferenceDocReads : undefined,
    readableContextCandidates: result.ok ? result.readableContextCandidates : undefined,
    projectDiagnostics: result.ok ? result.projectDiagnostics : undefined,
    codeWriteDetails: result.ok ? buildToolCodeWriteDetails(action, result.projectFileEffects) : undefined,
    projectPreviewRunnable:
      (action.kind === 'checkProjectPreview' || action.kind === 'inspectProjectRuntime') && result.ok
        ? result.projectPreviewRunnable
        : undefined,
    imageCardId: action.kind === 'saveAttachmentToCollection' && result.ok ? result.imageCardId : undefined,
    memoryItems: action.kind === 'writeMemory' ? description.memoryItems : undefined,
    memoryDocId:
      action.kind === 'writeMemoryDoc'
        ? (result.ok ? result.memoryDocId : action.docId)
        : undefined,
    memoryDocTitle:
      action.kind === 'writeMemoryDoc'
        ? (result.ok ? result.memoryDocTitle : action.title)
        : undefined,
    memoryDocSummary: action.kind === 'writeMemoryDoc' ? action.summary : undefined,
    memoryDocContent: action.kind === 'writeMemoryDoc' ? action.content : undefined,
    webSearch: result.ok ? result.webSearch : undefined,
    webPageRead: result.ok ? result.webPageRead : undefined,
    mcpResult: result.ok ? result.mcpResult : undefined,
    themeIntentLabel: description.themeIntentLabel,
    themeRecipe: description.themeRecipe,
    themeSurfaceIds: description.themeSurfaceIds,
    themeSurfaceLabels: description.themeSurfaceLabels,
    themePatchMode: description.themePatchMode,
    themeTransactionReason: description.themeTransactionReason,
    targetLabel: description.targetLabel,
    originMessageId: args.options?.insertBeforeMessageId,
    toolCallId: args.options?.sourceToolCallId,
    historyLabel: buildInvocationHistoryLabel(description),
    detailText: result.ok ? result.detailText : undefined,
    error: result.ok ? undefined : result.error
  };
}
