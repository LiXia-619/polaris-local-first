import type { AssistantRequestAudit } from './requestAudit';
import type {
  RequestContextMaterialAuthority,
  RequestContextMaterialLane,
  RequestContextMaterialTopography
} from './requestContextReceipt';

export type AssistantRequestInspectorBucket = {
  bucket: keyof AssistantRequestAudit['budgetUsage']['buckets'];
  estimatedTokens: number;
  maxTokens: number | null;
  status: 'unbounded' | 'within_budget' | 'at_risk';
};

export type AssistantRequestInspectorPromptLayerSummary = {
  layer: AssistantRequestAudit['promptParts'][number]['layer'];
  totalCount: number;
  keptCount: number;
  droppedCount: number;
  disabledCount: number;
  totalChars: number;
  keptChars: number;
};

export type AssistantRequestInspectorProjectionMaterialKind =
  | 'stable_prefix'
  | 'dynamic_context'
  | 'task_context_projection'
  | 'ui_context_projection'
  | 'attachment_context_projection'
  | 'room_context_projection'
  | 'theme_context_projection'
  | 'memory_selection'
  | 'conversation_summary'
  | 'semantic_recall_candidate'
  | 'quote_evidence'
  | 'reference_directory'
  | 'history_summary'
  | 'conversation_history'
  | 'attachment_reference'
  | 'tooling_schema';

export type AssistantRequestInspectorProjectionMaterial = {
  kind: AssistantRequestInspectorProjectionMaterialKind;
  label: string;
  itemCount: number;
  sentToProvider: boolean;
  cachePrefixEligible: boolean;
  replayAsConversationHistory: boolean;
  topography: {
    lanes: RequestContextMaterialLane[];
    authority: RequestContextMaterialAuthority;
    sourceOwners: RequestContextMaterialTopography['sourceOwner'][];
    expandability: RequestContextMaterialTopography['expandability'][];
    degradationPaths: string[];
    overlapKeys: string[];
  };
  promptPartNames?: AssistantRequestAudit['promptParts'][number]['name'][];
  segmentKinds?: AssistantRequestAudit['context']['segments'][number]['kind'][];
};

export type AssistantRequestInspectorSemanticRecallKindSummary = {
  kind: AssistantRequestAudit['semanticRecallPlan']['entries'][number]['kind'];
  selectedCount: number;
  droppedCount: number;
  estimatedTokens: number;
  charCount: number;
  sourceMessageCount: number;
};

export type AssistantRequestInspectorConversationSummaryKindSummary = {
  kind: AssistantRequestAudit['conversationSummaryPlan']['entries'][number]['kind'];
  selectedCount: number;
  expiredCount: number;
  droppedCount: number;
  estimatedTokens: number;
  charCount: number;
  sourceMessageCount: number;
  sourceConversationCount: number;
};

