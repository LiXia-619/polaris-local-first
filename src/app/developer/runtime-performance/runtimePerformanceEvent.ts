import type { World } from '../../../types/domain';

export type RuntimeHeavySurface =
  | 'menu-sheet'
  | 'provider-sheet'
  | 'persona-builder'
  | 'theme-studio'
  | 'companion-setup';

export type PerformanceScenarioDomSnapshot = {
  totalNodeCount: number;
  conversationCardCount: number;
  visibleConversationCardCount: number;
  codeCardCount: number;
  projectCardCount: number;
  messageNodeCount: number;
  backdropFilterNodeCount: number;
  filterNodeCount: number;
  shadowNodeCount: number;
  animatedNodeCount: number;
  transitionNodeCount: number;
  animationNodeCount: number;
  fixedOrStickyNodeCount: number;
  customThemeStyleNodeCount: number;
  backgroundImageFilter: string | null;
  backgroundImageOpacity: number | null;
  activeWorldClassName: string | null;
  activeTitle: string | null;
  scanMs: number;
};

export type PerformanceScenarioFrameSample = {
  sampleMs: number;
  frameCount: number;
  averageFps: number;
  p95FrameGapMs: number;
  maxFrameGapMs: number;
  slowFrameCount: number;
  droppedFrameCount: number;
  longTasks: {
    count: number;
    totalMs: number;
    maxMs: number;
  };
};

export type PerformanceScenarioInteractionSample = {
  target: string;
  elapsedMs: number;
  activeCardsBefore: number;
  activeCardsAfter: number;
};

export type PerformanceScenarioMeasureResult = {
  measuredAt: number;
  seed: import('../performanceScenarioSeed').PerformanceScenarioSeedResult | null;
  dom: PerformanceScenarioDomSnapshot;
  frameSample: PerformanceScenarioFrameSample;
  interaction: PerformanceScenarioInteractionSample | null;
};

export type RuntimePerformanceEntry =
  | {
      kind: 'world-switch';
      switchId: string;
      at: number;
      stage: 'started' | 'transition' | 'hide' | 'unmount' | 'snapshot';
      fromWorld: World;
      toWorld: World;
      elapsedMs: number;
      renderChat: boolean;
      renderCollection: boolean;
      hideChat: boolean;
      hideCollection: boolean;
      themeTransitionPhase: 'enter' | 'exit' | 'none';
      activeNodeCount?: number;
      inactiveNodeCount?: number;
      inactiveBackdropNodeCount?: number;
      inactiveFilterNodeCount?: number;
    }
  | {
      kind: 'theme-sync';
      syncId: string;
      at: number;
      varsChanged: number;
      rewrittenLayers: Array<'preset' | 'custom' | 'generated'>;
      animated: boolean;
      reasons: string[];
      intervalMs: number | null;
    }
  | {
      kind: 'heavy-surface';
      surface: RuntimeHeavySurface;
      phase: 'requested' | 'fallback' | 'mounted';
      openId: string;
      at: number;
      elapsedMs: number | null;
      sequence: number;
      isFirstOpen: boolean;
    }
  | {
      kind: 'performance-scenario';
      at: number;
      dom: PerformanceScenarioDomSnapshot;
      frameSample: PerformanceScenarioFrameSample;
      interaction: PerformanceScenarioInteractionSample | null;
    };
