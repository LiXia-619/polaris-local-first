import {
  extractAssistantNativeToolActions,
  extractAssistantToolActions
} from '../../engines/assistantToolProtocol';
import type { AssistantNativeToolCall } from '../../engines/chatApi';
import { stripCodeBlocksFromMessage } from '../../engines/codeCardText';
import type { ChatMessage, ModelTier, ThemeToolMode } from '../../types/domain';
import type { WritableConversationBody } from '../../stores/chatStore';
import { createMessage } from '../../engines/chatMessageFactory';
import {
  buildToolOnlyFallback,
  mergeNativeToolCallDraftCodeIntoVisibleContent,
  mergeToolActionCodeIntoVisibleContent,
  projectToolDraftBlocksAsCode,
  stripToolDraftBlocks
} from './chatReplyContentProjection';
import {
  recoverCreativeCssToolAction,
  recoverTranscriptToolCallActions,
  recoverLooseJsonToolActions,
  recoverTextualToolCallActions
} from '../../engines/tool-protocol/assistantToolActionRecovery';
import { normalizeReplySpacing } from '../../engines/replyText';
import { extractProjectFileDraftActions } from '../../engines/tool-protocol/assistantProjectFileDrafts';
import { parseAssistantTaskUpdate } from '../../engines/conversationTaskUpdateParser';
import type { McpResolvedToolDefinition } from '../../engines/mcpRuntime';

type StartAssistantPlaceholderArgs = {
  writableConversation: WritableConversationBody;
  placeholderId: string;
  assistantName: string;
  speakerCollaboratorId?: string;
  addMessage: (target: WritableConversationBody, message: ChatMessage) => void;
  setStreamingMessageId: (messageId: string) => void;
};

