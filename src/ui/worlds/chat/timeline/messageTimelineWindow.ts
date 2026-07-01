import type { TimelineRenderItem } from './messageTimelineItems';
import type { FollowMode } from './TimelineScroll';

const TIMELINE_WINDOW_MIN_ITEMS = 80;
const TIMELINE_WINDOW_OVERSCAN_PX = 900;
const DEFAULT_TIMELINE_ROW_HEIGHT = 168;
const TIMELINE_ROW_GAP = 18;
const ANCHOR_OVERSCAN_ITEMS = 12;

export type TimelineWindow = {
  visibleItems: TimelineRenderItem[];
  start: number;
  end: number;
  isWindowed: boolean;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
};

export type TimelineWindowMetrics = {
  scrollTop: number;
  viewportHeight: number;
  rowHeights: Record<string, number>;
  anchorMessageId?: string | null;
};

function rowHeightForItem(
  item: TimelineRenderItem,
  rowHeights: Record<string, number>,
  fallbackHeight: number
) {
  return Math.max(1, rowHeights[item.message.id] ?? fallbackHeight) + TIMELINE_ROW_GAP;
}

function resolveMeasuredFallbackHeight(rowHeights: Record<string, number>) {
  const heights = Object.values(rowHeights).filter((height) => Number.isFinite(height) && height > 0);
  if (heights.length === 0) return DEFAULT_TIMELINE_ROW_HEIGHT;
  const average = heights.reduce((sum, height) => sum + height, 0) / heights.length;
  return Math.max(64, Math.min(420, average));
}

function sumHeights(heights: number[], start: number, end: number) {
  let total = 0;
  for (let index = start; index < end; index += 1) {
    total += heights[index] ?? 0;
  }
  return total;
}

export function resolveTimelineWindow(
  items: TimelineRenderItem[],
  followMode: FollowMode,
  focusedMessageId: string | null,
  metrics?: TimelineWindowMetrics
): TimelineWindow {
  if (
    items.length <= TIMELINE_WINDOW_MIN_ITEMS
    || !metrics
    || metrics.viewportHeight <= 0
  ) {
    return {
      visibleItems: items,
      start: 0,
      end: items.length,
      isWindowed: false,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0
    };
  }

  const fallbackHeight = resolveMeasuredFallbackHeight(metrics.rowHeights);
  const heights = items.map((item) => rowHeightForItem(item, metrics.rowHeights, fallbackHeight));
  const visibleTop = Math.max(0, metrics.scrollTop - TIMELINE_WINDOW_OVERSCAN_PX);
  const visibleBottom = metrics.scrollTop + metrics.viewportHeight + TIMELINE_WINDOW_OVERSCAN_PX;
  let start = 0;
  let offset = 0;

  while (start < items.length && offset + (heights[start] ?? 0) < visibleTop) {
    offset += heights[start] ?? 0;
    start += 1;
  }

  let end = start;
  let bottomOffset = offset;
  while (end < items.length && bottomOffset < visibleBottom) {
    bottomOffset += heights[end] ?? 0;
    end += 1;
  }

  if (followMode === 'bottom') {
    end = Math.max(end, items.length);
    start = Math.max(start, Math.max(0, items.length - 48));
  }

  const anchorMessageId = focusedMessageId ?? metrics.anchorMessageId ?? null;
  if (anchorMessageId) {
    const anchorIndex = items.findIndex((item) => item.message.id === anchorMessageId);
    if (anchorIndex >= 0) {
      start = Math.min(start, Math.max(0, anchorIndex - ANCHOR_OVERSCAN_ITEMS));
      end = Math.max(end, Math.min(items.length, anchorIndex + ANCHOR_OVERSCAN_ITEMS + 1));
    }
  }

  start = Math.max(0, Math.min(start, items.length));
  end = Math.max(start, Math.min(end, items.length));

  return {
    visibleItems: items.slice(start, end),
    start,
    end,
    isWindowed: start > 0 || end < items.length,
    topSpacerHeight: sumHeights(heights, 0, start),
    bottomSpacerHeight: sumHeights(heights, end, items.length)
  };
}
