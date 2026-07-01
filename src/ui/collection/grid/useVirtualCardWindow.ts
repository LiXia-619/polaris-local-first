import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type VirtualCardWindowOptions = {
  itemCount: number;
  estimateRowHeight: number | ((container: HTMLElement, columnCount: number) => number);
  minVirtualItems?: number;
  overscanRows?: number;
};

type VirtualCardMetrics = {
  scrollTop: number;
  viewportHeight: number;
  containerTop: number;
  rowHeight: number;
  columnCount: number;
};

function findScrollParent(element: HTMLElement) {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      overflowY === 'auto'
      || overflowY === 'scroll'
      || current.classList.contains('collection-shelf-page')
      || current.classList.contains('code-collection-view-page-scroll')
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function countGridColumns(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  if (style.display !== 'grid') return 1;
  const columns = style.gridTemplateColumns
    .split(' ')
    .map((column) => column.trim())
    .filter(Boolean);
  return Math.max(1, columns.length);
}

function resolveRowHeight(
  container: HTMLElement,
  columnCount: number,
  estimateRowHeight: VirtualCardWindowOptions['estimateRowHeight']
) {
  if (typeof estimateRowHeight === 'function') {
    return Math.max(1, estimateRowHeight(container, columnCount));
  }
  return Math.max(1, estimateRowHeight);
}

export function useVirtualCardWindow({
  itemCount,
  estimateRowHeight,
  minVirtualItems = 80,
  overscanRows = 6
}: VirtualCardWindowOptions): {
  containerRef: (node: HTMLDivElement | null) => void;
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  virtualized: boolean;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<VirtualCardMetrics>({
    scrollTop: 0,
    viewportHeight: 800,
    containerTop: 0,
    rowHeight: typeof estimateRowHeight === 'number' ? estimateRowHeight : 80,
    columnCount: 1
  });
  const virtualized = itemCount > minVirtualItems;
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !virtualized) return;

    const scrollParent = findScrollParent(container);
    if (!scrollParent) return;

    const measure = () => {
      const scrollRect = scrollParent.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const columnCount = countGridColumns(container);
      const rowHeight = resolveRowHeight(container, columnCount, estimateRowHeight);
      const nextMetrics = {
        scrollTop: scrollParent.scrollTop,
        viewportHeight: scrollParent.clientHeight || window.innerHeight || 800,
        containerTop: containerRect.top - scrollRect.top + scrollParent.scrollTop,
        rowHeight,
        columnCount
      };
      setMetrics((current) => {
        if (
          Math.abs(current.scrollTop - nextMetrics.scrollTop) < 1
          && Math.abs(current.viewportHeight - nextMetrics.viewportHeight) < 1
          && Math.abs(current.containerTop - nextMetrics.containerTop) < 1
          && Math.abs(current.rowHeight - nextMetrics.rowHeight) < 1
          && current.columnCount === nextMetrics.columnCount
        ) {
          return current;
        }
        return nextMetrics;
      });
    };

    measure();
    scrollParent.addEventListener('scroll', measure, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(scrollParent);
    resizeObserver?.observe(container);
    return () => {
      scrollParent.removeEventListener('scroll', measure);
      resizeObserver?.disconnect();
    };
  }, [estimateRowHeight, itemCount, virtualized]);

  return useMemo(() => {
    if (!virtualized) {
      return {
        containerRef: setContainerRef,
        startIndex: 0,
        endIndex: itemCount,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        virtualized: false
      };
    }

    const rowCount = Math.ceil(itemCount / metrics.columnCount);
    const scrollTopWithinContainer = Math.max(0, metrics.scrollTop - metrics.containerTop);
    const startRow = Math.max(0, Math.floor(scrollTopWithinContainer / metrics.rowHeight) - overscanRows);
    const visibleRowCount = Math.ceil(metrics.viewportHeight / metrics.rowHeight) + overscanRows * 2;
    const endRow = Math.min(rowCount, startRow + visibleRowCount);
    const startIndex = Math.min(itemCount, startRow * metrics.columnCount);
    const endIndex = Math.min(itemCount, endRow * metrics.columnCount);

    return {
      containerRef: setContainerRef,
      startIndex,
      endIndex,
      topSpacerHeight: startRow * metrics.rowHeight,
      bottomSpacerHeight: Math.max(0, (rowCount - endRow) * metrics.rowHeight),
      virtualized: true
    };
  }, [
    itemCount,
    metrics.columnCount,
    metrics.containerTop,
    metrics.rowHeight,
    metrics.scrollTop,
    metrics.viewportHeight,
    overscanRows,
    setContainerRef,
    virtualized
  ]);
}
