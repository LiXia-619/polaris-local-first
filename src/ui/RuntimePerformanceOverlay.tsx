import type { RuntimePerformanceEntry } from '../app/developer/runtime-performance/runtimePerformanceEvent';

type RuntimePerformanceOverlayProps = {
  enabled: boolean;
  latestEntry: RuntimePerformanceEntry | null;
  entryCount: number;
  clearEntries: () => void;
};

function formatTimestamp(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function renderWorldSwitch(entry: Extract<RuntimePerformanceEntry, { kind: 'world-switch' }>) {
  return (
    <>
      <span>{`${entry.fromWorld} -> ${entry.toWorld}`}</span>
      <span>{`stage ${entry.stage} · ${entry.elapsedMs}ms`}</span>
      <span>{`render chat ${Number(entry.renderChat)} · col ${Number(entry.renderCollection)}`}</span>
      <span>{`hide chat ${Number(entry.hideChat)} · col ${Number(entry.hideCollection)}`}</span>
      <span>{`veil ${entry.themeTransitionPhase}`}</span>
      <span>{`nodes active ${entry.activeNodeCount ?? 0} · inactive ${entry.inactiveNodeCount ?? 0}`}</span>
      <span>{`inactive fx ${entry.inactiveBackdropNodeCount ?? 0}/${entry.inactiveFilterNodeCount ?? 0}`}</span>
    </>
  );
}

function renderThemeSync(entry: Extract<RuntimePerformanceEntry, { kind: 'theme-sync' }>) {
  return (
    <>
      <span>{`vars ${entry.varsChanged} · layers ${entry.rewrittenLayers.join('/') || 'none'}`}</span>
      <span>{`animate ${entry.animated ? 'yes' : 'no'} · gap ${entry.intervalMs ?? 'n/a'}ms`}</span>
      <span>{`reason ${entry.reasons.join(' · ') || 'signature'}`}</span>
    </>
  );
}

function renderHeavySurface(entry: Extract<RuntimePerformanceEntry, { kind: 'heavy-surface' }>) {
  return (
    <>
      <span>{`${entry.surface} · ${entry.phase}`}</span>
      <span>{`seq ${entry.sequence} · first ${entry.isFirstOpen ? 'yes' : 'no'}`}</span>
      <span>{`elapsed ${entry.elapsedMs ?? 0}ms`}</span>
    </>
  );
}

function renderPerformanceScenario(entry: Extract<RuntimePerformanceEntry, { kind: 'performance-scenario' }>) {
  return (
    <>
      <span>{`cards ${entry.dom.conversationCardCount} · visible ${entry.dom.visibleConversationCardCount}`}</span>
      <span>{`nodes ${entry.dom.totalNodeCount} · scan ${entry.dom.scanMs}ms`}</span>
      <span>{`fx backdrop ${entry.dom.backdropFilterNodeCount} · shadow ${entry.dom.shadowNodeCount}`}</span>
      <span>{`motion ${entry.dom.animatedNodeCount} · t/a ${entry.dom.transitionNodeCount}/${entry.dom.animationNodeCount}`}</span>
      <span>{`bg ${entry.dom.backgroundImageFilter ?? 'none'} · opacity ${entry.dom.backgroundImageOpacity ?? 'n/a'}`}</span>
      <span>{`fps ${entry.frameSample.averageFps} · p95 ${entry.frameSample.p95FrameGapMs}ms`}</span>
      <span>{`slow ${entry.frameSample.slowFrameCount} · dropped ${entry.frameSample.droppedFrameCount}`}</span>
      <span>{`long tasks ${entry.frameSample.longTasks.count} · ${entry.frameSample.longTasks.totalMs}ms`}</span>
      <span>{`click ${entry.interaction?.elapsedMs ?? 0}ms`}</span>
    </>
  );
}

export function RuntimePerformanceOverlay({
  enabled,
  latestEntry,
  entryCount,
  clearEntries
}: RuntimePerformanceOverlayProps) {
  if (!enabled) return null;

  return (
    <aside className="runtime-performance-overlay">
      <div className="runtime-performance-header">
        <strong>runtime perf</strong>
        <button type="button" onClick={clearEntries}>clear</button>
      </div>
      {latestEntry ? (
        <>
          <span>{formatTimestamp(latestEntry.at)}</span>
          <span>{`kind ${latestEntry.kind}`}</span>
          <span>{`entries ${entryCount}`}</span>
          {latestEntry.kind === 'world-switch' ? renderWorldSwitch(latestEntry) : null}
          {latestEntry.kind === 'theme-sync' ? renderThemeSync(latestEntry) : null}
          {latestEntry.kind === 'heavy-surface' ? renderHeavySurface(latestEntry) : null}
          {latestEntry.kind === 'performance-scenario' ? renderPerformanceScenario(latestEntry) : null}
        </>
      ) : (
        <span>no runtime samples</span>
      )}
    </aside>
  );
}
