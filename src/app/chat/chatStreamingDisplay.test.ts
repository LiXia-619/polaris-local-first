import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import {
  hasRenderableAssistantStreamingPayload,
  resolveAssistantStreamingChrome,
  resolveChatStreamingPresentation,
  resolveDisplayStreamingState,
  resolveChatGenerationActive,
  resolveChatLiveThinkingVisibility,
  resolveChatMessageLifecycle
} from './chatStreamingDisplay';

function createAssistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    ...overrides
  };
}

describe('resolveChatGenerationActive', () => {
  it('treats stage and live streaming as active generation', () => {
    expect(resolveChatGenerationActive({
      sending: false,
      streaming: { messageId: 'assistant-1', phase: 'stage' }
    })).toBe(true);

    expect(resolveChatGenerationActive({
      sending: false,
      streaming: { messageId: 'assistant-1', phase: 'live' }
    })).toBe(true);
  });

  it('treats settling without sending as inactive generation', () => {
    expect(resolveChatGenerationActive({
      sending: false,
      streaming: { messageId: 'assistant-1', phase: 'settling' }
    })).toBe(false);
  });
});

describe('resolveChatMessageLifecycle', () => {
  it('maps the active streaming message to its lifecycle phase', () => {
    expect(resolveChatMessageLifecycle({
      messageId: 'assistant-1',
      streaming: { messageId: 'assistant-1', phase: 'live' },
      enteringMessageIds: []
    })).toBe('streaming-live');
  });

  it('keeps entering messages distinct from resting ones', () => {
    expect(resolveChatMessageLifecycle({
      messageId: 'assistant-2',
      streaming: null,
      enteringMessageIds: ['assistant-2']
    })).toBe('entering');

    expect(resolveChatMessageLifecycle({
      messageId: 'assistant-3',
      streaming: null,
      enteringMessageIds: ['assistant-2']
    })).toBe('rest');
  });
});

describe('hasRenderableAssistantStreamingPayload', () => {
  it('treats visible prose as renderable payload', () => {
    expect(hasRenderableAssistantStreamingPayload(
      createAssistantMessage({ content: '已经开始说话了' }),
      false
    )).toBe(true);
  });

  it('keeps hidden thinking-only chunks in the streaming prelude', () => {
    expect(hasRenderableAssistantStreamingPayload(
      createAssistantMessage({ thinkingText: '先想一下。' }),
      false
    )).toBe(false);
  });

  it('treats visible thinking as renderable streaming payload', () => {
    expect(hasRenderableAssistantStreamingPayload(
      createAssistantMessage({ thinkingText: '先想一下。' }),
      true
    )).toBe(true);
  });
});

describe('resolveAssistantStreamingChrome', () => {
  it('shows only the star prelude during the stage phase', () => {
    expect(resolveAssistantStreamingChrome({
      message: createAssistantMessage(),
      lifecycle: 'streaming-stage',
      showThinking: false
    })).toEqual({
      showPrelude: true,
      showHint: false,
      showLiveHint: false
    });
  });

  it('keeps the star prelude visible until visible payload exists', () => {
    expect(resolveAssistantStreamingChrome({
      message: createAssistantMessage(),
      lifecycle: 'streaming-live',
      showThinking: false
    })).toEqual({
      showPrelude: true,
      showHint: false,
      showLiveHint: false
    });
  });

  it('renders visible thinking without the continuation hint', () => {
    expect(resolveAssistantStreamingChrome({
      message: createAssistantMessage({ thinkingText: '先想一下。' }),
      lifecycle: 'streaming-live',
      showThinking: true
    })).toEqual({
      showPrelude: false,
      showHint: false,
      showLiveHint: false
    });
  });

  it('moves the generating hint behind the text once payload appears', () => {
    expect(resolveAssistantStreamingChrome({
      message: createAssistantMessage({ content: '第一句话' }),
      lifecycle: 'streaming-live',
      showThinking: false
    })).toEqual({
      showPrelude: false,
      showHint: true,
      showLiveHint: true
    });
  });

  it('drops all streaming chrome once the message is only settling', () => {
    expect(resolveAssistantStreamingChrome({
      message: createAssistantMessage({ content: '收尾中' }),
      lifecycle: 'settling',
      showThinking: false
    })).toEqual({
      showPrelude: false,
      showHint: false,
      showLiveHint: false
    });
  });
});

