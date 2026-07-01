import type { ToolAction } from '../../engines/toolExecutor';
import { inferCodeLanguage } from '../../engines/codeCardEngine';
import { describeToolAction } from '../../engines/toolExecutorDescribe';
import {
  isWorkspaceProjectAction,
  resolveWorkspaceActionProjectId
} from '../../engines/workspaceBinding';
import type { ToolActionRunOutcome } from './chatToolOutcome';
import { createToolPreviewController } from './chatToolPreviewController';
import type { AssistantToolActionBatchOptions, ToolActionRunnerArgs } from './chatToolActionTypes';
import { throwIfAborted } from './chatAbortError';
import { suggestRoomProjectPlacementForCard } from '../../engines/roomProjects';
import type { WritableConversationBody } from '../../stores/chatStore';
import { createUid } from '../../engines/id';

function keepAssistantCollectionProductInChat(action: ToolAction): ToolAction {
  switch (action.kind) {
    case 'createCodeCard':
    case 'patchCodeCard':
    case 'appendCodeCard':
    case 'editCodeCardText':
    case 'saveAttachmentToCollection':
    case 'saveAttachmentAsCodeCard':
    case 'saveArchiveEntryAsCodeCard':
      return { ...action, openInCollection: false };
    default:
      return action;
  }
}

function isWorkspaceBoundaryAction(action: ToolAction) {
  return action.kind === 'createRoomProject' || action.kind === 'promoteCardToProject';
}

