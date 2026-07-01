import { describe, expect, it, vi } from 'vitest';
import {
  ensureChatSendPerformanceTrace,
  finishChatSendPerformanceTrace,
  recordChatSendPerformanceMark,
  startChatSendPerformanceTrace
} from './chatSendPerformanceTrace';

const recordAppRuntimeLogEntryMock = vi.hoisted(() => vi.fn());

vi.mock('../../infrastructure/appRuntimeLog', () => ({
  recordAppRuntimeLogEntry: recordAppRuntimeLogEntryMock
}));

describe('chat send performance trace', () => {
  it('records timings and counts without chat content or full conversation ids', () => {
    recordAppRuntimeLogEntryMock.mockClear();

    startChatSendPerformanceTrace('conversation-private-id', {
      conversationCount: 12,
      messageCount: 340,
      attachmentCount: 1,
      hasCardReference: true,
      extra: ['safe marker']
    });
    recordChatSendPerformanceMark('conversation-private-id', '聊天发送 · 请求上下文就绪', {
      messageCount: 341,
      extra: ['cards 2']
    });
    finishChatSendPerformanceTrace('conversation-private-id', 'completed');

    expect(recordAppRuntimeLogEntryMock).toHaveBeenCalledTimes(3);
    const serialized = JSON.stringify(recordAppRuntimeLogEntryMock.mock.calls);
    expect(serialized).toContain('messages 340');
    expect(serialized).toContain('attachments 1');
    expect(serialized).toContain('card yes');
    expect(serialized).toContain('cards 2');
    expect(serialized).not.toContain('conversation-private-id');
  });

  it('does not reuse a finished trace', () => {
    recordAppRuntimeLogEntryMock.mockClear();

    ensureChatSendPerformanceTrace('conversation-finished');
    finishChatSendPerformanceTrace('conversation-finished', 'aborted');
    recordChatSendPerformanceMark('conversation-finished', '聊天发送 · 不应记录');

    expect(recordAppRuntimeLogEntryMock).toHaveBeenCalledTimes(2);
  });
});
