import type { ChatMessage } from '../../types/domain';

export type ChatStreamingPhase = 'stage' | 'live' | 'settling';

export type ChatStreamingState = {
  messageId: string;
  phase: ChatStreamingPhase;
} | null;

export type ChatMessageLifecycle = 'entering' | 'streaming-stage' | 'streaming-live' | 'settling' | 'rest';
export type ChatStreamingChrome = {
  showPrelude: boolean;
  showHint: boolean;
  showLiveHint: boolean;
};

export type ChatStreamingPresentation = {
  displayStreaming: ChatStreamingState;
  showLiveThinking: boolean;
};

export function resolveChatGenerationActive(args: {
  sending: boolean;
  streaming: ChatStreamingState;
}) {
  return args.sending || args.streaming?.phase === 'stage' || args.streaming?.phase === 'live';
}

type DisplayStreamingMessage = Pick<ChatMessage, 'id' | 'role' | 'content' | 'thinkingText' | 'toolInvocation'>;

export function resolveDisplayStreamingState(args: {
  showThinking: boolean;
  sending: boolean;
  messages: DisplayStreamingMessage[];
  streaming: ChatStreamingState;
}): ChatStreamingState {
  if (args.streaming) return args.streaming;
  if (!args.sending) return null;

  for (let index = args.messages.length - 1; index >= 0; index -= 1) {
    const message = args.messages[index];
    if (message.toolInvocation) continue;
    if (message.role !== 'assistant') return null;

    return {
      messageId: message.id,
      phase: hasRenderableAssistantStreamingPayload(message, args.showThinking) ? 'live' : 'stage'
    };
  }

  return null;
}

export function resolveChatStreamingPresentation(args: {
  showThinking: boolean;
  sending: boolean;
  messages: DisplayStreamingMessage[];
  streaming: ChatStreamingState;
}): ChatStreamingPresentation {
  const displayStreaming = resolveDisplayStreamingState(args);
  const showLiveThinking =
    args.showThinking
    && args.sending
    && (
      !displayStreaming?.messageId
      || !args.messages.some((message) => message.id === displayStreaming.messageId)
    );

  return {
    displayStreaming,
    showLiveThinking
  };
}

export function resolveChatMessageLifecycle(args: {
  messageId: string;
  streaming: ChatStreamingState;
  enteringMessageIds: readonly string[];
}): ChatMessageLifecycle {
  if (args.streaming?.messageId === args.messageId) {
    if (args.streaming.phase === 'stage') return 'streaming-stage';
    if (args.streaming.phase === 'live') return 'streaming-live';
    if (args.streaming.phase === 'settling') return 'settling';
  }

  if (args.enteringMessageIds.includes(args.messageId)) {
    return 'entering';
  }

  return 'rest';
}

export function hasRenderableAssistantStreamingPayload(
  message: Pick<ChatMessage, 'content' | 'thinkingText'>,
  showThinking: boolean
) {
  if (message.content.trim()) return true;
  if (showThinking && message.thinkingText?.trim()) return true;
  return false;
}

function hasVisibleAssistantReplyText(message: Pick<ChatMessage, 'content'>) {
  return Boolean(message.content.trim());
}

export function resolveAssistantStreamingChrome(args: {
  message: Pick<ChatMessage, 'role' | 'content' | 'thinkingText'>;
  lifecycle: ChatMessageLifecycle;
  showThinking: boolean;
}): ChatStreamingChrome {
  const isAssistantReply = args.message.role === 'assistant';
  const hasRenderableStreamingPayload = hasRenderableAssistantStreamingPayload(args.message, args.showThinking);

  if (!isAssistantReply) {
    return {
      showPrelude: false,
      showHint: false,
      showLiveHint: false
    };
  }

  if (args.lifecycle === 'streaming-stage') {
    return {
      showPrelude: true,
      showHint: false,
      showLiveHint: false
    };
  }

  if (args.lifecycle === 'streaming-live' && !hasRenderableStreamingPayload) {
    return {
      showPrelude: true,
      showHint: false,
      showLiveHint: false
    };
  }

  return {
    showPrelude: false,
    showHint: args.lifecycle === 'streaming-live' && hasVisibleAssistantReplyText(args.message),
    showLiveHint: args.lifecycle === 'streaming-live' && hasVisibleAssistantReplyText(args.message)
  };
}

export function resolveChatLiveThinkingVisibility(args: {
  showThinking: boolean;
  sending: boolean;
  messages: DisplayStreamingMessage[];
  streaming: ChatStreamingState;
}) {
  return resolveChatStreamingPresentation(args).showLiveThinking;
}