export function createToolActionRunner({
  local,
  chat,
  persona,
  collection,
  runtime,
  space,
  derived,
  memoryActions,
  addRuntimeToolMessage
}: ToolActionRunnerArgs) {
  let directToolActionExecutorPromise: Promise<(
    target: WritableConversationBody,
    action: ToolAction,
    announceRunning: boolean,
    options?: {
      insertBeforeMessageId?: string;
      sourceToolCallId?: string;
    }
  ) => Promise<ToolActionRunOutcome>> | null = null;
  const previewController = createToolPreviewController({
    local,
    chat,
    space,
    derived,
    memoryActions,
    addRuntimeToolMessage
  });
  const getLatestCollectionState = () => collection.readLatestState();

  const runToolAction = async (
    conversationId: string,
    action: ToolAction,
    announceRunningDirectActions: boolean,
    options?: {
      insertBeforeMessageId?: string;
      sourceToolCallId?: string;
    }
  ): Promise<ToolActionRunOutcome> => {
    const writableConversation = await chat.ensureConversationWritable(conversationId);
    if (!writableConversation) {
      const description = describeToolAction(action);
      const error = `Conversation body is not writable: ${conversationId}`;
      return {
        path: 'direct',
        status: 'failed',
        action,
        error,
        toolInvocation: {
          id: createUid('tool'),
          kind: description.kind,
          status: 'failed',
          title: description.title,
          summary: '工具执行失败：当前对话消息还没加载完成。',
          error
        }
      };
    }
    if (previewController.isPreviewableToolAction(action)) {
      const previewResult = await previewController.runPreviewableToolAction(writableConversation, action, options);
      return previewResult.ok
        ? { path: 'preview', status: 'previewed', action }
        : { path: 'preview', status: 'failed', action, error: previewResult.error };
    }

    if (memoryActions.maybeHandleWriteMemoryAction(writableConversation, action, {
      beforeMessageId: options?.insertBeforeMessageId,
      sourceToolCallId: options?.sourceToolCallId
    })) {
      return { path: 'memory', status: 'handled', action };
    }

    if (!directToolActionExecutorPromise) {
      directToolActionExecutorPromise = import('./chatToolDirectActionExecutor').then((module) =>
        module.createDirectToolActionExecutor({
          local,
          chat,
          collection,
          persona,
          runtime,
          space,
          derived,
          memoryActions,
          addRuntimeToolMessage
        })
      );
    }

    const runDirectToolAction = await directToolActionExecutorPromise;
    return await runDirectToolAction(writableConversation, action, announceRunningDirectActions, options);
  };

  const runAssistantToolActions = async (
    conversationId: string,
    actions: ToolAction[],
    options?: AssistantToolActionBatchOptions
  ) => {
    throwIfAborted(options?.signal);
    const conversation = chat.findConversation(conversationId) ?? null;
    const activeProjectId = conversation?.activeProjectId ?? null;
    const latestCollectionState = getLatestCollectionState();
    const scopedActions = (activeProjectId
      ? actions.map((action): ToolAction => {
          if (action.kind !== 'createCodeCard') return action;
          const language = inferCodeLanguage(action.card.code, action.card.language);
          const placement = suggestRoomProjectPlacementForCard({
            id: action.card.title ?? 'workspace-file',
            title: action.card.title ?? '未命名文件',
            language,
            filePath: undefined,
            fileRole: undefined
          });
          return {
            kind: 'createProjectFile',
            file: {
              projectId: activeProjectId,
              filePath: placement.filePath,
              fileRole: placement.fileRole,
              language,
              code: action.card.code,
              replaceContent: true
            },
            targetLabel: action.targetLabel,
            openInCollection: false
          };
        })
      : actions).map(keepAssistantCollectionProductInChat);
    const projectActions = scopedActions.filter((action) => isWorkspaceProjectAction(action, latestCollectionState.projectFiles));
    const nonProjectActions = scopedActions.filter((action) => !isWorkspaceProjectAction(action, latestCollectionState.projectFiles));
    const outcomes: ToolActionRunOutcome[] = [];
    const canExecuteWorkspaceBoundary = options?.workspaceExecutionMode === 'execute-approved';

    for (const action of nonProjectActions) {
      throwIfAborted(options?.signal);
      const originalIndex = scopedActions.indexOf(action);
      outcomes.push(await runToolAction(conversationId, action, true, {
        insertBeforeMessageId: options?.beforeMessageId,
        sourceToolCallId: options?.toolCallIds?.[originalIndex]
      }));
      throwIfAborted(options?.signal);
      await Promise.resolve();
    }

    const runnableProjectActions = projectActions.filter((action) => {
      if (!activeProjectId) return true;
      if (action.kind !== 'createRoomProject') return true;
      const requestedProjectId = action.project.projectId.trim();
      if (requestedProjectId !== activeProjectId) return true;
      return !latestCollectionState.roomProjects.some((project) => project.id === requestedProjectId);
    });
    const switchProjectActions = runnableProjectActions.filter((action) => {
      if (!activeProjectId) return false;
      if (action.kind === 'promoteCardToProject') return true;
      const actionProjectId = resolveWorkspaceActionProjectId(action, latestCollectionState.projectFiles)?.trim();
      return Boolean(actionProjectId) && actionProjectId !== activeProjectId;
    });
    const blockedWorkspaceBoundaryActions = canExecuteWorkspaceBoundary
      ? []
      : runnableProjectActions.filter((action) => isWorkspaceBoundaryAction(action));
    const blockedProjectActions = canExecuteWorkspaceBoundary
      ? []
      : [
          ...blockedWorkspaceBoundaryActions,
          ...switchProjectActions,
          ...(!activeProjectId ? runnableProjectActions : [])
        ];
    const blockedProjectActionSet = new Set(blockedProjectActions);
    const inScopeProjectActions = runnableProjectActions.filter((action) => !blockedProjectActionSet.has(action));

    if (blockedProjectActionSet.size > 0) {
      throwIfAborted(options?.signal);
      const currentWorkspaceLabel = activeProjectId
        ? collection.roomProjects.find((project) => project.id === activeProjectId)?.title ?? activeProjectId
        : null;
      local.setCommandStatus(
        currentWorkspaceLabel
          ? `工作区边界由你决定。当前对话留在 ${currentWorkspaceLabel}；要切换工作区，请先从目标工作区打开对话。`
          : '工作区边界由你决定。请先新建或进入工作区，再让我在里面改文件。'
      );
    }

    for (const action of inScopeProjectActions) {
      throwIfAborted(options?.signal);
      const originalIndex = scopedActions.indexOf(action);
      outcomes.push(await runToolAction(conversationId, action, true, {
        insertBeforeMessageId: options?.beforeMessageId,
        sourceToolCallId: options?.toolCallIds?.[originalIndex]
      }));
      throwIfAborted(options?.signal);
      await Promise.resolve();
    }

    return outcomes;
  };

  return {
    runToolAction,
    runAssistantToolActions,
    applyToolPreview: previewController.applyToolPreview,
    saveToolPreview: previewController.saveToolPreview,
    rollbackToolPreview: previewController.rollbackToolPreview
  };
}
