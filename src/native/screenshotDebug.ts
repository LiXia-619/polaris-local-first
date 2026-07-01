import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export const POLARIS_SCREENSHOT_DEBUG_PULSE_EVENT = 'polaris:screenshot-debug-pulse';

type ScreenshotCapturedEvent = {
  at: number;
};

type ScreenshotDebugPlugin = {
  getStatus: () => Promise<{ supported: boolean }>;
  addListener: (
    eventName: 'captured',
    listenerFunc: (event: ScreenshotCapturedEvent) => void
  ) => Promise<PluginListenerHandle>;
};

const ScreenshotDebug = registerPlugin<ScreenshotDebugPlugin>('ScreenshotDebug');

export function canUseNativeScreenshotDebug() {
  return Capacitor.isNativePlatform()
    && Capacitor.getPlatform() === 'ios'
    && Capacitor.isPluginAvailable('ScreenshotDebug');
}

export function pulseScreenshotDebugOverlay(at = Date.now()) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ScreenshotCapturedEvent>(POLARIS_SCREENSHOT_DEBUG_PULSE_EVENT, {
    detail: { at }
  }));
}

export async function addNativeScreenshotCaptureListener(
  listener: (event: ScreenshotCapturedEvent) => void
) {
  if (!canUseNativeScreenshotDebug()) {
    return {
      remove: async () => {}
    };
  }

  const handle = await ScreenshotDebug.addListener('captured', (event) => {
    listener(event);
  });

  return handle;
}
