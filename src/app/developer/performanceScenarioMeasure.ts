import { appendRuntimePerformanceEntry } from './runtime-performance/runtimePerformanceStorage';
import type {
  PerformanceScenarioDomSnapshot,
  PerformanceScenarioInteractionSample,
  PerformanceScenarioMeasureResult
} from './runtime-performance/runtimePerformanceEvent';
import type { PerformanceScenarioSeedOptions, PerformanceScenarioSeedResult } from './performanceScenarioSeed';

export type PerformanceScenarioMeasureOptions = {
  seed?: boolean | PerformanceScenarioSeedOptions;
  frameSampleMs?: number;
  settleFrames?: number;
  postInteractionSettleMs?: number;
  clickConversationCard?: boolean;
  clickCodeCard?: boolean;
};

type LongTaskSample = {
  count: number;
  totalMs: number;
  maxMs: number;
};

const DEFAULT_FRAME_SAMPLE_MS = 1600;
const DEFAULT_SETTLE_FRAMES = 3;
const DEFAULT_POST_INTERACTION_SETTLE_MS = 420;
const BACKGROUND_ASSET_SETTLE_FRAMES = 18;

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function duration(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(250, Math.round(value));
}

function frameCount(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index] ?? 0;
}

function waitForFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function waitForTimeout(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForFrames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await waitForFrame();
  }
}

async function waitForElement(selector: string, maxFrames: number) {
  for (let index = 0; index < maxFrames; index += 1) {
    if (document.querySelector(selector)) return;
    await waitForFrame();
  }
}