export type AssistantRequestInspectorModel = {
  header: {
    requestId: string;
    assistantName: string;
    modelId: string;
    collaboratorId: string | null;
    personaPromptSource: AssistantRequestAudit['personaPromptSource'];
  };
  totals: {
    estimatedTokens: number;
    budgetTokens: number;
    historyBudgetTokens: number;
    overflowTokens: number;
    remainingHistoryTokens: number;
    preflightStatus: AssistantRequestAudit['budgetUsage']['preflightStatus'];
    identityHardCoreTokens: number;
    identitySoftTextureTokens: number;
    toolCapabilityTokens: number;
    themeSnapshotTokens: number;
    focusedStableSnapshotCount: number;
    summarizedStableSnapshotCount: number;
    preparationMs: number;
  };
  promptParts: Array<{
    name: AssistantRequestAudit['promptParts'][number]['name'];
    label: string;
    layer: AssistantRequestAudit['promptParts'][number]['layer'];
    status: 'kept' | 'disabled' | 'dropped_budget';
    charCount: number;
    truncationPriority: number;
  }>;
  promptLayerSummary: AssistantRequestInspectorPromptLayerSummary[];
  projectionMaterials: AssistantRequestInspectorProjectionMaterial[];
  buckets: AssistantRequestInspectorBucket[];
  registryTools: string[];
  memory: {
    status: AssistantRequestAudit['memoryPlan']['status'];
    selectedCount: number;
    droppedCount: number;
    selectedLines: string[];
  };
  semanticRecall: {
    status: AssistantRequestAudit['semanticRecallPlan']['status'];
    strategy: AssistantRequestAudit['semanticRecallPlan']['strategy'];
    config: AssistantRequestAudit['semanticRecallPlan']['config'];
    selectedCount: number;
    droppedCount: number;
    byKind: AssistantRequestInspectorSemanticRecallKindSummary[];
  };
  conversationSummary: {
    status: AssistantRequestAudit['conversationSummaryPlan']['status'];
    selectedCount: number;
    expiredCount: number;
    droppedCount: number;
    estimatedTokens: number;
    byKind: AssistantRequestInspectorConversationSummaryKindSummary[];
  };
  context: {
    protectedMessageId: string | null;
    historyMode: AssistantRequestAudit['contextPlan']['historyMode'];
    sourceMessageCount: number;
    keptMessageCount: number;
    droppedToolCount: number;
    droppedMessageLimitCount: number;
    droppedHistoryCount: number;
  };
  historyUnits: Array<{
    unitId: string;
    kind: AssistantRequestAudit['contextPlan']['units'][number]['kind'];
    messageCount: number;
    estimatedTokens: number;
    status: AssistantRequestAudit['contextPlan']['units'][number]['status'];
    protectedBy: AssistantRequestAudit['contextPlan']['units'][number]['protectedBy'];
  }>;
  historySummaries: Array<{
    summaryId: string;
    reason: AssistantRequestAudit['contextPlan']['summaries'][number]['reason'];
    unitCount: number;
    messageCount: number;
    estimatedTokens: number;
  }>;
  topographyOverlap: AssistantRequestAudit['requestReceipt']['topographyOverlap'];
  topographyEvidenceOverlap: AssistantRequestAudit['requestReceipt']['topographyEvidenceOverlap'];
  shrinkPlan: AssistantRequestAudit['requestReceipt']['shrinkPlan'];
  cache: AssistantRequestAudit['cachePlan'];
  tooling: AssistantRequestAudit['tooling'];
  segments: Array<{
    kind: AssistantRequestAudit['context']['segments'][number]['kind'];
    messageCount: number;
  }>;
};

function resolvePromptPartStatus(args: {
  audit: AssistantRequestAudit;
  name: AssistantRequestAudit['promptParts'][number]['name'];
}) {
  return args.audit.truncation.promptParts.find((decision) => decision.name === args.name)?.status ?? 'disabled';
}

function resolveBucketStatus(bucket: AssistantRequestInspectorBucket): AssistantRequestInspectorBucket['status'] {
  if (bucket.maxTokens === null) return 'unbounded';
  return bucket.estimatedTokens >= bucket.maxTokens ? 'at_risk' : 'within_budget';
}

function buildPromptLayerSummary(audit: AssistantRequestAudit): AssistantRequestInspectorPromptLayerSummary[] {
  const layers: AssistantRequestAudit['promptParts'][number]['layer'][] = ['identity', 'context', 'capability'];

  return layers.map((layer) => {
    const parts = audit.promptParts
      .filter((part) => part.layer === layer)
      .map((part) => ({
        ...part,
        status: resolvePromptPartStatus({ audit, name: part.name })
      }));

    return {
      layer,
      totalCount: parts.length,
      keptCount: parts.filter((part) => part.status === 'kept').length,
      droppedCount: parts.filter((part) => part.status === 'dropped_budget').length,
      disabledCount: parts.filter((part) => part.status === 'disabled').length,
      totalChars: parts.reduce((total, part) => total + part.charCount, 0),
      keptChars: parts
        .filter((part) => part.status === 'kept')
        .reduce((total, part) => total + part.charCount, 0)
    };
  });
}

function countSegmentMessages(
  audit: AssistantRequestAudit,
  kind: AssistantRequestAudit['context']['segments'][number]['kind']
) {
  return audit.context.segments
    .filter((segment) => segment.kind === kind)
    .reduce((total, segment) => total + segment.messages.length, 0);
}

const authorityRank: Record<RequestContextMaterialAuthority, number> = {
  debug_only: 0,
  low: 1,
  candidate: 2,
  medium: 3,
  high: 4,
  hard_rule: 5
};

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function aggregateTopography(
  topographies: RequestContextMaterialTopography[],
  fallback: RequestContextMaterialTopography
): AssistantRequestInspectorProjectionMaterial['topography'] {
  const effective = topographies.length ? topographies : [fallback];
  return {
    lanes: uniqueValues(effective.map((item) => item.lane)),
    authority: effective.reduce((highest, item) => (
      authorityRank[item.authority] > authorityRank[highest] ? item.authority : highest
    ), effective[0]?.authority ?? fallback.authority),
    sourceOwners: uniqueValues(effective.map((item) => item.sourceOwner)),
    expandability: uniqueValues(effective.map((item) => item.expandability)),
    degradationPaths: uniqueValues(effective.map((item) => item.degradationPath)),
    overlapKeys: uniqueValues(effective.map((item) => item.overlapKey))
  };
}

