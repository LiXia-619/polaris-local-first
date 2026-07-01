import { Capacitor } from '@capacitor/core';
import { resolveStableNativeShellHeight } from '../../ui/viewportMetrics';

type NativeShellRuntime = Pick<typeof Capacitor, 'getPlatform' | 'isNativePlatform'>;
type NativeShellViewport = Pick<Window, 'innerHeight'> & {
  screen?: Pick<Screen, 'height'>;
};

function formatAppHeight(value: number) {
  return `${Math.round(value)}px`;
}

export function applyNativeShellBootstrap(
  root: HTMLElement,
  viewport: NativeShellViewport,
  runtime: NativeShellRuntime = Capacitor
) {
  if (!runtime.isNativePlatform()) return false;

  const platform = runtime.getPlatform();
  root.dataset.polarisNative = 'true';
  root.dataset.polarisPlatform = platform;

  if (platform === 'ios') {
    root.dataset.nativeKeyboardOverlay = 'true';
  }

  const appHeight = platform === 'ios'
    ? resolveStableNativeShellHeight(viewport.innerHeight, viewport.screen?.height)
    : viewport.innerHeight;
  if (Number.isFinite(appHeight) && appHeight > 0) {
    root.style.setProperty('--app-height', formatAppHeight(appHeight));
  }

  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  applyNativeShellBootstrap(document.documentElement, window);
}
