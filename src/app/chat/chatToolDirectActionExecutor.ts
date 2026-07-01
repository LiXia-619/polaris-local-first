import { describeToolAction } from '../../engines/toolExecutorDescribe';
import { executeToolAction } from '../../engines/toolExecutorExecute';
import { filterProjectFilesForCollaboratorScope } from '../../engines/collectionOwnership';
import { createUid } from '../../engines/id';
import type { ToolAction } from '../../engines/toolExecutorTypes';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ToolActionRunOutcome } from './chatToolOutcome';
import { buildDirectToolExecutionContext } from './chatToolExecutionContext';
import { buildDirectToolInvocation, buildRunningToolInvocation } from './chatToolInvocationBuilder';
import type {
  AddRuntimeToolMessage,
  ChatSpaceFrontstagePort,
  ChatSpaceThemeSessionPort,
  ChatToolStoreBindings,
  MemoryActions,
  ToolActionChatState,
  ToolActionCollectionState,
  ToolActionLocalState
} from './chatToolActionTypes';
import { resolveChatCollaboratorOwnerId } from './chatCollaboratorOwner';

type DirectActionExecutorArgs = {
  local: ToolActionLocalState;
  chat: Pick<
    ToolActionChatState,
    | 'conversations'
    | 'findConversation'
    | 'getConversationMessages'
    | 'updateMessage'
    | 'appendRuntimeFeedbackEvent'
    | 'setConversationActiveProject'
  > & Pick<ToolActionChatState, 'readLatestState'>;
  collection: ToolActionCollectionState;
  persona: Pick<ChatToolStoreBindings['persona'], 'personas'>;
  runtime: ChatToolStoreBindings['runtime'];
  space:
    & Pick<
      ChatSpaceFrontstagePort,
      | 'frontstageCollaboratorId'
      | 'activeCardId'
      | 'activeWorld'
      | 'collectionShelf'
      | 'setCollectionShelf'
      | 'setWorld'
      | 'setActiveCard'
      | 'spotlightCard'
    >
    & Pick<ChatSpaceThemeSessionPort, 'applyThemePatch' | 'applyThemePreset' | 'getCurrentThemeFrame'>;
  derived?: {
    activeCollaboratorSourceId: string | null;
  };
  memoryActions: MemoryActions;
  addRuntimeToolMessage: AddRuntimeToolMessage;
};

export function createDirectToolActionExecutor({
  local,
  chat,
  collection,
  persona,
  runtime,
  space,
  derived,
  memoryActions,
  addRuntimeToolMessage
}: DirectActionExecutorArgs) {
  const getLatestCollectionState = () => collection.readLatestState();
  const resolveWorkspaceFileFrame = (args: {
    ownerCollaboratorId: string | null | undefined;
    activeProjectId: string | null;
    fileId: string;
  }) => {
    const latestCollectionState = getLatestCollectionState();
    const accessibleProjectFiles = filterProjectFilesForCollaboratorScope(
      latestCollectionState.projectFiles,
      args.ownerCollaboratorId,
      args.activeProjectId
    );
    const file = accessibleProjectFiles.find((entry) => entry.id === args.fileId) ?? null;
    if (!file) return null;
    return {
      fileId: file.id,
      filePath: file.filePath,
      projectId: file.projectId,
      language: file.language,
      fileRole: file.fileRole,
      updatedAt: file.updatedAt
    };
  };

  return async function runDirectToolAction(
    target: WritableConversationBody,
    action: ToolAction,
    announceRunning: boolean,
    options?: {
      insertBeforeMessageId?: string;
      sourceToolCallId?: string;
    }
  ): Promise<ToolActionRunOutcome> {
    const conversationId = target.conversationId;
    const description = describeToolAction(action);
    const toolMessageId = createUid('tool');
    const conversation = chat.findConversation(conversationId);
    // 群聊里产出的归属人是正在发言的成员，不是聊天世界台前的协作者
    const isGroupScope = conversation?.kind === 'group';
    const ownerCollaboratorId = resolveChatCollaboratorOwnerId({
      frontstageCollaboratorId: isGroupScope ? null : space.frontstageCollaboratorId,
      conversationCollaboratorId: conversation?.collaboratorId,
      fallbackCollaboratorId: isGroupScope ? derived?.activeCollaboratorSourceId ?? null : null
    });
    const activeProjectId = conversation?.activeProjectId ?? null;

    if (announceRunning) {
      addRuntimeToolMessage(
        target,
        buildRunningToolInvocation({
          id: toolMessageId,
          action,
          description,
          options
        }),
        undefined,
        { beforeMessageId: options?.insertBeforeMessageId }
      );
    }

    const result = await (async () => {
      try {
        return await executeToolAction(action, buildDirectToolExecutionContext({
          chat,
          collection,
          persona,
          runtime,
          space,
          memoryActions,
          conversationId,
          ownerCollaboratorId,
          activeProjectId
        }));
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '工具执行失败。'
        } as const;
      }
    })();
    const currentActiveProjectId = chat.findConversation(conversationId)?.activeProjectId ?? null;
    const resultProjectFileIds =
      result.ok && (
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
        action.kind === 'promoteWorkspaceReferenceToProjectFile' ||
        action.kind === 'pinProjectFileAsReference' ||
        action.kind === 'searchReadableContext'
      )
        ? result.projectFileIds?.length
          ? result.projectFileIds
          : result.projectFileId
            ? [result.projectFileId]
            : []
        : [];
    const resultProjectFileFrames = resultProjectFileIds
      .map((fileId) => resolveWorkspaceFileFrame({
        ownerCollaboratorId,
        activeProjectId: currentActiveProjectId,
        fileId
      }))
      .filter((frame): frame is NonNullable<typeof frame> => Boolean(frame));

    const toolInvocation = buildDirectToolInvocation({
      id: toolMessageId,
      action,
      description,
      result,
      projectFileFrames: resultProjectFileFrames,
      options
    });

    if (announceRunning) {
      chat.updateMessage(target, toolMessageId, {
        content: toolInvocation.summary,
        attachments: result.ok ? result.attachments : undefined,
        toolInvocation
      });
    } else {
      addRuntimeToolMessage(
        target,
        toolInvocation,
        result.ok ? result.attachments : undefined,
        { beforeMessageId: options?.insertBeforeMessageId }
      );
    }

    if (!result.ok) {
      local.setCommandStatus(result.error);
    }

    return {
      path: 'direct',
      status: result.ok ? 'executed' : 'failed',
      action,
      toolInvocation,
      projectPreviewRunnable:
        (action.kind === 'checkProjectPreview' || action.kind === 'inspectProjectRuntime') && result.ok
          ? result.projectPreviewRunnable
          : undefined,
      error: result.ok ? undefined : result.error
    };
  };
}
