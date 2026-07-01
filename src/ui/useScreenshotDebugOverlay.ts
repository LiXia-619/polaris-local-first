import { useEffect, useState } from 'react';
import {
  addNativeScreenshotCaptureListener,
  POLARIS_SCREENSHOT_DEBUG_PULSE_EVENT
} from '../native/screenshotDebug';

const SCREENSHOT_DEBUG_VISIBLE_MS = 6_000;

type ScreenshotPulseEvent = CustomEvent<{ at: number }>;

export function useScreenshotDebugOverlay(enabled: boolean) {
  const [capturedAt, setCapturedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setCapturedAt(null);
      return;
    }

    let alive = true;
    let hideTimer: number | null = null;

    const show = (at: number) => {
      setCapturedAt(at);
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        if (!alive) return;
        setCapturedAt(null);
        hideTimer = null;
      }, SCREENSHOT_DEBUG_VISIBLE_MS);
    };

    const handlePulse = (event: Event) => {
      const nextAt = (event as ScreenshotPulseEvent).detail?.at ?? Date.now();
      show(nextAt);
    };

    window.addEventListener(POLARIS_SCREENSHOT_DEBUG_PULSE_EVENT, handlePulse as EventListener);

    let nativeHandle: { remove: () => Promise<void> } | null = null;
    void addNativeScreenshotCaptureListener((event) => {
      show(event.at || Date.now());
    }).then((handle) => {
      if (!alive) {
        void handle.remove();
        return;
      }
      nativeHandle = handle;
    });

    return () => {
      alive = false;
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      window.removeEventListener(POLARIS_SCREENSHOT_DEBUG_PULSE_EVENT, handlePulse as EventListener);
      if (nativeHandle) {
        void nativeHandle.remove();
      }
    };
  }, [enabled]);

  return {
    visible: enabled && capturedAt !== null,
    capturedAt
  };
}
