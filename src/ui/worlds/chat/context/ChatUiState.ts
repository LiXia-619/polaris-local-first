import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatStreamingPhase, ChatStreamingState } from '../../../../app/chat/chatStreamingDisplay';
import type { ChatAttachment, ChatMessage, ThemeToolMode } from '../../../../types/domain';

export type { ChatStreamingPhase, ChatStreamingState };

export type ChatCommandStatus = {
  text: string;
  isError: boolean;
} | null;

export type ChatEditingState = {
  messageId: string;
  draft: string;
  attachments: ChatAttachment[];
} | null;

export type ChatConversationGenerationState = {
  sending: boolean;
  streaming: ChatStreamingState;
};

export type ChatSubmitFlightState = {
  id: number;
  kind: 'message';
} | null;

type ConversationGenerationMap = Record<string, ChatConversationGenerationState | undefined>;

function nextGenerationMap(
  current: ConversationGenerationMap,
  conversationId: string,
  patch: Partial<ChatConversationGenerationState>
) {
  const previous = current[conversationId] ?? { sending: false, streaming: null };
  const next = { ...previous, ...patch };
  const nextMap = { ...current };
  if (!next.sending && !next.streaming) {
    delete nextMap[conversationId];
    return nextMap;
  }
  nextMap[conversationId] = next;
  return nextMap;
}

