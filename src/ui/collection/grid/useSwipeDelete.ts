import { useCallback, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

const SWIPE_DELETE_REVEAL = 76;
const SWIPE_DELETE_MAX = 92;
const SWIPE_DELETE_THRESHOLD = 48;
const SWIPE_AXIS_THRESHOLD = 12;
const SWIPE_START_THRESHOLD = 18;
const SWIPE_DIRECTION_LOCK_RATIO = 1.35;

type SwipeDeleteState = {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: number;
  swiping: boolean;
  captured: boolean;
};

function clampSwipeOffset(value: number) {
  return Math.min(0, Math.max(-SWIPE_DELETE_MAX, value));
}

function shouldStartSwipe(deltaX: number, deltaY: number, startOffset: number) {
  const horizontal = Math.abs(deltaX);
  const vertical = Math.abs(deltaY);
  if (startOffset < 0) {
    return horizontal > SWIPE_AXIS_THRESHOLD && horizontal > vertical * 1.2;
  }
  return deltaX < -SWIPE_START_THRESHOLD && horizontal > vertical * SWIPE_DIRECTION_LOCK_RATIO;
}

export function useSwipeDelete(disabled = false) {
  const stateRef = useRef<SwipeDeleteState | null>(null);
  const suppressClickRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const close = useCallback(() => {
    stateRef.current = null;
    setDragging(false);
    setOffset(0);
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (disabled || event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-swipe-delete-ignore="true"]')) return;
    if (offset < 0 && !(event.target as HTMLElement).closest('[data-swipe-delete-action="true"]')) {
      suppressClickRef.current = true;
      close();
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 180);
      return;
    }

    stateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
      swiping: false,
      captured: false
    };
    suppressClickRef.current = false;
  }, [close, disabled, offset]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const state = stateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.swiping) {
      if (Math.abs(deltaY) > SWIPE_AXIS_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
        stateRef.current = null;
        return;
      }
      if (!shouldStartSwipe(deltaX, deltaY, state.startOffset)) return;
      state.swiping = true;
      state.captured = true;
      event.currentTarget.setPointerCapture?.(state.pointerId);
      setDragging(true);
    }

    suppressClickRef.current = true;
    event.preventDefault();
    setOffset(clampSwipeOffset(state.startOffset + deltaX));
  }, []);

  const settleSwipe = useCallback((event: PointerEvent<HTMLElement>) => {
    const state = stateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    if (state.captured) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    stateRef.current = null;
    setDragging(false);
    setOffset((current) => (current <= -SWIPE_DELETE_THRESHOLD ? -SWIPE_DELETE_REVEAL : 0));

    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, []);

  const handleClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    open: offset < 0,
    dragging,
    close,
    style: { '--swipe-delete-offset': `${offset}px` } as CSSProperties,
    swipeProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: settleSwipe,
      onPointerCancel: settleSwipe,
      onClickCapture: handleClickCapture
    }
  };
}