function buildProjectionMaterials(audit: AssistantRequestAudit): AssistantRequestInspectorProjectionMaterial[] {
  const keptPromptParts = audit.promptParts
    .map((part) => ({
      ...part,
      status: resolvePromptPartStatus({ audit, name: part.name })
    }))
    .filter((part) => part.status === 'kept');
  const stablePrefixParts = keptPromptParts.filter((part) => part.layer === 'identity' || part.layer === 'capability');
  const toolContextPartNames: AssistantRequestAudit['promptParts'][number]['name'][] = [
    'tool_context_capability',
    'ui_context_capability',
    'attachment_context_capability',
    'room_context_capability',
    'theme_context_capability'
  ];
  const toolContextPartNameSet = new Set(toolContextPartNames);
  const taskContextPartNames: AssistantRequestAudit['promptParts'][number]['name'][] = [
    'task_seed_context',
    'task_runtime_context',
    'work_runtime_context'
  ];
  const taskContextPartNameSet = new Set(taskContextPartNames);
  const legacyToolContextParts = keptPromptParts.filter((part) => part.name === 'tool_context_capability');
  const taskContextParts = keptPromptParts.filter((part) => taskContextPartNameSet.has(part.name));
  const uiContextParts = keptPromptParts.filter((part) => part.name === 'ui_context_capability');
  const attachmentContextParts = keptPromptParts.filter((part) => part.name === 'attachment_context_capability');
  const roomContextParts = keptPromptParts.filter((part) => part.name === 'room_context_capability');
  const themeContextParts = keptPromptParts.filter((part) => part.name === 'theme_context_capability');
  const dynamicContextParts = keptPromptParts.filter((part) => (
    part.layer === 'context'
    && !toolContextPartNameSet.has(part.name)
    && !taskContextPartNameSet.has(part.name)
  ));
  const memoryMessageCount = countSegmentMessages(audit, 'memory');
  const conversationSummaryMessageCount = countSegmentMessages(audit, 'conversation_summary');
  const semanticRecallMessageCount = countSegmentMessages(audit, 'semantic_recall');
  const historySummaryMessageCount = countSegmentMessages(audit, 'history_summary');
  const conversationMessageCount = countSegmentMessages(audit, 'conversation');
  const attachmentCount = audit.context.attachmentSlots.pending.length;
  const blockTopographyByPromptPart = new Map(
    audit.requestReceipt.blocks
      .filter((block) => block.partNames?.length)
      .flatMap((block) => (block.partNames ?? []).map((name) => [name, block.topography] as const))
  );
  const topographiesForPromptParts = (parts: typeof keptPromptParts) => (
    parts.flatMap((part) => {
      const topography = blockTopographyByPromptPart.get(part.name);
      return topography ? [topography] : [];
    })
  );
  const topographiesForLane = (lane: RequestContextMaterialLane) => (
    [
      ...audit.requestReceipt.blocks.map((block) => block.topography),
      ...(audit.requestReceipt.topographyEvidence ?? []).map((evidence) => evidence.topography)
    ]
      .filter((topography) => topography.lane === lane)
  );
  const sentBlocksForPromptParts = (parts: typeof keptPromptParts) => {
    const partNames = new Set(parts.map((part) => part.name));
    return audit.requestReceipt.blocks.filter((block) => (
      block.sentToProvider
      && (block.partNames ?? []).some((name) => partNames.has(name))
    ));
  };
  const promptPartsCachePrefixEligible = (parts: typeof keptPromptParts, fallback = false) => {
    if (!parts.length) return false;
    const blocks = sentBlocksForPromptParts(parts);
    if (!blocks.length) return fallback;
    return blocks.every((block) => block.cachePrefixEligible);
  };
  const sentBlocksForLane = (lane: RequestContextMaterialLane) => (
    audit.requestReceipt.blocks.filter((block) => block.sentToProvider && block.topography.lane === lane)
  );
  const laneCachePrefixEligible = (lane: RequestContextMaterialLane) => {
    const blocks = sentBlocksForLane(lane);
    return blocks.length > 0 && blocks.every((block) => block.cachePrefixEligible);
  };
  const quoteEvidenceCount = (audit.requestReceipt.topographyEvidence ?? [])
    .filter((evidence) => evidence.topography.lane === 'quote_evidence' && evidence.sentToProvider)
    .reduce((total, evidence) => total + evidence.itemCount, 0);
  const semanticRecallCandidateCount = (audit.requestReceipt.topographyEvidence ?? [])
    .filter((evidence) => evidence.topography.lane === 'retrieved_candidate' && evidence.sentToProvider)
    .reduce((total, evidence) => total + evidence.itemCount, 0);
  const conversationSummaryCount = (audit.requestReceipt.topographyEvidence ?? [])
    .filter((evidence) => evidence.topography.lane === 'conversation_summary' && evidence.sentToProvider)
    .reduce((total, evidence) => total + evidence.itemCount, 0);
  const fallbackTopography = (lane: RequestContextMaterialLane): RequestContextMaterialTopography => ({
    lane,
    authority:
      lane === 'hard_rule' ? 'hard_rule'
        : lane === 'raw_tail' || lane === 'tool_schema' || lane === 'active_task' ? 'high'
          : lane === 'history_summary' ? 'low'
            : 'medium',
    sourceOwner:
      lane === 'tool_schema' ? 'tool_registry'
        : lane === 'confirmed_memory' ? 'memory_plan'
          : lane === 'conversation_summary' ? 'conversation_summary_plan'
          : lane === 'history_summary' || lane === 'active_task' ? 'context_plan'
            : lane === 'raw_tail' || lane === 'quote_evidence' ? 'conversation_history'
              : 'app_runtime',
    expandability:
      lane === 'tool_schema' ? 'schema'
        : lane === 'reference_directory' || lane === 'confirmed_memory' ? 'directory_then_tool_read'
          : lane === 'history_summary' || lane === 'conversation_summary' ? 'summary_only'
            : lane === 'raw_tail' || lane === 'quote_evidence' ? 'raw_history'
              : 'compact_projection',
    degradationPath: 'see material-specific request receipt blocks',
    overlapKey: `${lane}:aggregate`
  });

  return [
    {
      kind: 'stable_prefix',
      label: 'stable prefix',
      itemCount: stablePrefixParts.length,
      sentToProvider: stablePrefixParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible(stablePrefixParts, true),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForPromptParts(stablePrefixParts), fallbackTopography('hard_rule')),
      promptPartNames: stablePrefixParts.map((part) => part.name)
    },
    {
      kind: 'dynamic_context',
      label: 'dynamic context',
      itemCount: dynamicContextParts.length,
      sentToProvider: dynamicContextParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible(dynamicContextParts),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForPromptParts(dynamicContextParts), fallbackTopography('runtime_context')),
      promptPartNames: dynamicContextParts.map((part) => part.name)
    },
    {
      kind: 'task_context_projection',
      label: 'task context projection',
      itemCount: taskContextParts.length,
      sentToProvider: taskContextParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible(taskContextParts),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForPromptParts(taskContextParts), fallbackTopography('active_task')),
      promptPartNames: taskContextParts.map((part) => part.name)
    },
    {
      kind: 'ui_context_projection',
      label: 'ui context projection',
      itemCount: uiContextParts.length + legacyToolContextParts.length,
      sentToProvider: uiContextParts.length > 0 || legacyToolContextParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible([...uiContextParts, ...legacyToolContextParts]),
      replayAsConversationHistory: false,
      topography: aggregateTopography(
        topographiesForPromptParts([...uiContextParts, ...legacyToolContextParts]),
        fallbackTopography('app_context')
      ),
      promptPartNames: [...uiContextParts, ...legacyToolContextParts].map((part) => part.name)
    },
    {
      kind: 'attachment_context_projection',
      label: 'attachment context projection',
      itemCount: attachmentContextParts.length,
      sentToProvider: attachmentContextParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible(attachmentContextParts),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForPromptParts(attachmentContextParts), fallbackTopography('app_context')),
      promptPartNames: attachmentContextParts.map((part) => part.name)
    },
    {
      kind: 'room_context_projection',
      label: 'room/workspace context projection',
      itemCount: roomContextParts.length,
      sentToProvider: roomContextParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible(roomContextParts),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForPromptParts(roomContextParts), fallbackTopography('app_context')),
      promptPartNames: roomContextParts.map((part) => part.name)
    },
    {
      kind: 'theme_context_projection',
      label: 'theme context projection',
      itemCount: themeContextParts.length,
      sentToProvider: themeContextParts.length > 0,
      cachePrefixEligible: promptPartsCachePrefixEligible(themeContextParts),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForPromptParts(themeContextParts), fallbackTopography('app_context')),
      promptPartNames: themeContextParts.map((part) => part.name)
    },
    {
      kind: 'memory_selection',
      label: 'memory selection',
      itemCount: audit.memoryPlan.selectedLines.length,
      sentToProvider: memoryMessageCount > 0,
      cachePrefixEligible: laneCachePrefixEligible('confirmed_memory'),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForLane('confirmed_memory'), fallbackTopography('confirmed_memory')),
      segmentKinds: memoryMessageCount > 0 ? ['memory'] : []
    },
    {
      kind: 'conversation_summary',
      label: 'conversation summaries',
      itemCount: conversationSummaryCount,
      sentToProvider: conversationSummaryCount > 0,
      cachePrefixEligible: laneCachePrefixEligible('conversation_summary'),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForLane('conversation_summary'), {
        lane: 'conversation_summary',
        authority: 'medium',
        sourceOwner: 'conversation_summary_plan',
        expandability: 'summary_only',
        degradationPath: 'drop stale conversation summaries before confirmed memory and raw tail',
        overlapKey: 'memory:conversation-summary'
      }),
      segmentKinds: conversationSummaryMessageCount > 0 ? ['conversation_summary'] : []
    },
    {
      kind: 'semantic_recall_candidate',
      label: 'semantic recall candidates',
      itemCount: semanticRecallCandidateCount,
      sentToProvider: semanticRecallCandidateCount > 0,
      cachePrefixEligible: laneCachePrefixEligible('retrieved_candidate'),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForLane('retrieved_candidate'), {
        lane: 'retrieved_candidate',
        authority: 'candidate',
        sourceOwner: 'semantic_recall_plan',
        expandability: 'compact_projection',
        degradationPath: 'drop retrieved candidates before confirmed memory, active task, or latest raw tail',
        overlapKey: 'memory:retrieved-candidate'
      }),
      segmentKinds: semanticRecallMessageCount > 0 ? ['semantic_recall'] : []
    },
    {
      kind: 'quote_evidence',
      label: 'quote evidence',
      itemCount: quoteEvidenceCount,
      sentToProvider: quoteEvidenceCount > 0,
      cachePrefixEligible: laneCachePrefixEligible('quote_evidence'),
      replayAsConversationHistory: true,
      topography: aggregateTopography(topographiesForLane('quote_evidence'), fallbackTopography('quote_evidence')),
      segmentKinds: quoteEvidenceCount > 0 ? ['conversation'] : []
    },
    {
      kind: 'reference_directory',
      label: 'reference directory',
      itemCount: topographiesForLane('reference_directory').length,
      sentToProvider: topographiesForLane('reference_directory').length > 0,
      cachePrefixEligible: laneCachePrefixEligible('reference_directory'),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForLane('reference_directory'), fallbackTopography('reference_directory')),
      segmentKinds: topographiesForLane('reference_directory').length > 0 ? ['system'] : []
    },
    {
      kind: 'history_summary',
      label: 'history summary',
      itemCount: audit.contextPlan.summaries.length,
      sentToProvider: historySummaryMessageCount > 0,
      cachePrefixEligible: laneCachePrefixEligible('history_summary'),
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForLane('history_summary'), fallbackTopography('history_summary')),
      segmentKinds: historySummaryMessageCount > 0 ? ['history_summary'] : []
    },
    {
      kind: 'conversation_history',
      label: 'conversation history',
      itemCount: conversationMessageCount,
      sentToProvider: conversationMessageCount > 0,
      cachePrefixEligible: laneCachePrefixEligible('raw_tail'),
      replayAsConversationHistory: true,
      topography: aggregateTopography(topographiesForLane('raw_tail'), fallbackTopography('raw_tail')),
      segmentKinds: conversationMessageCount > 0 ? ['conversation'] : []
    },
    {
      kind: 'attachment_reference',
      label: 'attachment reference',
      itemCount: attachmentCount,
      sentToProvider: attachmentCount > 0,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      topography: aggregateTopography([], {
        lane: 'app_context',
        authority: 'medium',
        sourceOwner: 'app_runtime',
        expandability: 'compact_projection',
        degradationPath: 'keep attachment metadata before inlining bodies; bodies must degrade to references',
        overlapKey: 'attachment:reference'
      })
    },
    {
      kind: 'tooling_schema',
      label: 'tooling schema',
      itemCount: audit.tooling.toolCount,
      sentToProvider: audit.tooling.toolCount > 0,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      topography: aggregateTopography(topographiesForLane('tool_schema'), fallbackTopography('tool_schema'))
    }
  ];
}