export function useChatUiState() {
  const [commandStatus, setCommandStatusState] = useState<ChatCommandStatus>(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState('');
  const [editing, setEditing] = useState<ChatEditingState>(null);
  const [collapsedThinkingMessageIds, setCollapsedThinkingMessageIds] = useState<string[]>([]);
  const [seenThinkingMessageIds, setSeenThinkingMessageIds] = useState<string[]>([]);
  const [thinkingSummaryMessageId, setThinkingSummaryMessageId] = useState<string | null>(null);
  const [expandedCodeMessageIds, setExpandedCodeMessageIds] = useState<string[]>([]);
  const [generationByConversationId, setGenerationByConversationId] = useState<ConversationGenerationMap>({});
  const [submitFlight, setSubmitFlight] = useState<ChatSubmitFlightState>(null);
  const [scrollToTopRequest, setScrollToTopRequest] = useState(0);
  const [autoScrollTargetMessageId, setAutoScrollTargetMessageId] = useState<string | null>(null);
  const [attachmentPickerOpen, setAttachmentPickerOpen] = useState(false);
  const abortControllerByConversationIdRef = useRef<Record<string, AbortController | null>>({});
  const streamingLifecycleReleaseByConversationIdRef = useRef<Record<string, number | null>>({});
  const imageLibraryPickerRef = useRef<HTMLInputElement>(null);
  const cameraPickerRef = useRef<HTMLInputElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const commandStatusTokenRef = useRef(0);
  const themeToolModeSwitchRef = useRef<{
    from: ThemeToolMode;
    to: ThemeToolMode;
    pendingTurns: number;
  } | null>(null);
  const submitFlightIdRef = useRef(0);
  const submitFlightTimeoutRef = useRef<number | null>(null);

  const setCommandStatus = useCallback((text: string, isError = false) => {
    const normalized = text.trim();
    commandStatusTokenRef.current += 1;
    setCommandStatusState(normalized ? { text: normalized, isError } : null);
  }, []);

  const clearCommandStatus = useCallback(() => {
    commandStatusTokenRef.current += 1;
    setCommandStatusState(null);
  }, []);

  useEffect(() => {
    if (!commandStatus) return;
    const token = commandStatusTokenRef.current;
    const timeoutId = window.setTimeout(() => {
      if (commandStatusTokenRef.current !== token) return;
      setCommandStatusState(null);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [commandStatus]);

  const startEditingMessage = useCallback((message: ChatMessage) => {
    setEditing({
      messageId: message.id,
      draft: message.content,
      attachments: message.attachments ?? []
    });
  }, []);

  const cancelEditingMessage = useCallback(() => {
    setEditing(null);
  }, []);

  const setConversationSending = useCallback((conversationId: string, sending: boolean) => {
    setGenerationByConversationId((current) => nextGenerationMap(current, conversationId, { sending }));
  }, []);

  const setConversationStreaming = useCallback((
    conversationId: string,
    value: ChatStreamingState | ((current: ChatStreamingState) => ChatStreamingState)
  ) => {
    setGenerationByConversationId((current) => {
      const previous = current[conversationId] ?? { sending: false, streaming: null };
      const streaming = typeof value === 'function' ? value(previous.streaming) : value;
      return nextGenerationMap(current, conversationId, { streaming });
    });
  }, []);

  const getConversationGenerationControls = useCallback((conversationId: string) => ({
    abortControllerRef: {
      get current() {
        return abortControllerByConversationIdRef.current[conversationId] ?? null;
      },
      set current(value: AbortController | null) {
        if (value) {
          abortControllerByConversationIdRef.current[conversationId] = value;
        } else {
          delete abortControllerByConversationIdRef.current[conversationId];
        }
      }
    },
    streamingLifecycleReleaseRef: {
      get current() {
        return streamingLifecycleReleaseByConversationIdRef.current[conversationId] ?? null;
      },
      set current(value: number | null) {
        if (value !== null) {
          streamingLifecycleReleaseByConversationIdRef.current[conversationId] = value;
        } else {
          delete streamingLifecycleReleaseByConversationIdRef.current[conversationId];
        }
      }
    },
    setSending: (value: boolean) => setConversationSending(conversationId, value),
    setStreaming: (
      value: ChatStreamingState | ((current: ChatStreamingState) => ChatStreamingState)
    ) => setConversationStreaming(conversationId, value)
  }), [setConversationSending, setConversationStreaming]);

  const cancelAllGenerations = useCallback(() => {
    Object.values(streamingLifecycleReleaseByConversationIdRef.current).forEach((timeoutId) => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    });
    Object.values(abortControllerByConversationIdRef.current).forEach((controller) => {
      controller?.abort();
    });
    streamingLifecycleReleaseByConversationIdRef.current = {};
    abortControllerByConversationIdRef.current = {};
    setGenerationByConversationId({});
  }, []);

  const triggerSubmitFlight = useCallback(() => {
    submitFlightIdRef.current += 1;
    if (submitFlightTimeoutRef.current !== null) {
      window.clearTimeout(submitFlightTimeoutRef.current);
    }
    setSubmitFlight({
      id: submitFlightIdRef.current,
      kind: 'message'
    });
    submitFlightTimeoutRef.current = window.setTimeout(() => {
      submitFlightTimeoutRef.current = null;
      setSubmitFlight(null);
    }, 620);
  }, []);

  useEffect(() => () => {
    if (submitFlightTimeoutRef.current !== null) {
      window.clearTimeout(submitFlightTimeoutRef.current);
      submitFlightTimeoutRef.current = null;
    }
  }, []);

  const sending = Object.values(generationByConversationId).some((generation) => generation?.sending);

  return {
    commandStatus,
    setCommandStatus,
    clearCommandStatus,
    sending,
    conversationSearch,
    setConversationSearch,
    dragActive,
    setDragActive,
    editingConversationId,
    setEditingConversationId,
    conversationTitleDraft,
    setConversationTitleDraft,
    editing,
    setEditing,
    startEditingMessage,
    cancelEditingMessage,
    collapsedThinkingMessageIds,
    setCollapsedThinkingMessageIds,
    seenThinkingMessageIds,
    setSeenThinkingMessageIds,
    thinkingSummaryMessageId,
    setThinkingSummaryMessageId,
    expandedCodeMessageIds,
    setExpandedCodeMessageIds,
    generationByConversationId,
    submitFlight,
    triggerSubmitFlight,
    setConversationSending,
    setConversationStreaming,
    getConversationGenerationControls,
    cancelAllGenerations,
    scrollToTopRequest,
    setScrollToTopRequest,
    autoScrollTargetMessageId,
    setAutoScrollTargetMessageId,
    attachmentPickerOpen,
    setAttachmentPickerOpen,
    imageLibraryPickerRef,
    cameraPickerRef,
    filePickerRef,
    themeToolModeSwitchRef
  };
}

export type ChatUiState = ReturnType<typeof useChatUiState>;
