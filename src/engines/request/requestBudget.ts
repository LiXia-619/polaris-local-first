export type AssistantRequestBudgetBucket = 'identity' | 'capability' | 'memory' | 'history';

export type AssistantRequestBudgetPlan = {
  totalPromptTokens: number;
  messageLimit: number;
  buckets: Record<AssistantRequestBudgetBucket, {
    maxTokens: number | null;
    truncationPriority: number;
  }>;
};

export type AssistantRequestBudgetUsage = {
  totalEstimatedTokens: number;
  totalPromptTokens: number;
  historyBudgetTokens: number;
  remainingHistoryTokens: number;
  overflowTokens: number;
  preflightStatus: 'within_budget' | 'overflow';
  buckets: Record<AssistantRequestBudgetBucket, {
    estimatedTokens: number;
    maxTokens: number | null;
  }>;
  diagnostics: {
    identityHardCoreTokens: number;
    identitySoftTextureTokens: number;
    toolCapabilityTokens: number;
    themeSnapshotTokens: number;
    focusedStableSnapshotCount: number;
    summarizedStableSnapshotCount: number;
  };
};

const DEFAULT_CONTEXT_TOKEN_BUDGET_FALLBACK = 12_000;

export function resolveRequestBudgetPlan(params: {
  messageLimit: number;
  totalPromptTokens?: number;
}): AssistantRequestBudgetPlan {
  const {
    messageLimit,
    totalPromptTokens
  } = params;

  const resolvedTotalPromptTokens = totalPromptTokens ?? DEFAULT_CONTEXT_TOKEN_BUDGET_FALLBACK;

  return {
    totalPromptTokens: resolvedTotalPromptTokens,
    messageLimit,
    buckets: {
      identity: { maxTokens: null, truncationPriority: 0 },
      capability: { maxTokens: null, truncationPriority: 3 },
      memory: { maxTokens: null, truncationPriority: 2 },
      history: { maxTokens: resolvedTotalPromptTokens, truncationPriority: 1 }
    }
  };
}

export {
  estimatePromptPartsTokens,
  resolveRequestBudgetUsage,
  resolveRequestHistoryBudget
} from './requestBudgetUsage';