function buildSemanticRecallKindSummary(
  plan: AssistantRequestAudit['semanticRecallPlan']
): AssistantRequestInspectorSemanticRecallKindSummary[] {
  const order: AssistantRequestInspectorSemanticRecallKindSummary['kind'][] = [
    'recent_tail',
    'matched_context',
    'vector_match',
    'voice_anchor'
  ];
  const summaries = new Map<AssistantRequestInspectorSemanticRecallKindSummary['kind'], AssistantRequestInspectorSemanticRecallKindSummary>();

  for (const entry of plan.entries) {
    const current = summaries.get(entry.kind) ?? {
      kind: entry.kind,
      selectedCount: 0,
      droppedCount: 0,
      estimatedTokens: 0,
      charCount: 0,
      sourceMessageCount: 0
    };
    if (entry.status === 'dropped_budget') {
      current.droppedCount += 1;
    } else {
      current.selectedCount += 1;
      current.estimatedTokens += entry.estimatedTokens;
      current.charCount += entry.charCount;
      current.sourceMessageCount += entry.sourceMessageIds.length;
    }
    summaries.set(entry.kind, current);
  }

  return order.flatMap((kind) => {
    const summary = summaries.get(kind);
    return summary && (summary.selectedCount > 0 || summary.droppedCount > 0) ? [summary] : [];
  });
}

