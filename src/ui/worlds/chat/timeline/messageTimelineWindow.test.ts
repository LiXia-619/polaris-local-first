import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../../types/domain';
import { resolveTimelineWindow } from './messageTimelineWindow';
import type { TimelineRenderItem } from './messageTimelineItems';

function buildMessage(index: number, role: ChatMessage['role'] = 'assistant'): ChatMessage {
  return {
    id: `message-${index}`,
    role,
    content: `message ${index}`,
    timestamp: index
  };
}

function buildItem(index: number, role: ChatMessage['role'] = 'assistant'): TimelineRenderItem {
  return {
    message: buildMessage(index, role),
    toolMessages: [],
    messageCycleIndex: index,
    userBubbleIndex: role === 'user' ? index : undefined,
    isAssistantContinuation: false,
    isTerminalAssistantInUserTurn: true
  };
}

describe('resolveTimelineWindow', () => {
  it('keeps short timelines whole', () => {
    const items = Array.from({ length: 32 }, (_, index) => buildItem(index));
    const window = resolveTimelineWindow(items, 'manual', null, {
      scrollTop: 0,
      viewportHeight: 520,
      rowHeights: {}
    });

    expect(window.isWindowed).toBe(false);
    expect(window.visibleItems).toHaveLength(32);
    expect(window.topSpacerHeight).toBe(0);
    expect(window.bottomSpacerHeight).toBe(0);
  });

  it('windows long timelines around the manual viewport', () => {
    const items = Array.from({ length: 96 }, (_, index) => buildItem(index));
    const window = resolveTimelineWindow(items, 'manual', null, {
      scrollTop: 4200,
      viewportHeight: 640,
      rowHeights: {}
    });

    expect(window.isWindowed).toBe(true);
    expect(window.start).toBeGreaterThan(0);
    expect(window.end).toBeLessThan(96);
    expect(window.visibleItems.length).toBeGreaterThan(8);
    expect(window.topSpacerHeight).toBeGreaterThan(0);
    expect(window.bottomSpacerHeight).toBeGreaterThan(0);
  });

  it('keeps the live tail visible while following bottom', () => {
    const items = Array.from({ length: 96 }, (_, index) => buildItem(index));
    const window = resolveTimelineWindow(items, 'bottom', null, {
      scrollTop: 0,
      viewportHeight: 640,
      rowHeights: {}
    });

    expect(window.isWindowed).toBe(true);
    expect(window.end).toBe(96);
    expect(window.visibleItems[window.visibleItems.length - 1]?.message.id).toBe('message-95');
    expect(window.topSpacerHeight).toBeGreaterThan(0);
    expect(window.bottomSpacerHeight).toBe(0);
  });

  it('keeps the reply-stage anchor mounted even when it is outside the viewport range', () => {
    const items = Array.from({ length: 96 }, (_, index) => buildItem(index));
    const window = resolveTimelineWindow(items, 'reply-stage', null, {
      scrollTop: 9000,
      viewportHeight: 640,
      rowHeights: {},
      anchorMessageId: 'message-12'
    });

    expect(window.isWindowed).toBe(true);
    expect(window.visibleItems.some((item) => item.message.id === 'message-12')).toBe(true);
    expect(window.start).toBeLessThanOrEqual(12);
    expect(window.end).toBeGreaterThan(12);
    expect(window.bottomSpacerHeight).toBeGreaterThan(0);
  });
});