describe('resolveDisplayStreamingState', () => {
  it('keeps the live streaming message when the runtime state is still attached', () => {
    expect(resolveDisplayStreamingState({
      showThinking: false,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-1', content: '第一句话' })],
      streaming: { messageId: 'assistant-1', phase: 'live' }
    })).toEqual({ messageId: 'assistant-1', phase: 'live' });
  });

  it('reconstructs the active live hint from the latest assistant message while sending', () => {
    expect(resolveDisplayStreamingState({
      showThinking: false,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-2', content: '已经开始续写了' })],
      streaming: null
    })).toEqual({ messageId: 'assistant-2', phase: 'live' });
  });

  it('stays in the star prelude when the latest assistant message is still empty', () => {
    expect(resolveDisplayStreamingState({
      showThinking: false,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-3' })],
      streaming: null
    })).toEqual({ messageId: 'assistant-3', phase: 'stage' });
  });

  it('reconstructs visible thinking-only assistant messages as live', () => {
    expect(resolveDisplayStreamingState({
      showThinking: true,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-thinking', thinkingText: '先想一下。' })],
      streaming: null
    })).toEqual({ messageId: 'assistant-thinking', phase: 'live' });
  });

  it('does not revive an older assistant reply when the latest non-tool message is a user turn', () => {
    expect(resolveDisplayStreamingState({
      showThinking: false,
      sending: true,
      messages: [
        createAssistantMessage({ id: 'assistant-4', content: '上一轮已经结束。' }),
        {
          id: 'user-1',
          role: 'user',
          content: '再来一版',
          timestamp: Date.now()
        }
      ],
      streaming: null
    })).toBeNull();
  });
});

describe('resolveChatLiveThinkingVisibility', () => {
  it('shows global live thinking only before a streaming placeholder exists', () => {
    expect(resolveChatLiveThinkingVisibility({
      showThinking: true,
      sending: true,
      messages: [],
      streaming: null
    })).toBe(true);

    expect(resolveChatLiveThinkingVisibility({
      showThinking: true,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-1' })],
      streaming: { messageId: 'assistant-1', phase: 'stage' }
    })).toBe(false);
  });

  it('keeps the old global fallback hidden when the latest assistant message already carries live copy', () => {
    expect(resolveChatLiveThinkingVisibility({
      showThinking: true,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-5', content: '已经开始说话了' })],
      streaming: null
    })).toBe(false);
  });
});

describe('resolveChatStreamingPresentation', () => {
  it('keeps the global live thinking visible before any placeholder exists', () => {
    expect(resolveChatStreamingPresentation({
      showThinking: true,
      sending: true,
      messages: [],
      streaming: null
    })).toEqual({
      displayStreaming: null,
      showLiveThinking: true
    });
  });

  it('hands visibility over to the placeholder once stage streaming exists', () => {
    expect(resolveChatStreamingPresentation({
      showThinking: true,
      sending: true,
      messages: [createAssistantMessage({ id: 'assistant-stage' })],
      streaming: { messageId: 'assistant-stage', phase: 'stage' }
    })).toEqual({
      displayStreaming: { messageId: 'assistant-stage', phase: 'stage' },
      showLiveThinking: false
    });
  });

  it('keeps settling attached to the message without reviving global live thinking', () => {
    expect(resolveChatStreamingPresentation({
      showThinking: true,
      sending: false,
      messages: [createAssistantMessage({ id: 'assistant-settling', content: '最后一句' })],
      streaming: { messageId: 'assistant-settling', phase: 'settling' }
    })).toEqual({
      displayStreaming: { messageId: 'assistant-settling', phase: 'settling' },
      showLiveThinking: false
    });
  });

  it('stays fully quiet after abort once both sending and streaming drop', () => {
    expect(resolveChatStreamingPresentation({
      showThinking: true,
      sending: false,
      messages: [createAssistantMessage({ id: 'assistant-aborted' })],
      streaming: null
    })).toEqual({
      displayStreaming: null,
      showLiveThinking: false
    });
  });
});
