import type { AssistantPromptPart, AssistantPromptPartLayer, AssistantRequestTruncation } from './requestAudit';
import type { AssistantRequestBudgetBucket, AssistantRequestBudgetPlan } from './requestBudget';
import { estimateTextTokens } from './requestTokenEstimation';

type PromptPartSelectionBucket = Exclude<AssistantRequestBudgetBucket, 'memory' | 'history'>;

function resolvePromptPartBucket(layer: AssistantPromptPartLayer): PromptPartSelectionBucket {
  if (layer === 'identity') return 'identity';
  return 'capability';
}

export function selectPromptPartsForBudget(args: {
  promptParts: AssistantPromptPart[];
  plan: AssistantRequestBudgetPlan;
}): {
  selectedPromptParts: AssistantPromptPart[];
  promptPartDecisions: AssistantRequestTruncation['promptParts'];
} {
  const { promptParts, plan } = args;
  const usageByBucket: Partial<Record<PromptPartSelectionBucket, number>> = {};
  const selectedPromptParts: Array<{ index: number; part: AssistantPromptPart }> = [];
  const promptPartDecisions: Array<AssistantRequestTruncation['promptParts'][number] & { index: number }> = [];
  const indexedParts = promptParts.map((part, index) => ({ part, index }));
  const orderedParts = [...indexedParts].sort((left, right) => {
    if (left.part.truncationPriority !== right.part.truncationPriority) {
      return left.part.truncationPriority - right.part.truncationPriority;
    }
    return left.index - right.index;
  });

  for (const { part, index } of orderedParts) {
    const bucket = resolvePromptPartBucket(part.layer);
    const maxTokens = plan.buckets[bucket].maxTokens;
    const estimatedTokens = estimateTextTokens(part.content);

    if (!part.enabled) {
      promptPartDecisions.push({
        index,
        name: part.name,
        label: part.label,
        layer: part.layer,
        bucket,
        estimatedTokens,
        status: 'disabled'
      });
      continue;
    }

    const usedTokens = usageByBucket[bucket] ?? 0;
    const exceedsBucketBudget = maxTokens !== null && usedTokens + estimatedTokens > maxTokens;

    if (exceedsBucketBudget) {
      promptPartDecisions.push({
        index,
        name: part.name,
        label: part.label,
        layer: part.layer,
        bucket,
        estimatedTokens,
        status: 'dropped_budget'
      });
      continue;
    }

    usageByBucket[bucket] = usedTokens + estimatedTokens;
    selectedPromptParts.push({ index, part });
    promptPartDecisions.push({
      index,
      name: part.name,
      label: part.label,
      layer: part.layer,
      bucket,
      estimatedTokens,
      status: 'kept'
    });
  }

  return {
    selectedPromptParts: selectedPromptParts
      .sort((left, right) => left.index - right.index)
      .map(({ part }) => part),
    promptPartDecisions: promptPartDecisions
      .sort((left, right) => left.index - right.index)
      .map(({ index: _index, ...decision }) => decision)
  };
}
