import type { AssistantToolContext } from '../assistantToolProtocol';
import type { AssistantPromptPart } from './requestAudit';
import type { AssistantRequestContext } from './requestContext';
import type { AssistantRequestMemoryPlan } from './requestMemoryPlan';
import type {
  AssistantRequestBudgetPlan,
  AssistantRequestBudgetUsage
} from './requestBudget';
import {
  estimateAssistantMessageContentTokens,
  estimateAssistantContextTokens,
  estimateConversationMessageTokens,
  estimateTextTokens
} from './requestTokenEstimation';
import type { RequestMessage } from './requestMessage';

function estimateStableThemeSnapshotTokens(toolContext?: AssistantToolContext) {
  const snapshotTokenText = (snapshot: {
    surfaceCode: string;
    surfaceLabel: string;
    currentSpec: {
      hue: number;
      saturation: number;
      lightness: number;
      opacity: number;
      radius: number;
      borderW: number;
      blur: number;
      shadowDepth: number;
      texture: string;
      gradientMode: string;
      gradientAngle: number;
      accentHue: number;
    };
  }) => [
    snapshot.surfaceCode,
    snapshot.surfaceLabel,
    snapshot.currentSpec.hue,
    snapshot.currentSpec.saturation,
    snapshot.currentSpec.lightness,
    snapshot.currentSpec.opacity,
    snapshot.currentSpec.radius,
    snapshot.currentSpec.borderW,
    snapshot.currentSpec.blur,
    snapshot.currentSpec.shadowDepth,
    snapshot.currentSpec.texture,
    snapshot.currentSpec.gradientMode,
    snapshot.currentSpec.gradientAngle,
    snapshot.currentSpec.accentHue
  ].join(' ');
  const focusedSnapshotTokens = toolContext?.focusedSurfaceSnapshot
    ? estimateTextTokens(snapshotTokenText(toolContext.focusedSurfaceSnapshot))
    : 0;
  const relatedSnapshotTokens = (toolContext?.stableSurfaceSnapshots ?? []).reduce(
    (total, snapshot) => total + estimateTextTokens(snapshotTokenText(snapshot)),
    0
  );
  const summaryTokens = toolContext?.stableSurfaceSnapshotSummary
    ? estimateTextTokens([
        toolContext.stableSurfaceSnapshotSummary.focusSource,
        toolContext.stableSurfaceSnapshotSummary.includedSurfaceCodes.join(' '),
        toolContext.stableSurfaceSnapshotSummary.summarizedSurfaceCodes.join(' ')
      ].join(' '))
    : 0;

  return focusedSnapshotTokens + relatedSnapshotTokens + summaryTokens;
}

function estimateLayerTokens(promptParts: AssistantPromptPart[], layer: AssistantPromptPart['layer']) {
  return promptParts
    .filter((part) => part.enabled && part.layer === layer)
    .reduce((total, part) => total + estimateTextTokens(part.content), 0);
}

function estimatePromptPartNameTokens(
  promptParts: AssistantPromptPart[],
  names: AssistantPromptPart['name'][]
) {
  return promptParts
    .filter((part) => part.enabled && names.includes(part.name))
    .reduce((total, part) => total + estimateTextTokens(part.content), 0);
}

export function estimatePromptPartsTokens(promptParts: AssistantPromptPart[]): number {
  return promptParts
    .filter((part) => part.enabled)
    .reduce((total, part) => total + estimateTextTokens(part.content), 0);
}

export function resolveRequestHistoryBudget(args: {
  plan: AssistantRequestBudgetPlan;
  promptParts: AssistantPromptPart[];
  memoryPlan: AssistantRequestMemoryPlan;
}): number {
  const promptTokens = estimatePromptPartsTokens(args.promptParts);
  const reservedTokens = promptTokens + args.memoryPlan.estimatedTokens;
  const totalRemaining = Math.max(0, args.plan.totalPromptTokens - reservedTokens);
  const bucketMax = args.plan.buckets.history.maxTokens;
  if (bucketMax === null) return totalRemaining;
  return Math.max(0, Math.min(bucketMax, totalRemaining));
}

export function resolveRequestBudgetUsage(args: {
  plan: AssistantRequestBudgetPlan;
  promptParts: AssistantPromptPart[];
  memoryPlan: AssistantRequestMemoryPlan;
  conversation: RequestMessage[];
  context: AssistantRequestContext;
  toolContext?: AssistantToolContext;
}): AssistantRequestBudgetUsage {
  const { plan, promptParts, memoryPlan, conversation, context, toolContext } = args;
  const identityTokens = estimateLayerTokens(promptParts, 'identity');
  const capabilityTokens = estimateLayerTokens(promptParts, 'capability');
  const conversationTokens = conversation.reduce((total, message) => total + estimateConversationMessageTokens(message), 0);
  const historySummaryTokens = context.segments
    .filter((segment) => segment.kind === 'history_summary')
    .reduce(
      (segmentTotal, segment) =>
        segmentTotal + segment.messages.reduce(
          (messageTotal, message) => messageTotal + estimateAssistantMessageContentTokens(message.content),
          0
        ),
      0
    );
  const historyTokens = conversationTokens + historySummaryTokens;
  const historyBudgetTokens = resolveRequestHistoryBudget({
    plan,
    promptParts,
    memoryPlan
  });
  const remainingHistoryTokens = Math.max(0, historyBudgetTokens - historyTokens);
  const totalEstimatedTokens = estimateAssistantContextTokens(context);
  const overflowTokens = Math.max(0, totalEstimatedTokens - plan.totalPromptTokens);

  return {
    totalEstimatedTokens,
    totalPromptTokens: plan.totalPromptTokens,
    historyBudgetTokens,
    remainingHistoryTokens,
    overflowTokens,
    preflightStatus: overflowTokens > 0 ? 'overflow' : 'within_budget',
    buckets: {
      identity: {
        estimatedTokens: identityTokens,
        maxTokens: plan.buckets.identity.maxTokens
      },
      capability: {
        estimatedTokens: capabilityTokens,
        maxTokens: plan.buckets.capability.maxTokens
      },
      memory: {
        estimatedTokens: memoryPlan.estimatedTokens,
        maxTokens: plan.buckets.memory.maxTokens
      },
      history: {
        estimatedTokens: historyTokens,
        maxTokens: historyBudgetTokens
      }
    },
    diagnostics: {
      identityHardCoreTokens: estimatePromptPartNameTokens(promptParts, ['system_identity', 'persona_identity', 'persona_identity_core']),
      identitySoftTextureTokens: estimatePromptPartNameTokens(promptParts, ['persona_identity_motive', 'persona_identity_style']),
      toolCapabilityTokens: estimatePromptPartNameTokens(promptParts, [
        'tool_capability',
        'tool_catalog_capability',
        'tool_protocol_capability',
        'workspace_write_capability',
        'tool_rules_capability',
        'tool_context_capability',
        'ui_context_capability',
        'attachment_context_capability',
        'room_context_capability',
        'theme_context_capability',
        'reply_markup_capability'
      ]),
      themeSnapshotTokens: estimateStableThemeSnapshotTokens(toolContext),
      focusedStableSnapshotCount: toolContext?.focusedSurfaceSnapshot ? 1 : 0,
      summarizedStableSnapshotCount:
        (toolContext?.stableSurfaceSnapshots?.length ?? 0)
        + (toolContext?.stableSurfaceSnapshotSummary?.summarizedSurfaceCodes.length ?? 0)
    }
  };
}
