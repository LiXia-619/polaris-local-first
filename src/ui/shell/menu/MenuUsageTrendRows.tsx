import type {
  MenuRequestIntentBreakdown,
  MenuRequestTrendEntry
} from '../../../app/shell/menuTokenUsage';
import {
  CacheBreakpointChips,
  CachePrefixBlockChips,
  ShrinkPlanChips,
  formatCacheReportStatus,
  formatDuplicateDelta,
  formatHash,
  formatIntent,
  formatReportedTokens,
  formatRatio,
  formatShrinkSavings,
  formatTime,
  formatTokens,
  formatDelta,
  judgementTone,
  type UsageCopy
} from './MenuUsageRows';
import { useI18n } from '../../../i18n';

function formatUsage(
  inputTokens: number | undefined,
  cachedInputTokens: number | undefined,
  cacheMissInputTokens: number | undefined,
  cacheReportStatus: MenuRequestTrendEntry['recentRequests'][number]['cacheReportStatus'],
  copy: UsageCopy
) {
  const { t } = copy;
  if (cacheReportStatus !== 'reported') {
    return inputTokens && inputTokens > 0
      ? `${t('settings.usage.inputShort')} ${formatTokens(inputTokens, copy)} · ${formatCacheReportStatus(cacheReportStatus, copy)}`
      : formatCacheReportStatus(cacheReportStatus, copy);
  }
  const cached = cachedInputTokens ?? 0;
  const miss = cacheMissInputTokens ?? 0;
  const observed = cached + miss;
  if (observed > 0) {
    return `${formatReportedTokens(cached, copy)} / ${formatReportedTokens(miss, copy)} · ${Math.round((cached / observed) * 100)}%`;
  }
  if (!inputTokens || inputTokens <= 0) return t('settings.usage.cacheReported');
  const cacheRate = Math.round((cached / inputTokens) * 100);
  return `${formatReportedTokens(cached, copy)} / ${t('settings.usage.cacheMissUnreported')} · ${cacheRate}%`;
}

function IntentBreakdownChip({ lane, copy }: { lane: MenuRequestIntentBreakdown; copy: UsageCopy }) {
  return (
    <span>
      {formatIntent(lane.intent, copy)}
      <strong>{formatTokens(lane.estimatedTokens, copy)}</strong>
      <small>{formatDelta(lane.deltaTokens, copy)}</small>
    </span>
  );
}

export function RequestTrendRow({ trend }: { trend: MenuRequestTrendEntry }) {
  const copy = useI18n();
  const { t, formatNumber } = copy;
  const shrinkPlanCount = trend.recentRequests.reduce((total, request) => total + request.shrinkPlanCount, 0);
  const shrinkPlanSavingsTokens = trend.recentRequests.reduce((total, request) => total + request.shrinkPlanSavingsTokens, 0);

  return (
    <details className="usage-trend-row">
      <summary>
        <div className="usage-entry-head">
          <strong>{trend.assistantName}</strong>
          <span>{trend.providerName} · {trend.modelId} · {t('settings.usage.roundCount', { count: formatNumber(trend.requestCount) })}</span>
        </div>
        <div className="usage-trend-stats">
          <span>{t('settings.usage.stableChanged', { count: formatNumber(trend.stableChangedCount) })}</span>
          <span>{t('settings.usage.toolChanged', { count: formatNumber(trend.toolChangedCount) })}</span>
          <span>{t('settings.usage.dynamicChanged', { count: formatNumber(trend.dynamicChangedCount) })}</span>
          <span>{t('settings.usage.cacheShort')} {formatRatio(trend.averageCacheReadRate, copy)}</span>
          <span>{t('settings.usage.duplicateShort')} {formatDuplicateDelta(trend.duplicateInfoDeltaTotal, copy)}</span>
          <span>{t('settings.usage.shrinkShort')} {formatNumber(shrinkPlanCount)} / {formatShrinkSavings(shrinkPlanSavingsTokens, copy)}</span>
        </div>
        <div className="usage-trend-dots">
          {trend.recentRequests.map((request) => (
            <span key={request.requestId} title={`${request.requestId.slice(-8)} · ${formatTime(request.timestamp, copy)}`}>
              <i className={judgementTone(request.stablePrompt)} />
              <i className={judgementTone(request.toolCapabilities)} />
              <i className={judgementTone(request.dynamicContext)} />
            </span>
          ))}
        </div>
      </summary>

      <div className="usage-trend-detail">
        <div className="usage-trend-detail-head">
          <strong>{t('settings.usage.latestStructure')}</strong>
          <span>{t('settings.usage.deltaHint')}</span>
        </div>
        <CacheBreakpointChips breakpoints={trend.latestCacheBreakpoints} />
        <div className="usage-intent-lanes usage-trend-intents">
          {trend.latestIntentBreakdown.map((lane) => (
            <IntentBreakdownChip key={lane.intent} lane={lane} copy={copy} />
          ))}
        </div>
        <CachePrefixBlockChips blocks={trend.latestCachePrefixBlocks} />

        <div className="usage-trend-history">
          {trend.recentRequests.map((request) => {
            const changedIntents = request.changedDynamicIntents.map((intent) => formatIntent(intent, copy)).join(' / ');
            return (
              <div className="usage-trend-history-row" key={request.requestId}>
                <div className="usage-trend-history-head">
                  <strong>{request.requestId.slice(-8)}</strong>
                  <span>{formatTime(request.timestamp, copy)}</span>
                </div>
                <div className="usage-trend-hash-grid">
                  <span className={judgementTone(request.stablePrompt)}>{t('settings.usage.stablePromptShort')} {formatHash(request.fingerprints.stablePrompt)}</span>
                  <span className={judgementTone(request.toolCapabilities)}>{t('settings.usage.toolCapabilitiesShort')} {formatHash(request.fingerprints.toolCapabilities)}</span>
                  <span className={judgementTone(request.dynamicContext)}>{t('settings.usage.dynamicContextShort')} {formatHash(request.fingerprints.dynamicContext)}</span>
                  <span>{t('settings.usage.fullRequestShort')} {formatHash(request.fingerprints.fullRequest)}</span>
                </div>
                <div className="usage-trend-history-meta">
                  <span>{t('settings.usage.hitMiss')} {formatUsage(
                    request.tokenUsage?.inputTokens,
                    request.tokenUsage?.cachedInputTokens,
                    request.tokenUsage?.cacheMissInputTokens,
                    request.cacheReportStatus,
                    copy
                  )}</span>
                  <span>{t('settings.usage.cacheCandidateShort')} {formatNumber(request.cacheEligibleBreakpoints)}</span>
                  <span>{t('settings.usage.duplicateShort')} {formatNumber(request.duplicateInfoCount)} / {formatDuplicateDelta(request.duplicateInfoDelta, copy)}</span>
                  <span>{t('settings.usage.shrinkShort')} {formatNumber(request.shrinkPlanCount)} / {formatShrinkSavings(request.shrinkPlanSavingsTokens, copy)}</span>
                  {changedIntents ? <span>{t('settings.usage.changedDynamic')} {changedIntents}</span> : null}
                </div>
                <CacheBreakpointChips breakpoints={request.cacheBreakpoints} />
                <CachePrefixBlockChips blocks={request.cachePrefixBlocks} />
                <ShrinkPlanChips plans={request.shrinkPlans} />
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}
