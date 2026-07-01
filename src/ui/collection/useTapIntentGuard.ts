import { useRef } from 'react';

const MOVE_THRESHOLD_PX = 8;

type PointerLikeEvent = {
  clientX: number;
  clientY: number;
  pointerId: number;
};

export function useTapIntentGuard() {
  const pointerStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    moved: boolean;
    suppressClick: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClick: false
  });

  const handlePointerDown = (event: PointerLikeEvent) => {
    pointerStateRef.current.pointerId = event.pointerId;
    pointerStateRef.current.startX = event.clientX;
    pointerStateRef.current.startY = event.clientY;
    pointerStateRef.current.moved = false;
    pointerStateRef.current.suppressClick = false;
  };

  const handlePointerMove = (event: PointerLikeEvent) => {
    if (pointerStateRef.current.pointerId !== event.pointerId) return;
    if (pointerStateRef.current.moved) return;
    const deltaX = event.clientX - pointerStateRef.current.startX;
    const deltaY = event.clientY - pointerStateRef.current.startY;
    if (Math.hypot(deltaX, deltaY) < MOVE_THRESHOLD_PX) return;
    pointerStateRef.current.moved = true;
    pointerStateRef.current.suppressClick = true;
  };

  const handlePointerEnd = (event: PointerLikeEvent) => {
    if (pointerStateRef.current.pointerId !== event.pointerId) return;
    pointerStateRef.current.pointerId = null;
  };

  const shouldAllowTap = () => {
    if (!pointerStateRef.current.suppressClick) return true;
    pointerStateRef.current.suppressClick = false;
    pointerStateRef.current.moved = false;
    return false;
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    shouldAllowTap
  };
}
