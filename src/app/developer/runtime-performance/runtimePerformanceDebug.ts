import { isDeveloperModeEnabled } from '../developerModeRuntime';
import type { World } from '../../../types/domain';
import type { RuntimeHeavySurface, RuntimePerformanceEntry } from './runtimePerformanceEvent';
import { appendRuntimePerformanceEntry } from './runtimePerformanceStorage';

type WorldSwitchState = {
  switchId: string;
  fromWorld: World;
  toWorld: World;
  startedAt: number;
};

type HeavySurfaceOpenState = {
  openId: string;
  startedAt: number;
  sequence: number;
  isFirstOpen: boolean;
  fallbackLogged: boolean;
};

const heavySurfaceCounts = new Map<RuntimeHeavySurface, number>();
const heavySurfaceOpenState = new Map<RuntimeHeavySurface, HeavySurfaceOpenState>();
let currentWorldSwitchState: WorldSwitchState | null = null;

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function createRuntimeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isRuntimePerformanceDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return isDeveloperModeEnabled() || params.get('debugRuntimePerformance') === '1' || params.get('debugPerf') === '1';
  } catch {
    return isDeveloperModeEnabled();
  }
}

export function startWorldSwitch(args: {
  fromWorld: World;
  toWorld: World;
  renderChat: boolean;
  renderCollection: boolean;
  hideChat: boolean;
  hideCollection: boolean;
}) {
  if (!isRuntimePerformanceDebugEnabled()) return null;
  const switchId = createRuntimeId('world-switch');
  const startedAt = nowMs();
  currentWorldSwitchState = {
    switchId,
    fromWorld: args.fromWorld,
    toWorld: args.toWorld,
    startedAt
  };

  appendRuntimePerformanceEntry({
    kind: 'world-switch',
    switchId,
    at: Date.now(),
    stage: 'started',
    fromWorld: args.fromWorld,
    toWorld: args.toWorld,
    elapsedMs: 0,
    renderChat: args.renderChat,
    renderCollection: args.renderCollection,
    hideChat: args.hideChat,
    hideCollection: args.hideCollection,
    themeTransitionPhase: 'none'
  });

  return switchId;
}

export function recordWorldSwitchStage(args: {
  switchId?: string | null;
  stage: Extract<RuntimePerformanceEntry, { kind: 'world-switch' }>['stage'];
  renderChat: boolean;
  renderCollection: boolean;
  hideChat: boolean;
  hideCollection: boolean;
  themeTransitionPhase?: 'enter' | 'exit' | null;
  activeNodeCount?: number;
  inactiveNodeCount?: number;
  inactiveBackdropNodeCount?: number;
  inactiveFilterNodeCount?: number;
}) {
  if (!isRuntimePerformanceDebugEnabled()) return;
  const current = currentWorldSwitchState;
  const switchId = args.switchId ?? current?.switchId ?? null;
  if (!current || !switchId) return;

  appendRuntimePerformanceEntry({
    kind: 'world-switch',
    switchId,
    at: Date.now(),
    stage: args.stage,
    fromWorld: current.fromWorld,
    toWorld: current.toWorld,
    elapsedMs: Math.round(nowMs() - current.startedAt),
    renderChat: args.renderChat,
    renderCollection: args.renderCollection,
    hideChat: args.hideChat,
    hideCollection: args.hideCollection,
    themeTransitionPhase: args.themeTransitionPhase ?? 'none',
    activeNodeCount: args.activeNodeCount,
    inactiveNodeCount: args.inactiveNodeCount,
    inactiveBackdropNodeCount: args.inactiveBackdropNodeCount,
    inactiveFilterNodeCount: args.inactiveFilterNodeCount
  });

  if (args.stage === 'unmount') {
    currentWorldSwitchState = null;
  }
}

export function annotateCurrentWorldSwitchThemePhase(phase: 'enter' | 'exit' | null, args: {
  renderChat: boolean;
  renderCollection: boolean;
  hideChat: boolean;
  hideCollection: boolean;
}) {
  if (!phase || !currentWorldSwitchState || !isRuntimePerformanceDebugEnabled()) return;
  recordWorldSwitchStage({
    stage: 'transition',
    renderChat: args.renderChat,
    renderCollection: args.renderCollection,
    hideChat: args.hideChat,
    hideCollection: args.hideCollection,
    themeTransitionPhase: phase
  });
}

export function recordThemeSync(args: {
  varsChanged: number;
  rewrittenLayers: Array<'preset' | 'custom' | 'generated'>;
  animated: boolean;
  reasons: string[];
  intervalMs: number | null;
}) {
  if (!isRuntimePerformanceDebugEnabled()) return;
  appendRuntimePerformanceEntry({
    kind: 'theme-sync',
    syncId: createRuntimeId('theme-sync'),
    at: Date.now(),
    varsChanged: args.varsChanged,
    rewrittenLayers: args.rewrittenLayers,
    animated: args.animated,
    reasons: args.reasons,
    intervalMs: args.intervalMs == null ? null : Math.round(args.intervalMs)
  });
}

export function startHeavySurfaceOpen(surface: RuntimeHeavySurface) {
  if (!isRuntimePerformanceDebugEnabled()) return;
  const sequence = (heavySurfaceCounts.get(surface) ?? 0) + 1;
  heavySurfaceCounts.set(surface, sequence);
  const openState: HeavySurfaceOpenState = {
    openId: createRuntimeId(surface),
    startedAt: nowMs(),
    sequence,
    isFirstOpen: sequence === 1,
    fallbackLogged: false
  };
  heavySurfaceOpenState.set(surface, openState);

  appendRuntimePerformanceEntry({
    kind: 'heavy-surface',
    surface,
    phase: 'requested',
    openId: openState.openId,
    at: Date.now(),
    elapsedMs: 0,
    sequence,
    isFirstOpen: openState.isFirstOpen
  });
}

export function recordHeavySurfaceFallback(surface: RuntimeHeavySurface) {
  if (!isRuntimePerformanceDebugEnabled()) return;
  const openState = heavySurfaceOpenState.get(surface);
  if (!openState || openState.fallbackLogged) return;
  openState.fallbackLogged = true;
  heavySurfaceOpenState.set(surface, openState);

  appendRuntimePerformanceEntry({
    kind: 'heavy-surface',
    surface,
    phase: 'fallback',
    openId: openState.openId,
    at: Date.now(),
    elapsedMs: Math.round(nowMs() - openState.startedAt),
    sequence: openState.sequence,
    isFirstOpen: openState.isFirstOpen
  });
}

export function completeHeavySurfaceOpen(surface: RuntimeHeavySurface) {
  if (!isRuntimePerformanceDebugEnabled()) return;
  const openState = heavySurfaceOpenState.get(surface);
  if (!openState) return;

  appendRuntimePerformanceEntry({
    kind: 'heavy-surface',
    surface,
    phase: 'mounted',
    openId: openState.openId,
    at: Date.now(),
    elapsedMs: Math.round(nowMs() - openState.startedAt),
    sequence: openState.sequence,
    isFirstOpen: openState.isFirstOpen
  });
  heavySurfaceOpenState.delete(surface);
}
