import { describeToolAction, isPreviewableToolAction } from '../../engines/toolExecutorDescribe';
import { resolveThemeActionFrameChange } from '../../engines/themeToolState';
import { createUid } from '../../engines/id';
import { createThemePreviewCoordinator } from '../theme/themeSessionCoordinator';
import type { ChatMessage, ThemePatchLayer } from '../../types/domain';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ToolAction } from '../../engines/toolExecutorTypes';
import { buildThemeHistoryLabel } from './themeHistoryLabel';
import { buildToolCodeWriteDetails } from './chatToolWriteDetails';
import type {
  AddRuntimeToolMessage,
  ChatSpaceThemeSessionPort,
  MemoryActions,
  ToolActionChatState,
  ToolActionDerivedState,
  ToolActionLocalState
} from './chatToolActionTypes';
import { completeConversationTaskForAppliedToolMessage } from './chatTaskSettlement';

type ToolPreviewControllerArgs = {
  local: ToolActionLocalState;
  chat: Pick<
    ToolActionChatState,
    'getConversationTask' | 'setConversationTask' | 'getConversationWritable' | 'updateMessage'
  >;
  space: Pick<
    ChatSpaceThemeSessionPort,
    | 'beginThemePreview'
    | 'commitThemePreview'
    | 'getActiveThemePreview'
    | 'getCurrentThemeFrame'
    | 'rollbackThemePreview'
    | 'saveCurrentSkin'
    | 'themeToolMode'
  >;
  derived: Pick<ToolActionDerivedState, 'activeConversation'>;
  memoryActions: MemoryActions;
  addRuntimeToolMessage: AddRuntimeToolMessage;
};

type ToolPreviewRunResult =
  | { ok: true }
  | { ok: false; error?: string };

function getThemePreviewDetailText(action: ToolAction): string | undefined {
  if (action.kind === 'patchRawCss' || action.kind === 'appendThemeCss' || action.kind === 'insertThemeCss' || action.kind === 'replaceThemeCss') {
    return action.css.trim();
  }
  if (action.kind === 'editThemeCss') return action.newString.trim();
  if (action.kind === 'deleteThemeCss') return action.oldString.trim();
  return undefined;
}

function inferThemePatchLayer(action: ToolAction): ThemePatchLayer | undefined {
  switch (action.kind) {
    case 'applyPreset':
      return 'preset';
    case 'replaceThemeCss':
      return 'custom';
    case 'editThemeCss':
    case 'appendThemeCss':
    case 'insertThemeCss':
    case 'deleteThemeCss':
      return action.layer ?? 'generated';
    case 'applyThemeCoordinates':
    case 'applySurfaceTokens':
    case 'patchRawCss':
      return 'generated';
    default:
      return undefined;
  }
}

function formatPreviewSaveTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp);
}

function buildPreviewSaveName(message: ChatMessage) {
  const tool = message.toolInvocation;
  const baseName =
    tool?.themeIntentLabel?.trim()
    || tool?.historyLabel?.trim()
    || tool?.title?.trim()
    || '主题试穿';
  return `${baseName} · ${formatPreviewSaveTime(Date.now())}`;
}

