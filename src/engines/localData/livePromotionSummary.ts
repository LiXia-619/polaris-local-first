import type { LocalDataPromotionReadinessReport } from './promotionReadiness';
import type { LocalDataDomain } from './types';

export const LOCAL_DATA_LIVE_PROMOTION_RESULT_KEY = 'polaris-local-data-live-promotion-last-result';

export type LocalDataLivePromotionDomainSummary = {
  domain: LocalDataDomain;
  promotionReady: boolean;
  status: string;
  reasonCount: number;
  rowCount: number;
  completeRowCount: number;
  nonCompleteRowCount: number;
  remediationCount: number;
};

export type LocalDataLivePromotionCommitSummary = {
  domain: LocalDataDomain;
  version: number;
  committedAt: number;
  commitId: string;
};

export type LocalDataLivePromotionSkippedDomainSummary = {
  domain: LocalDataDomain;
  status: string;
  reasons: string[];
};

export type LocalDataLivePromotionReadinessSummary = {
  canHydrate: boolean;
  canPromote: boolean;
  blockerCount: number;
  warningCount: number;
  domains: LocalDataLivePromotionDomainSummary[];
};

export function summarizeLocalDataPromotionReadiness(
  readiness: LocalDataPromotionReadinessReport
): LocalDataLivePromotionReadinessSummary {
  return {
    canHydrate: readiness.canHydrate,
    canPromote: readiness.canPromote,
    blockerCount: readiness.blockers.length,
    warningCount: readiness.warnings.length,
    domains: readiness.domains.map((entry) => ({
      domain: entry.domain,
      promotionReady: entry.promotionReady,
      status: entry.status,
      reasonCount: entry.reasons.length,
      rowCount: entry.rowCount,
      completeRowCount: entry.completeRowCount,
      nonCompleteRowCount: entry.nonCompleteRowCount,
      remediationCount: entry.remediation.length
    }))
  };
}
