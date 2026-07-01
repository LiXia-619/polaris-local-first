import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { useSpaceStore } from '../stores/spaceStore';

const IOS_VISUAL_SETTLE_BUFFER_MS = 16;

function vibrateFallback(duration: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(duration);
  }
}

function isNativeIosPlatform() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

function hapticsAreEnabled() {
  return useSpaceStore.getState().displayPreferences.hapticsEnabled;
}

function parseCssTimeToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith('ms')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (trimmed.endsWith('s')) {
    const parsed = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(parsed) ? parsed * 1000 : 0;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCssTimeList(value: string) {
  return value.split(',').map(parseCssTimeToken);
}

function readCssMotionTotalMs(durationsText: string, delaysText: string) {
  const durations = parseCssTimeList(durationsText);
  const delays = parseCssTimeList(delaysText);
  const count = Math.max(durations.length, delays.length);
  let max = 0;

  for (let index = 0; index < count; index += 1) {
    const duration = durations[index] ?? durations[durations.length - 1] ?? 0;
    const delay = delays[index] ?? delays[delays.length - 1] ?? 0;
    max = Math.max(max, duration + delay);
  }

  return max;
}

function resolveHapticElement(target?: EventTarget | null) {
  return target instanceof HTMLElement ? target : null;
}

function readElementVisualSettleMs(element: HTMLElement) {
  const styles = window.getComputedStyle(element);
  const transitionTotal = readCssMotionTotalMs(styles.transitionDuration, styles.transitionDelay);
  const animationTotal = readCssMotionTotalMs(styles.animationDuration, styles.animationDelay);
  return Math.max(transitionTotal, animationTotal);
}

async function waitForVisualSettle(target?: EventTarget | null) {
  if (!isNativeIosPlatform() || typeof window === 'undefined') return;

  const element = resolveHapticElement(target);
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  if (!element || !element.isConnected) return;

  const settleMs = readElementVisualSettleMs(element);
  if (settleMs <= 0) return;

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, settleMs + IOS_VISUAL_SETTLE_BUFFER_MS);
  });
}

type ActionHapticOptions = {
  element?: EventTarget | null;
  settle?: 'visual' | 'none';
  style?: ImpactStyle;
};

export function triggerSelectionActionHaptic(options: ActionHapticOptions = {}) {
  void (async () => {
    if ((options.settle ?? 'none') === 'visual') {
      await waitForVisualSettle(options.element);
    }
    await selectionHaptic();
  })();
}

export function triggerImpactActionHaptic(options: ActionHapticOptions = {}) {
  void (async () => {
    if ((options.settle ?? 'none') === 'visual') {
      await waitForVisualSettle(options.element);
    }
    await impactHaptic(options.style);
  })();
}

export function triggerSuccessActionHaptic(options: ActionHapticOptions = {}) {
  void (async () => {
    if ((options.settle ?? 'none') === 'visual') {
      await waitForVisualSettle(options.element);
    }
    await successHaptic();
  })();
}

export function runSelectionAction<T>(action: () => T, options: ActionHapticOptions = {}) {
  const result = action();
  triggerSelectionActionHaptic(options);
  return result;
}

export function runImpactAction<T>(action: () => T, options: ActionHapticOptions = {}) {
  const result = action();
  triggerImpactActionHaptic(options);
  return result;
}

export async function runSuccessAction<T>(action: () => T | Promise<T>, options: ActionHapticOptions = {}) {
  const result = await action();
  triggerSuccessActionHaptic(options);
  return result;
}

export async function selectionHaptic() {
  if (!hapticsAreEnabled()) return;

  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
      return;
    }
  } catch {
    // fall through to browser vibration
  }

  vibrateFallback(8);
}

export async function impactHaptic(style: ImpactStyle = ImpactStyle.Light) {
  if (!hapticsAreEnabled()) return;

  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
      return;
    }
  } catch {
    // fall through to browser vibration
  }

  vibrateFallback(style === ImpactStyle.Heavy ? 18 : 12);
}

export async function successHaptic() {
  if (!hapticsAreEnabled()) return;

  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    }
  } catch {
    // fall through to browser vibration
  }

  vibrateFallback(20);
}