function buildConversationSummaryKindSummary(
  plan: AssistantRequestAudit['conversationSummaryPlan']
): AssistantRequestInspectorConversationSummaryKindSummary[] {
  const order: AssistantRequestInspectorConversationSummaryKindSummary['kind'][] = [
    'relational_profile',
    'recent_topic'
  ];
  const summaries = new Map<
    AssistantRequestInspectorConversationSummaryKindSummary['kind'],
    AssistantRequestInspectorConversationSummaryKindSummary
  >();

  for (const entry of plan.entries) {
    const current = summaries.get(entry.kind) ?? {
      kind: entry.kind,
      selectedCount: 0,
      expiredCount: 0,
      droppedCount: 0,
      estimatedTokens: 0,
      charCount: 0,
      sourceMessageCount: 0,
      sourceConversationCount: 0
    };
    if (entry.status === 'expired') {
      current.expiredCount += 1;
    } else if (entry.status === 'dropped_budget') {
      current.droppedCount += 1;
    } else {
      current.selectedCount += 1;
      current.estimatedTokens += entry.estimatedTokens;
      current.charCount += entry.charCount;
      current.sourceMessageCount += entry.sourceMessageIds.length;
      current.sourceConversationCount += entry.sourceConversationIds.length;
    }
    summaries.set(entry.kind, current);
  }

  return order.flatMap((kind) => {
    const summary = summaries.get(kind);
    return summary && (summary.selectedCount > 0 || summary.expiredCount > 0 || summary.droppedCount > 0) ? [summary] : [];
  });
}

