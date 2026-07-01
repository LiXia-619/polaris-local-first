import type { RequestDebugEntry } from '../engines/request/requestDebugRuntime';

type RequestDebugOverlayProps = {
  enabled: boolean;
  latestEntry: RequestDebugEntry | null;
  entryCount: number;
  clearEntries: () => void;
  onClose: () => void;
};

function formatTimestamp(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatLayerName(layer: 'identity' | 'capability' | 'context') {
  if (layer === 'identity') return 'id';
  if (layer === 'capability') return 'cap';
  return 'ctx';
}

function formatProjectionMaterialName(kind: RequestDebugEntry['inspector']['projectionMaterials'][number]['kind']) {
  if (kind === 'stable_prefix') return 'stable';
  if (kind === 'dynamic_context') return 'dyn';
  if (kind === 'task_context_projection') return 'task';
  if (kind === 'ui_context_projection') return 'ui';
  if (kind === 'attachment_context_projection') return 'attctx';
  if (kind === 'room_context_projection') return 'room';
  if (kind === 'theme_context_projection') return 'theme';
  if (kind === 'memory_selection') return 'mem';
  if (kind === 'conversation_summary') return 'xsum';
  if (kind === 'semantic_recall_candidate') return 'recall';
  if (kind === 'quote_evidence') return 'quote';
  if (kind === 'reference_directory') return 'ref';
  if (kind === 'history_summary') return 'sum';
  if (kind === 'conversation_history') return 'hist';
  if (kind === 'attachment_reference') return 'att';
  return 'tools';
}

function formatTopographyLane(lane: RequestDebugEntry['inspector']['projectionMaterials'][number]['topography']['lanes'][number]) {
  if (lane === 'hard_rule') return 'rule';
  if (lane === 'persona_default') return 'persona';
  if (lane === 'active_task') return 'task';
  if (lane === 'confirmed_memory') return 'mem';
  if (lane === 'conversation_summary') return 'xsum';
  if (lane === 'retrieved_candidate') return 'cand';
  if (lane === 'quote_evidence') return 'quote';
  if (lane === 'reference_directory') return 'ref';
  if (lane === 'history_summary') return 'sum';
  if (lane === 'raw_tail') return 'raw';
  if (lane === 'tool_schema') return 'tool';
  if (lane === 'runtime_context') return 'runtime';
  if (lane === 'app_context') return 'app';
  return 'debug';
}

function formatHistoryUnitName(kind: RequestDebugEntry['inspector']['historyUnits'][number]['kind']) {
  if (kind === 'user_turn') return 'user';
  if (kind === 'assistant_turn') return 'asst';
  if (kind === 'tool_pair') return 'pair';
  if (kind === 'assistant_tool_call') return 'call';
  if (kind === 'tool_result') return 'tool';
  if (kind === 'orphaned_tool_result') return 'orphan';
  return 'sys';
}

function formatUsageDebugLine(usage: RequestDebugEntry['responseSummary']['tokenUsage']) {
  if (!usage) return 'none';
  const parts = [
    usage.inputTokens ? `in ${usage.inputTokens}` : '',
    usage.outputTokens ? `out ${usage.outputTokens}` : '',
    usage.cachedInputTokens ? `cached ${usage.cachedInputTokens}` : '',
    usage.cacheMissInputTokens ? `miss ${usage.cacheMissInputTokens}` : '',
    usage.cacheCreationInputTokens ? `write ${usage.cacheCreationInputTokens}` : ''
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'reported';
}

function formatShrinkStrategy(strategy: RequestDebugEntry['inspector']['shrinkPlan'][number]['strategy']) {
  if (strategy === 'exact_duplicate') return 'dupe';
  if (strategy === 'directory_pressure') return 'dir';
  return 'compact';
}

function formatShrinkConfidence(confidence: RequestDebugEntry['inspector']['shrinkPlan'][number]['confidence']) {
  if (confidence === 'high') return 'high';
  if (confidence === 'medium') return 'med';
  return 'low';
}

function formatRecallKind(kind: RequestDebugEntry['inspector']['semanticRecall']['byKind'][number]['kind']) {
  if (kind === 'recent_tail') return 'tail';
  if (kind === 'matched_context') return 'match';
  return 'voice';
}

function formatConversationSummaryKind(kind: RequestDebugEntry['inspector']['conversationSummary']['byKind'][number]['kind']) {
  if (kind === 'relational_profile') return 'profile';
  return 'recent';
}

export function RequestDebugOverlay({
  enabled,
  latestEntry,
  entryCount,
  clearEntries,
  onClose
}: RequestDebugOverlayProps) {
  if (!enabled) return null;

  const promptPartCount = latestEntry?.promptParts.length ?? 0;
  const keptPromptPartCount = latestEntry?.inspector.promptParts.filter((part) => part.status === 'kept').length ?? 0;
  const droppedContextCount = latestEntry
    ? latestEntry.inspector.context.droppedHistoryCount + latestEntry.inspector.context.droppedMessageLimitCount
    : 0;
  const totalBudget = latestEntry?.inspector.totals.budgetTokens ?? 0;
  const totalEstimated = latestEntry?.inspector.totals.estimatedTokens ?? 0;
  const historyBudget = latestEntry?.inspector.totals.historyBudgetTokens ?? 0;
  const remainingHistoryTokens = latestEntry?.inspector.totals.remainingHistoryTokens ?? 0;
  const identityHardCoreTokens = latestEntry?.inspector.totals.identityHardCoreTokens ?? 0;
  const identitySoftTextureTokens = latestEntry?.inspector.totals.identitySoftTextureTokens ?? 0;
  const toolCapabilityTokens = latestEntry?.inspector.totals.toolCapabilityTokens ?? 0;
  const themeSnapshotTokens = latestEntry?.inspector.totals.themeSnapshotTokens ?? 0;
  const focusedStableSnapshotCount = latestEntry?.inspector.totals.focusedStableSnapshotCount ?? 0;
  const summarizedStableSnapshotCount = latestEntry?.inspector.totals.summarizedStableSnapshotCount ?? 0;
  const preparationMs = latestEntry?.timings.totalPreparationMs ?? 0;
  const requestId = latestEntry?.requestId?.slice(-8) ?? 'none';
  const cacheApplication = latestEntry?.inspector.cache.requestApplication;
  const cacheBreakpointText = latestEntry?.inspector.cache.breakpoints
    .map((breakpoint) => `${breakpoint.name.replace('_prefix', '')} ${breakpoint.eligible ? 'eligible' : breakpoint.reason ?? 'off'}`)
    .join(' · ');
  const promptLayerSummary = latestEntry?.inspector.promptLayerSummary ?? [];
  const promptLayerText = promptLayerSummary
    .filter((summary) => summary.totalCount > 0)
    .map((summary) => `${formatLayerName(summary.layer)} ${summary.keptCount}/${summary.totalCount}`)
    .join(' · ');
  const droppedPromptText = promptLayerSummary
    .filter((summary) => summary.droppedCount > 0)
    .map((summary) => `${formatLayerName(summary.layer)} ${summary.droppedCount}`)
    .join(' · ');
  const projectionMaterialText = latestEntry?.inspector.projectionMaterials
    .filter((material) => material.itemCount > 0)
    .map((material) => `${formatProjectionMaterialName(material.kind)} ${material.itemCount}`)
    .join(' · ');
  const topographyText = latestEntry?.inspector.projectionMaterials
    .filter((material) => material.itemCount > 0)
    .flatMap((material) => material.topography.lanes)
    .reduce<Record<string, number>>((counts, lane) => {
      const label = formatTopographyLane(lane);
      counts[label] = (counts[label] ?? 0) + 1;
      return counts;
    }, {});
  const topographyLaneText = topographyText
    ? Object.entries(topographyText).map(([lane, count]) => `${lane} ${count}`).join(' · ')
    : '';
  const keptHistoryUnitText = latestEntry?.inspector.historyUnits
    .filter((unit) => unit.status === 'kept')
    .reduce<Record<string, number>>((counts, unit) => {
      const key = formatHistoryUnitName(unit.kind);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  const historyUnitText = keptHistoryUnitText
    ? Object.entries(keptHistoryUnitText).map(([kind, count]) => `${kind} ${count}`).join(' · ')
    : '';
  const topographyOverlapCount = latestEntry?.inspector.topographyOverlap.length ?? 0;
  const topographyOverlapTokens = latestEntry?.inspector.topographyOverlap
    .reduce((total, group) => total + group.estimatedTokens, 0) ?? 0;
  const evidenceOverlapCount = latestEntry?.inspector.topographyEvidenceOverlap.length ?? 0;
  const shrinkPlanCount = latestEntry?.inspector.shrinkPlan.length ?? 0;
  const shrinkPlanSavings = latestEntry?.inspector.shrinkPlan
    .reduce((total, item) => total + item.estimatedSavingsTokens, 0) ?? 0;
  const shrinkPlanDetails = latestEntry?.inspector.shrinkPlan.slice(0, 4) ?? [];
  const recallKindText = latestEntry?.inspector.semanticRecall.byKind
    .map((entry) => `${formatRecallKind(entry.kind)} ${entry.selectedCount}${entry.droppedCount ? `/${entry.droppedCount}` : ''}`)
    .join(' · ') ?? '';
  const recallConfig = latestEntry?.inspector.semanticRecall.config;
  const recallConfigText = recallConfig
    ? `tail ${recallConfig.recentTailConversationCount}x${recallConfig.recentTailUserMessageCount} · voice ${recallConfig.voiceAnchorCount}`
    : 'none';
  const conversationSummaryKindText = latestEntry?.inspector.conversationSummary.byKind
    .map((entry) => `${formatConversationSummaryKind(entry.kind)} ${entry.selectedCount}${entry.expiredCount ? `/${entry.expiredCount}x` : ''}${entry.droppedCount ? `/${entry.droppedCount}` : ''}`)
    .join(' · ') ?? '';
  const outboundRequestBody = latestEntry?.outboundRequest?.body
    ? JSON.stringify(latestEntry.outboundRequest.body, null, 2)
    : null;

  return (
    <aside className="request-debug-overlay">
      <div className="request-debug-header">
        <strong>request debug</strong>
        <div className="request-debug-actions">
          <button type="button" onClick={clearEntries}>clear</button>
          <button type="button" className="debug-overlay-close-button" onClick={onClose} aria-label="关闭 request debug">×</button>
        </div>
      </div>

      {latestEntry ? (
        <>
          <span>{formatTimestamp(latestEntry.at)}</span>
          <span>{`phase ${latestEntry.phase}`}</span>
          <span>{`req ${requestId}`}</span>
          <span>{`${latestEntry.assistantName} · ${latestEntry.modelId}`}</span>
          <span>{`entries ${entryCount}`}</span>
          <span>{`parts ${keptPromptPartCount}/${promptPartCount}`}</span>
          <span>{`layers ${promptLayerText || 'none'}`}</span>
          <span>{`materials ${projectionMaterialText || 'none'}`}</span>
          <span>{`topo ${topographyLaneText || 'none'}`}</span>
          <span>{`overlap ${topographyOverlapCount}${topographyOverlapTokens ? ` · ${topographyOverlapTokens}t` : ''}`}</span>
          <span>{`evidence overlap ${evidenceOverlapCount}`}</span>
          <span>{`shrink ${shrinkPlanCount}${shrinkPlanSavings ? ` · save ${shrinkPlanSavings}t` : ''}`}</span>
          <span>{`part drop ${droppedPromptText || 'none'}`}</span>
          <span>{`budget ${totalEstimated}/${totalBudget}`}</span>
          <span>{`prep ${preparationMs}ms`}</span>
          <span>{`id core ${identityHardCoreTokens} · soft ${identitySoftTextureTokens}`}</span>
          <span>{`tool core ${toolCapabilityTokens} · snap ${themeSnapshotTokens}`}</span>
          <span>{`snap focus ${focusedStableSnapshotCount} · extra ${summarizedStableSnapshotCount}`}</span>
          <span>{`preflight ${latestEntry.inspector.totals.preflightStatus}`}</span>
          <span>{`cache ${cacheApplication?.status ?? 'none'}${cacheApplication?.sendsExplicitCacheControl ? ' · sent' : ''}`}</span>
          <span>{`cache bp ${cacheBreakpointText || 'none'}`}</span>
          <span>{`hist ${historyBudget - remainingHistoryTokens}/${historyBudget}`}</span>
          <span>{`hist mode ${latestEntry.inspector.context.historyMode}`}</span>
          <span>{`hist left ${remainingHistoryTokens}`}</span>
          <span>{`hist units ${historyUnitText || 'none'}`}</span>
          <span>{`memory ${latestEntry.inspector.memory.selectedCount}`}</span>
          <span>{`summary ${latestEntry.inspector.conversationSummary.selectedCount} · ${latestEntry.inspector.conversationSummary.status}`}</span>
          <span>{`summary kind ${conversationSummaryKindText || 'none'}`}</span>
          <span>{`recall ${latestEntry.inspector.semanticRecall.selectedCount} · ${latestEntry.inspector.semanticRecall.status}`}</span>
          <span>{`recall cfg ${recallConfigText}`}</span>
          <span>{`recall kind ${recallKindText || 'none'}`}</span>
          <span>{`ctx drop ${droppedContextCount}`}</span>
          <span>{`tools ${latestEntry.tooling.toolCount}${latestEntry.tooling.toolChoice ? ` · ${latestEntry.tooling.toolChoice}` : ''}`}</span>
          <span>{`tool calls ${latestEntry.responseSummary.nativeToolCallCount}`}</span>
          <span>{`usage ${formatUsageDebugLine(latestEntry.responseSummary.tokenUsage)}`}</span>
          <span>{latestEntry.responseSummary.error ? `error ${latestEntry.responseSummary.error.slice(0, 48)}` : 'error none'}</span>
          <span>{`segments ${latestEntry.contextSummary.segmentKinds.join(' / ')}`}</span>
          {shrinkPlanDetails.length > 0 ? (
            <details className="request-debug-shrink">
              <summary>{`shrink plan · ${shrinkPlanDetails.length}/${shrinkPlanCount}`}</summary>
              {shrinkPlanDetails.map((plan) => (
                <span key={plan.planId}>
                  {`${formatShrinkStrategy(plan.strategy)} · ${formatShrinkConfidence(plan.confidence)} · save ${plan.estimatedSavingsTokens}t · keep ${plan.keepBlockIds.join('/')} · drop ${plan.candidateDropBlockIds.join('/') || 'none'}`}
                </span>
              ))}
            </details>
          ) : null}
          {latestEntry.outboundRequest ? (
            <details className="request-debug-raw">
              <summary>{`outbound ${latestEntry.outboundRequest.provider} · ${latestEntry.outboundRequest.compatibilityMode}`}</summary>
              <span>{latestEntry.outboundRequest.endpoint}</span>
              {outboundRequestBody ? <pre>{outboundRequestBody}</pre> : null}
            </details>
          ) : null}
        </>
      ) : (
        <span>no request captured</span>
      )}
    </aside>
  );
}