export function createToolPreviewController({
  local,
  chat,
  space,
  derived,
  memoryActions,
  addRuntimeToolMessage
}: ToolPreviewControllerArgs) {
  const previewCoordinator = createThemePreviewCoordinator({
    getConversationWritable: chat.getConversationWritable,
    updateMessage: chat.updateMessage
  });

  const runPreviewableToolAction = async (
    target: WritableConversationBody,
    action: ToolAction,
    options?: {
      insertBeforeMessageId?: string;
      sourceToolCallId?: string;
    }
  ): Promise<ToolPreviewRunResult> => {
    const conversationId = target.conversationId;
    const description = describeToolAction(action);
    const activePreview = space.getActiveThemePreview();
    const beforeTheme = activePreview?.before ?? space.getCurrentThemeFrame();
    const frameResult = resolveThemeActionFrameChange(
      beforeTheme,
      action,
      action.kind === 'applyPreset'
        ? {
            presetCustomCssMode: 'replace-with-preset'
          }
        : {
            presetCustomCssMode: 'preserve-current'
          }
    );
    if (!frameResult.ok) {
      if (!frameResult.unsupported && frameResult.error) {
        local.setCommandStatus(frameResult.error);
      }
      return { ok: false, error: frameResult.error };
    }

    const previewId = createUid('preview');
    const historyLabel = buildThemeHistoryLabel({
      scope: description.themeScope,
      title: description.title,
      themeIntentLabel: description.themeIntentLabel,
      targetLabel: description.targetLabel
    });
    const detailText = getThemePreviewDetailText(action);
    const previewResult = space.beginThemePreview(
      previewId,
      conversationId,
      frameResult.nextTheme,
      frameResult.generatedCssPatch ?? '',
      {
        id: createUid('theme-patch'),
        previewId,
        conversationId,
        kind: description.kind,
        label: historyLabel,
        summary: description.summary,
        layer: inferThemePatchLayer(action),
        scope: description.themeScope,
        surfaceIds: description.themeSurfaceIds,
        surfaceLabels: description.themeSurfaceLabels,
        patchMode: description.themePatchMode,
        detailText
      }
    );

    addRuntimeToolMessage(target, {
      id: createUid('tool'),
      kind: description.kind,
      status: 'preview',
      title: description.title,
      summary: description.summary,
      previewId,
      themeScope: description.themeScope,
      themeSurfaceIds: description.themeSurfaceIds,
      themeSurfaceLabels: description.themeSurfaceLabels,
      themePatchMode: description.themePatchMode,
      themeTransactionReason: description.themeTransactionReason,
      themeIntentLabel: description.themeIntentLabel,
      themeRecipe: description.themeRecipe,
      historyLabel,
      detailText,
      codeWriteDetails: buildToolCodeWriteDetails(action),
      originMessageId: options?.insertBeforeMessageId,
      toolCallId: options?.sourceToolCallId,
      beforeTheme: previewResult.visibleThemeBeforeStart,
      nextTheme: frameResult.nextTheme,
      presetId: action.kind === 'applyPreset' ? action.presetId : undefined
    }, undefined, { beforeMessageId: options?.insertBeforeMessageId });
    previewCoordinator.finalizeResolvedPreview(activePreview, frameResult.nextTheme, previewId);
    return { ok: true };
  };

  const commitThemePreviewMessage = (target: WritableConversationBody, message: ChatMessage) => {
    if (!derived.activeConversation || !message.toolInvocation) return false;

    const previewId = message.toolInvocation.previewId;
    if (!previewId) return false;
    if (target.conversationId !== derived.activeConversation.id) return false;
    const committed = space.commitThemePreview(previewId);
    if (!committed) return false;
    const didApply = previewCoordinator.applyPreviewFromToolEvent(target, message);
    if (!didApply) return false;

    const currentTask = chat.getConversationTask(derived.activeConversation.id);
    if (currentTask) {
      chat.setConversationTask(
        derived.activeConversation.id,
        completeConversationTaskForAppliedToolMessage({
          currentTask,
          resultMessageId: message.id,
          stage: '已穿上这版换肤',
          summary: '这版试穿已经确认保留。',
          updatedAt: Date.now()
        })
      );
    }
    return true;
  };

  const applyToolPreview = (message: ChatMessage) => {
    if (!derived.activeConversation || !message.toolInvocation) return;
    const target = chat.getConversationWritable(derived.activeConversation.id);
    if (!target) return;
    if (memoryActions.applyMemoryPreview(target, message)) return;
    commitThemePreviewMessage(target, message);
  };

  const saveToolPreview = (message: ChatMessage) => {
    if (!derived.activeConversation || !message.toolInvocation) return;
    if (message.toolInvocation.status !== 'preview') return;
    const target = chat.getConversationWritable(derived.activeConversation.id);
    if (!target) return;
    if (!commitThemePreviewMessage(target, message)) return;
    const savedSkin = space.saveCurrentSkin(buildPreviewSaveName(message));
    local.setCommandStatus(savedSkin ? '已保存到主题。' : '保存主题失败。', !savedSkin);
  };

  const rollbackToolPreview = (message: ChatMessage) => {
    if (!derived.activeConversation || !message.toolInvocation) return;
    const target = chat.getConversationWritable(derived.activeConversation.id);
    if (!target) return;
    if (memoryActions.rollbackMemoryPreview(target, message)) return;

    const previewId = message.toolInvocation.previewId;
    if (!previewId) return;
    const rolledBack = space.rollbackThemePreview(previewId);
    if (!rolledBack) return;
    previewCoordinator.rollbackPreview(target, previewId);
  };

  return {
    isPreviewableToolAction,
    runPreviewableToolAction,
    applyToolPreview,
    saveToolPreview,
    rollbackToolPreview
  };
}