export function buildRequestInspectorModel(audit: AssistantRequestAudit): AssistantRequestInspectorModel {
  return {
    header: {
      requestId: audit.requestId,
      assistantName: audit.assistantName,
      modelId: audit.modelId,
      collaboratorId: audit.collaboratorId,
      personaPromptSource: audit.personaPromptSource
    },
    totals: {
      estimatedTokens: audit.budgetUsage.totalEstimatedTokens,
      budgetTokens: audit.budgetUsage.totalPromptTokens,
      historyBudgetTokens: audit.budgetUsage.historyBudgetTokens,
      overflowTokens: audit.budgetUsage.overflowTokens,
      remainingHistoryTokens: audit.budgetUsage.remainingHistoryTokens,
      preflightStatus: audit.budgetUsage.preflightStatus,
      identityHardCoreTokens: audit.budgetUsage.diagnostics.identityHardCoreTokens,
      identitySoftTextureTokens: audit.budgetUsage.diagnostics.identitySoftTextureTokens,
      toolCapabilityTokens: audit.budgetUsage.diagnostics.toolCapabilityTokens,
      themeSnapshotTokens: audit.budgetUsage.diagnostics.themeSnapshotTokens,
      focusedStableSnapshotCount: audit.budgetUsage.diagnostics.focusedStableSnapshotCount,
      summarizedStableSnapshotCount: audit.budgetUsage.diagnostics.summarizedStableSnapshotCount,
      preparationMs: audit.timings.totalPreparationMs
    },
    promptParts: audit.promptParts.map((part) => ({
      name: part.name,
      label: part.label,
      layer: part.layer,
      status: resolvePromptPartStatus({ audit, name: part.name }),
      charCount: part.charCount,
      truncationPriority: part.truncationPriority
    })),
    promptLayerSummary: buildPromptLayerSummary(audit),
    projectionMaterials: buildProjectionMaterials(audit),
    buckets: Object.entries(audit.budgetUsage.buckets).map(([bucket, usage]) => ({
      bucket: bucket as keyof AssistantRequestAudit['budgetUsage']['buckets'],
      estimatedTokens: usage.estimatedTokens,
      maxTokens: usage.maxTokens,
      status: resolveBucketStatus({
        bucket: bucket as keyof AssistantRequestAudit['budgetUsage']['buckets'],
        estimatedTokens: usage.estimatedTokens,
        maxTokens: usage.maxTokens,
        status: 'within_budget'
      })
    })),
    registryTools: audit.tooling.toolNames,
    memory: {
      status: audit.memoryPlan.status,
      selectedCount: audit.memoryPlan.selectedLines.length,
      droppedCount: audit.memoryPlan.entries.filter((entry) => entry.status === 'dropped_budget').length,
      selectedLines: audit.memoryPlan.selectedLines
    },
    semanticRecall: {
      status: audit.semanticRecallPlan.status,
      strategy: audit.semanticRecallPlan.strategy,
      config: audit.semanticRecallPlan.config,
      selectedCount: audit.semanticRecallPlan.selectedCandidates.length,
      droppedCount: audit.semanticRecallPlan.entries.filter((entry) => entry.status === 'dropped_budget').length,
      byKind: buildSemanticRecallKindSummary(audit.semanticRecallPlan)
    },
    conversationSummary: {
      status: audit.conversationSummaryPlan.status,
      selectedCount: audit.conversationSummaryPlan.selectedSummaries.length,
      expiredCount: audit.conversationSummaryPlan.entries.filter((entry) => entry.status === 'expired').length,
      droppedCount: audit.conversationSummaryPlan.entries.filter((entry) => entry.status === 'dropped_budget').length,
      estimatedTokens: audit.conversationSummaryPlan.estimatedTokens,
      byKind: buildConversationSummaryKindSummary(audit.conversationSummaryPlan)
    },
    context: {
      protectedMessageId: audit.contextPlan.protectedMessageId,
      historyMode: audit.contextPlan.historyMode,
      sourceMessageCount: audit.sourceMessageCount,
      keptMessageCount: audit.keptMessageCount,
      droppedToolCount: audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_tool_message').length,
      droppedMessageLimitCount: audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_message_limit').length,
      droppedHistoryCount: audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_history_budget').length
    },
    historyUnits: audit.contextPlan.units.map((unit) => ({
      unitId: unit.unitId,
      kind: unit.kind,
      messageCount: unit.messageIds.length,
      estimatedTokens: unit.estimatedTokens,
      status: unit.status,
      protectedBy: unit.protectedBy
    })),
    historySummaries: audit.contextPlan.summaries.map((summary) => ({
      summaryId: summary.summaryId,
      reason: summary.reason,
      unitCount: summary.unitIds.length,
      messageCount: summary.messageIds.length,
      estimatedTokens: summary.estimatedTokens
    })),
    topographyOverlap: audit.requestReceipt.topographyOverlap,
    topographyEvidenceOverlap: audit.requestReceipt.topographyEvidenceOverlap,
    shrinkPlan: audit.requestReceipt.shrinkPlan,
    cache: audit.cachePlan,
    tooling: audit.tooling,
    segments: audit.context.segments.map((segment) => ({
      kind: segment.kind,
      messageCount: segment.messages.length
    }))
  };
}