function hasUnclosedToolDraftBlock(content: string) {
  const trimmed = content.trim();
  if (!trimmed.includes('```polaris-tools') && !trimmed.includes('```polaris_tools')) return false;
  return ((trimmed.match(/```/g) ?? []).length % 2) === 1;
}

export function startAssistantPlaceholder({
  writableConversation,
  placeholderId,
  assistantName,
  speakerCollaboratorId,
  addMessage,
  setStreamingMessageId
}: StartAssistantPlaceholderArgs) {
  setStreamingMessageId(placeholderId);
  addMessage(writableConversation, {
    ...createMessage('assistant', '', undefined, 'assistant-reply'),
    id: placeholderId,
    assistantName,
    speakerCollaboratorId
  });
}

export function parseAssistantReplyContent(
  content: string,
  modelTier: ModelTier = 'medium',
  themeToolMode: ThemeToolMode = 'stable',
  phase: 'streaming' | 'final' = 'final',
  nativeToolCalls: AssistantNativeToolCall[] = [],
  ignoredUnknownNativeToolNames: string[] = [],
  options: {
    hasWorkspaceContext?: boolean;
    activeProjectId?: string | null;
    allowCreativeCssRecovery?: boolean;
    mcpTools?: McpResolvedToolDefinition[];
  } = {}
) {
  const taskParsed = parseAssistantTaskUpdate(content);
  const contentWithoutTaskBlock = taskParsed.displayContent;
  const actionParseContext = {
    activeProjectId: options.activeProjectId ?? null,
    mcpTools: options.mcpTools
  };
  const recoveredTranscriptToolCallActions = recoverTranscriptToolCallActions(
    contentWithoutTaskBlock,
    themeToolMode,
    actionParseContext
  );
  const sanitizedContent = recoveredTranscriptToolCallActions?.displayContent ?? contentWithoutTaskBlock;
  const fenceParsed = extractAssistantToolActions(sanitizedContent, modelTier, themeToolMode, actionParseContext);
  const projectDraftParsed = extractProjectFileDraftActions(
    fenceParsed.displayContent || sanitizedContent,
    { preserveDraftBodyInDisplay: phase === 'streaming' }
  );
  const nativeParsed =
    nativeToolCalls.length > 0
      ? extractAssistantNativeToolActions(
          nativeToolCalls,
          projectDraftParsed.displayContent || fenceParsed.displayContent || sanitizedContent,
          themeToolMode,
          ignoredUnknownNativeToolNames,
          actionParseContext
        )
      : null;
  const parsed =
    nativeParsed
      ? {
          displayContent: projectDraftParsed.displayContent,
          actions: [...projectDraftParsed.actions, ...nativeParsed.actions],
          issues: [...projectDraftParsed.issues, ...nativeParsed.issues]
        }
      : {
          displayContent: projectDraftParsed.displayContent,
          actions: [...fenceParsed.actions, ...projectDraftParsed.actions],
          issues: [...fenceParsed.issues, ...projectDraftParsed.issues]
        };
  const recoveredTextualToolCallActions =
    !nativeParsed && parsed.actions.length === 0 && !recoveredTranscriptToolCallActions
      ? recoverTextualToolCallActions(parsed.displayContent, themeToolMode, actionParseContext)
      : null;
  const recoveredLooseJsonActions =
    !nativeParsed && parsed.actions.length === 0 && !recoveredTranscriptToolCallActions && !recoveredTextualToolCallActions
      ? recoverLooseJsonToolActions(parsed.displayContent, themeToolMode, actionParseContext)
      : null;
  const recoveredCreativeCssAction =
    !nativeParsed
      && parsed.actions.length === 0
      && !recoveredTranscriptToolCallActions
      && !recoveredTextualToolCallActions
      && !recoveredLooseJsonActions
      && (!options.hasWorkspaceContext || options.allowCreativeCssRecovery)
      ? recoverCreativeCssToolAction(parsed.displayContent, themeToolMode)
      : null;
  const effectiveTranscriptRecovery =
    !nativeParsed && parsed.actions.length === 0
      ? recoveredTranscriptToolCallActions
      : null;
  const effectiveParsed =
    effectiveTranscriptRecovery
    ?? recoveredTextualToolCallActions
    ?? recoveredLooseJsonActions
    ?? recoveredCreativeCssAction
    ?? parsed;
  const visibleFallback =
    phase === 'streaming'
      ? projectToolDraftBlocksAsCode(sanitizedContent)
      : stripToolDraftBlocks(sanitizedContent);
  const shouldProjectActionCode =
    !(phase === 'streaming' && nativeToolCalls.length > 0);
  const visibleWithCodeProjection = shouldProjectActionCode
    ? mergeToolActionCodeIntoVisibleContent(effectiveParsed.displayContent, effectiveParsed.actions, {
        excludeProjectFileWrites: phase === 'final'
      })
    : normalizeReplySpacing(effectiveParsed.displayContent);
  const shouldProjectNativeDraftCode =
    nativeToolCalls.length > 0
    && (
      phase === 'streaming'
      || effectiveParsed.actions.length === 0
      || effectiveParsed.issues.length > 0
    );
  const visibleWithNativeDraftProjection =
    shouldProjectNativeDraftCode
      ? mergeNativeToolCallDraftCodeIntoVisibleContent(visibleWithCodeProjection, nativeToolCalls)
      : visibleWithCodeProjection;
  const streamingDraftProjection =
    phase === 'streaming' && effectiveParsed.actions.length === 0 && hasUnclosedToolDraftBlock(sanitizedContent)
      ? projectToolDraftBlocksAsCode(sanitizedContent)
      : '';
  const shouldUseStreamingDraftProjection =
    streamingDraftProjection.includes('```')
    && !streamingDraftProjection.includes('```polaris-tools');
  const hasToolDraft = effectiveParsed.actions.length > 0 || nativeToolCalls.length > 0;
  const normalizedBaseNarration = normalizeReplySpacing(
    stripCodeBlocksFromMessage(stripToolDraftBlocks(effectiveParsed.displayContent))
  );
  const normalizedProjectedVisible = normalizeReplySpacing(
    shouldUseStreamingDraftProjection
      ? streamingDraftProjection
      : visibleWithNativeDraftProjection
  );
  const normalizedStreamingFallback = normalizeReplySpacing(visibleFallback || sanitizedContent);
  const isToolOnlyTurn =
    phase === 'final'
    && hasToolDraft
    && !normalizedBaseNarration;
  const visibleContent =
    normalizedProjectedVisible ||
    (
      phase === 'streaming'
        ? normalizedStreamingFallback
        : hasToolDraft
          ? buildToolOnlyFallback(effectiveParsed.actions)
          : normalizedStreamingFallback
    );

  return {
    parsed: effectiveParsed,
    visibleContent,
    isToolOnlyTurn,
    taskUpdate: taskParsed.taskUpdate
  };
}