function queryAll(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

function isNodeVisible(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
}

function hasEffectValue(value: string) {
  return value !== '' && value !== 'none';
}

function parseCssTimeMs(value: string) {
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

function maxCssTimeMs(value: string) {
  return Math.max(0, ...value.split(',').map(parseCssTimeMs));
}

function hasActiveTransition(style: CSSStyleDeclaration) {
  return style.transitionProperty !== 'none' && maxCssTimeMs(style.transitionDuration) > 0;
}

function hasActiveAnimation(style: CSSStyleDeclaration) {
  return style.animationName !== 'none' && maxCssTimeMs(style.animationDuration) > 0;
}

function collectDomSnapshot(): PerformanceScenarioDomSnapshot {
  const startedAt = nowMs();
  const allNodes = Array.from(document.body.querySelectorAll<HTMLElement>('*'));
  let backdropFilterNodeCount = 0;
  let filterNodeCount = 0;
  let shadowNodeCount = 0;
  let transitionNodeCount = 0;
  let animationNodeCount = 0;
  let fixedOrStickyNodeCount = 0;

  allNodes.forEach((node) => {
    const style = window.getComputedStyle(node);
    if (hasEffectValue(style.backdropFilter)) backdropFilterNodeCount += 1;
    if (hasEffectValue(style.filter)) filterNodeCount += 1;
    if (hasEffectValue(style.boxShadow)) shadowNodeCount += 1;
    if (hasActiveTransition(style)) transitionNodeCount += 1;
    if (hasActiveAnimation(style)) animationNodeCount += 1;
    if (style.position === 'fixed' || style.position === 'sticky') fixedOrStickyNodeCount += 1;
  });

  const appShell = document.querySelector<HTMLElement>('.app-shell');
  const backgroundImage = document.querySelector<HTMLElement>('.app-shell-background-image');
  const backgroundStyle = backgroundImage ? window.getComputedStyle(backgroundImage) : null;
  const conversationCards = queryAll('.conversation-card');
  const visibleConversationCards = conversationCards.filter(isNodeVisible);

  return {
    totalNodeCount: allNodes.length,
    conversationCardCount: conversationCards.length,
    visibleConversationCardCount: visibleConversationCards.length,
    codeCardCount: document.querySelectorAll('.code-card').length,
    projectCardCount: document.querySelectorAll('.project-cover-card').length,
    messageNodeCount: document.querySelectorAll('.message-turn, .message-row, .bubble, .tool-event').length,
    backdropFilterNodeCount,
    filterNodeCount,
    shadowNodeCount,
    animatedNodeCount: transitionNodeCount + animationNodeCount,
    transitionNodeCount,
    animationNodeCount,
    fixedOrStickyNodeCount,
    customThemeStyleNodeCount: document.querySelectorAll('style[data-polaris="custom"]').length,
    backgroundImageFilter: backgroundStyle?.filter ?? null,
    backgroundImageOpacity: backgroundStyle ? Number.parseFloat(backgroundStyle.opacity) : null,
    activeWorldClassName: appShell?.className ?? null,
    activeTitle: document.querySelector<HTMLElement>('.brand h1, .collection-title, h1')?.innerText.trim() ?? null,
    scanMs: round(nowMs() - startedAt)
  };
}

function createLongTaskObserver(samples: PerformanceEntry[]) {
  if (typeof PerformanceObserver === 'undefined') return null;
  const supported = PerformanceObserver.supportedEntryTypes;
  if (!supported.includes('longtask')) return null;

  const observer = new PerformanceObserver((list) => {
    samples.push(...list.getEntries());
  });
  observer.observe({ entryTypes: ['longtask'] });
  return observer;
}

async function sampleFrames(sampleMs: number) {
  const longTaskEntries: PerformanceEntry[] = [];
  const observer = createLongTaskObserver(longTaskEntries);
  const frameGaps: number[] = [];
  const startedAt = nowMs();
  let previousFrameAt = startedAt;

  await new Promise<void>((resolve) => {
    const tick = (frameAt: number) => {
      frameGaps.push(frameAt - previousFrameAt);
      previousFrameAt = frameAt;

      if (nowMs() - startedAt >= sampleMs) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  observer?.disconnect();

  const actualSampleMs = nowMs() - startedAt;
  const totalLongTaskMs = longTaskEntries.reduce((total, entry) => total + entry.duration, 0);
  const longTasks: LongTaskSample = {
    count: longTaskEntries.length,
    totalMs: round(totalLongTaskMs),
    maxMs: round(longTaskEntries.reduce((max, entry) => Math.max(max, entry.duration), 0))
  };

  return {
    sampleMs: Math.round(actualSampleMs),
    frameCount: frameGaps.length,
    averageFps: round((frameGaps.length / actualSampleMs) * 1000),
    p95FrameGapMs: round(percentile(frameGaps, 0.95)),
    maxFrameGapMs: round(frameGaps.reduce((max, gap) => Math.max(max, gap), 0)),
    slowFrameCount: frameGaps.filter((gap) => gap > 32).length,
    droppedFrameCount: frameGaps.filter((gap) => gap > 50).length,
    longTasks
  };
}

async function clickConversationCard(enabled: boolean): Promise<PerformanceScenarioInteractionSample | null> {
  if (!enabled) return null;
  const target = document.querySelector<HTMLElement>('.conversation-card .conversation-card-main');
  if (!target) return null;

  const beforeActiveCards = document.querySelectorAll('.conversation-card.active').length;
  const startedAt = nowMs();
  target.click();
  await waitForFrames(2);

  return {
    target: '.conversation-card-main',
    elapsedMs: round(nowMs() - startedAt),
    activeCardsBefore: beforeActiveCards,
    activeCardsAfter: document.querySelectorAll('.conversation-card.active').length
  };
}

async function clickCodeCard(enabled: boolean): Promise<PerformanceScenarioInteractionSample | null> {
  if (!enabled) return null;
  const target = document.querySelector<HTMLElement>('.code-card .code-card-main');
  if (!target) return null;

  const beforeActiveCards = document.querySelectorAll('.code-card.active').length;
  const startedAt = nowMs();
  target.click();
  await waitForFrames(2);

  return {
    target: '.code-card-main',
    elapsedMs: round(nowMs() - startedAt),
    activeCardsBefore: beforeActiveCards,
    activeCardsAfter: document.querySelectorAll('.code-card.active').length
  };
}

async function maybeSeedScenario(seed: PerformanceScenarioMeasureOptions['seed']) {
  if (!seed) return null;
  const { seedPerformanceScenario } = await import('./performanceScenarioSeed');
  return seedPerformanceScenario(seed === true ? undefined : seed);
}

export async function measurePerformanceScenario(
  options: PerformanceScenarioMeasureOptions = {}
): Promise<PerformanceScenarioMeasureResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Performance scenario measurement requires a browser window.');
  }

  const seedResult = await maybeSeedScenario(options.seed);
  await waitForFrames(frameCount(options.settleFrames, DEFAULT_SETTLE_FRAMES));
  if (seedResult?.backgroundAssetId) {
    await waitForElement('.app-shell-background-image', BACKGROUND_ASSET_SETTLE_FRAMES);
  }

  const dom = collectDomSnapshot();
  const frameSample = await sampleFrames(duration(options.frameSampleMs, DEFAULT_FRAME_SAMPLE_MS));
  const interaction = options.clickCodeCard
    ? await clickCodeCard(true)
    : await clickConversationCard(options.clickConversationCard ?? true);
  if (interaction) {
    await waitForTimeout(duration(options.postInteractionSettleMs, DEFAULT_POST_INTERACTION_SETTLE_MS));
  }

  const result: PerformanceScenarioMeasureResult = {
    measuredAt: Date.now(),
    seed: seedResult as PerformanceScenarioSeedResult | null,
    dom,
    frameSample,
    interaction
  };

  appendRuntimePerformanceEntry({
    kind: 'performance-scenario',
    at: result.measuredAt,
    dom,
    frameSample,
    interaction
  });

  return result;
}
