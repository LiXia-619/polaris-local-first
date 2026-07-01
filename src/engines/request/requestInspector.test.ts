import { describe, expect, it } from 'vitest';
import type { AssistantPromptPart, AssistantRequestAudit } from './requestAudit';
import { resolveRequestCachePlan } from './requestCachePlan';
import type {
  RequestContextMaterialLane,
  RequestContextReceiptBlock,
  RequestContextReceiptTopographyEvidence
} from './requestContextReceipt';
import { buildRequestInspectorModel } from './requestInspector';

function createPart(
  part: Pick<AssistantPromptPart, 'name' | 'layer' | 'content'> & Partial<AssistantPromptPart>
): AssistantPromptPart {
  return {
    label: part.name,
    role: 'system',
    truncationPriority: 0,
    enabled: true,
    charCount: part.content.length,
    ...part
  };
}

function createRequestReceipt(): AssistantRequestAudit['requestReceipt'] {
  return {
    schemaVersion: 1,
    fingerprints: {
      stablePrompt: 'stable',
      dynamicContext: 'dynamic',
      toolCapabilities: 'tools',
      conversationTail: 'tail',
      fullRequest: 'full'
    },
    cache: {
      applicationStatus: 'provider_automatic_or_unknown',
      sendsExplicitCacheControl: false,
      breakpoints: []
    },
    blocks: [],
    topographyEvidence: [],
    topographyEvidenceOverlap: [],
    duplicateInfo: [],
    topographyOverlap: [],
    shrinkPlan: [],
    intentLanes: []
  };
}

function createQuoteEvidenceReceipt(): AssistantRequestAudit['requestReceipt'] {
  return {
    ...createRequestReceipt(),
    topographyEvidence: [{
      id: 'evidence:quote:user-raw-tail',
      label: 'user quote evidence',
      source: 'conversation_message',
      sourceBlockIds: ['segment:1:conversation'],
      sourceMessageIds: ['user-1'],
      sourceMemoryIndexes: [],
      itemCount: 1,
      charCount: 32,
      estimatedTokens: 8,
      sentToProvider: true,
      contentFingerprints: ['quote-fingerprint'],
      topography: {
        lane: 'quote_evidence',
        authority: 'medium',
        sourceOwner: 'conversation_history',
        expandability: 'raw_history',
        degradationPath: 'derive from kept user raw tail',
        overlapKey: 'quote:user-raw-tail'
      }
    }]
  };
}

function createReceiptBlock(args: {
  id: string;
  label: string;
  lane: RequestContextMaterialLane;
  cachePrefixEligible: boolean;
  source?: RequestContextReceiptBlock['source'];
  partNames?: RequestContextReceiptBlock['partNames'];
}): RequestContextReceiptBlock {
  return {
    id: args.id,
    label: args.label,
    intent: args.lane === 'tool_schema' ? 'tooling_schema'
      : args.lane === 'confirmed_memory' ? 'memory'
        : args.lane === 'conversation_summary' ? 'conversation_summary'
          : args.lane === 'retrieved_candidate' ? 'semantic_recall'
            : 'conversation_history',
    source: args.source ?? 'context_segment',
    itemCount: 1,
    charCount: 24,
    estimatedTokens: 6,
    fingerprint: `${args.id}:fingerprint`,
    cachePrefixEligible: args.cachePrefixEligible,
    sentToProvider: true,
    topography: {
      lane: args.lane,
      authority: args.lane === 'retrieved_candidate' ? 'candidate' : 'medium',
      sourceOwner: args.lane === 'confirmed_memory' ? 'memory_plan'
        : args.lane === 'conversation_summary' ? 'conversation_summary_plan'
          : args.lane === 'retrieved_candidate' ? 'semantic_recall_plan'
            : args.lane === 'reference_directory' ? 'app_runtime'
              : 'context_plan',
      expandability: args.lane === 'reference_directory' || args.lane === 'confirmed_memory'
        ? 'directory_then_tool_read'
        : args.lane === 'raw_tail' ? 'raw_history'
          : 'summary_only',
      degradationPath: 'test receipt projection',
      overlapKey: `${args.lane}:test`
    },
    ...(args.partNames ? { partNames: args.partNames } : {})
  };
}

function createTopographyEvidence(args: {
  id: string;
  label: string;
  lane: RequestContextMaterialLane;
}): RequestContextReceiptTopographyEvidence {
  return {
    id: args.id,
    label: args.label,
    source: args.lane === 'retrieved_candidate' ? 'semantic_recall_candidate'
      : args.lane === 'conversation_summary' ? 'conversation_summary'
        : 'conversation_message',
    sourceBlockIds: [`segment:${args.lane}`],
    sourceMessageIds: [],
    sourceMemoryIndexes: [],
    itemCount: 1,
    charCount: 24,
    estimatedTokens: 6,
    sentToProvider: true,
    contentFingerprints: [`${args.id}:content`],
    topography: {
      lane: args.lane,
      authority: args.lane === 'retrieved_candidate' ? 'candidate' : 'medium',
      sourceOwner: args.lane === 'retrieved_candidate' ? 'semantic_recall_plan'
        : args.lane === 'conversation_summary' ? 'conversation_summary_plan'
          : 'conversation_history',
      expandability: args.lane === 'retrieved_candidate' ? 'compact_projection'
        : args.lane === 'conversation_summary' ? 'summary_only'
          : 'raw_history',
      degradationPath: 'test evidence projection',
      overlapKey: `${args.lane}:test`
    }
  };
}

function createAudit(promptParts: AssistantPromptPart[]): AssistantRequestAudit {
  return {
    requestId: 'req-1',
    assistantName: 'Pharos',
    providerId: 'provider-test',
    providerName: 'Test Provider',
    modelId: 'claude-test',
    collaboratorId: 'pharos',
    personaPromptSource: 'custom',
    messageLimit: 20,
    tokenBudget: 10_000,
    budgetPlan: {
      totalPromptTokens: 10_000,
      messageLimit: 20,
      buckets: {
        identity: { maxTokens: null, truncationPriority: 0 },
        capability: { maxTokens: null, truncationPriority: 3 },
        memory: { maxTokens: null, truncationPriority: 2 },
        history: { maxTokens: 10_000, truncationPriority: 1 }
      }
    },
    budgetUsage: {
      totalEstimatedTokens: 120,
      totalPromptTokens: 10_000,
      historyBudgetTokens: 10_000,
      remainingHistoryTokens: 9_900,
      overflowTokens: 0,
      preflightStatus: 'within_budget',
      buckets: {
        identity: { estimatedTokens: 20, maxTokens: null },
        capability: { estimatedTokens: 40, maxTokens: null },
        memory: { estimatedTokens: 20, maxTokens: null },
        history: { estimatedTokens: 40, maxTokens: 10_000 }
      },
      diagnostics: {
        identityHardCoreTokens: 10,
        identitySoftTextureTokens: 10,
        toolCapabilityTokens: 30,
        themeSnapshotTokens: 0,
        focusedStableSnapshotCount: 0,
        summarizedStableSnapshotCount: 0
      }
    },
    memoryPlan: {
      selectedLines: ['用户 likes clear architecture.', 'Keep request boundaries explicit.'],
      estimatedTokens: 20,
      maxTokens: null,
      status: 'within_budget',
      entries: [
        { text: '用户 likes clear architecture.', estimatedTokens: 10, status: 'kept' },
        { text: 'Keep request boundaries explicit.', estimatedTokens: 10, status: 'kept' }
      ]
    },
    conversationSummaryPlan: {
      status: 'empty',
      selectedSummaries: [],
      estimatedTokens: 0,
      maxTokens: null,
      maxChars: null,
      entries: []
    },
    semanticRecallPlan: {
      status: 'not_configured',
      strategy: 'none',
      config: {
        recentTailConversationCount: 3,
        recentTailUserMessageCount: 3,
        voiceAnchorCount: 3
      },
      selectedCandidates: [],
      estimatedTokens: 0,
      maxTokens: null,
      entries: []
    },
    cachePlan: resolveRequestCachePlan({
      promptParts,
      providerProtocol: 'anthropic-messages',
      minimumBreakpointTokens: 1
    }),
    contextPlan: {
      protectedMessageId: 'user-1',
      historyMode: 'conversation',
      summaries: [],
      units: [
        {
          unitId: 'user-1',
          kind: 'user_turn',
          messageIds: ['user-1'],
          estimatedTokens: 20,
          status: 'kept',
          protectedBy: 'current_user_message'
        },
        {
          unitId: 'assistant-1',
          kind: 'assistant_turn',
          messageIds: ['assistant-1'],
          estimatedTokens: 20,
          status: 'kept',
          protectedBy: null
        }
      ],
      entries: [
        {
          messageId: 'user-1',
          role: 'user',
          estimatedTokens: 20,
          status: 'kept',
          protectedBy: 'current_user_message'
        },
        {
          messageId: 'assistant-1',
          role: 'assistant',
          estimatedTokens: 20,
          status: 'kept',
          protectedBy: null
        }
      ]
    },
    sourceMessageCount: 2,
    droppedToolMessageCount: 0,
    keptMessageCount: 2,
    trimmedMessageCount: 0,
    promptParts,
    truncation: {
      promptParts: promptParts.map((part) => ({
        name: part.name,
        label: part.label,
        layer: part.layer,
        bucket: part.layer === 'identity' ? 'identity' : 'capability',
        estimatedTokens: 10,
        status: 'kept'
      })),
      history: {
        maxTokens: 10_000,
        estimatedTokens: 40,
        keptMessageCount: 2,
        droppedMessageCount: 0,
        remainingBudgetTokens: 9_900,
        status: 'kept'
      }
    },
    tooling: {
      enabled: true,
      toolCount: 2,
      toolChoice: 'auto',
      toolNames: ['readProjectFile', 'updateProjectFile']
    },
    requestReceipt: createRequestReceipt(),
    context: {
      memorySlots: {
        session: [],
        profile: ['用户 likes clear architecture.', 'Keep request boundaries explicit.'],
        pin: []
      },
      attachmentSlots: {
        enabled: true,
        pending: [{ id: 'attachment-1', kind: 'image', name: 'screen.png' }]
      },
      segments: [
        {
          kind: 'memory',
          messages: [{ role: 'system', content: 'memory lines' }]
        },
        {
          kind: 'conversation',
          messages: [
            { role: 'user', content: 'please continue' },
            { role: 'assistant', content: 'continuing' }
          ]
        }
      ],
      tools: [
        { type: 'function', function: { name: 'readProjectFile', description: 'read', parameters: {} } },
        { type: 'function', function: { name: 'updateProjectFile', description: 'write', parameters: {} } }
      ],
      toolChoice: 'auto'
    },
    timings: {
      personaPromptMs: 0,
      promptPartsMs: 0,
      truncationMs: 0,
      memoryPlanMs: 0,
      conversationBuildMs: 0,
      contextPlanMs: 0,
      toolRequestMs: 0,
      cachePlanMs: 0,
      assetHydrationMs: 0,
      contextAssemblyMs: 0,
      budgetUsageMs: 0,
      totalPreparationMs: 0
    }
  };
}

describe('buildRequestInspectorModel', () => {
  it('shows context prompt parts and projection material buckets without changing provider payload', () => {
    const identity = createPart({
      name: 'system_identity',
      layer: 'identity',
      content: 'stable identity'
    });
    const modelRuntime = createPart({
      name: 'model_runtime_context',
      layer: 'context',
      content: 'current model runtime hint'
    });
    const capability = createPart({
      name: 'tool_capability',
      layer: 'capability',
      content: 'stable tool protocol'
    });
    const taskRuntime = createPart({
      name: 'work_runtime_context',
      layer: 'context',
      content: 'current task projection'
    });
    const roomContext = createPart({
      name: 'room_context_capability',
      layer: 'context',
      content: 'current workspace projection'
    });

    const model = buildRequestInspectorModel(createAudit([identity, modelRuntime, capability, taskRuntime, roomContext]));

    expect(model.promptLayerSummary.map((summary) => [summary.layer, summary.keptCount, summary.totalCount]))
      .toEqual([
        ['identity', 1, 1],
        ['context', 3, 3],
        ['capability', 1, 1]
      ]);

    const materials = new Map(model.projectionMaterials.map((material) => [material.kind, material]));
    expect(materials.get('stable_prefix')).toMatchObject({
      itemCount: 2,
      sentToProvider: true,
      cachePrefixEligible: true,
      replayAsConversationHistory: false,
      promptPartNames: ['system_identity', 'tool_capability']
    });
    expect(materials.get('dynamic_context')).toMatchObject({
      itemCount: 1,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      promptPartNames: ['model_runtime_context']
    });
    expect(materials.get('task_context_projection')).toMatchObject({
      itemCount: 1,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      promptPartNames: ['work_runtime_context']
    });
    expect(materials.get('room_context_projection')).toMatchObject({
      itemCount: 1,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      promptPartNames: ['room_context_capability']
    });
    expect(materials.get('ui_context_projection')).toMatchObject({
      itemCount: 0,
      sentToProvider: false,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      promptPartNames: []
    });
    expect(materials.get('memory_selection')).toMatchObject({
      itemCount: 2,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      topography: {
        lanes: ['confirmed_memory'],
        authority: 'medium',
        sourceOwners: ['memory_plan'],
        expandability: ['directory_then_tool_read']
      },
      segmentKinds: ['memory']
    });
    expect(materials.get('semantic_recall_candidate')).toMatchObject({
      itemCount: 0,
      sentToProvider: false,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      topography: {
        lanes: ['retrieved_candidate'],
        authority: 'candidate',
        sourceOwners: ['semantic_recall_plan'],
        expandability: ['compact_projection']
      },
      segmentKinds: []
    });
    expect(materials.get('quote_evidence')).toMatchObject({
      itemCount: 0,
      sentToProvider: false,
      cachePrefixEligible: false,
      replayAsConversationHistory: true,
      topography: {
        lanes: ['quote_evidence'],
        sourceOwners: ['conversation_history'],
        expandability: ['raw_history']
      },
      segmentKinds: []
    });
    expect(materials.get('history_summary')).toMatchObject({
      itemCount: 0,
      sentToProvider: false,
      cachePrefixEligible: false,
      replayAsConversationHistory: false,
      segmentKinds: []
    });
    expect(Array.from(materials.keys())).not.toContain('runtime_feedback');
    expect(materials.get('conversation_history')).toMatchObject({
      itemCount: 2,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: true,
      topography: {
        lanes: ['raw_tail'],
        authority: 'high',
        sourceOwners: ['conversation_history'],
        expandability: ['raw_history']
      },
      segmentKinds: ['conversation']
    });
    expect(materials.get('attachment_reference')).toMatchObject({
      itemCount: 1,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: false
    });
    expect(materials.get('tooling_schema')).toMatchObject({
      itemCount: 2,
      sentToProvider: true,
      cachePrefixEligible: false,
      replayAsConversationHistory: false
    });
    expect(model.historyUnits).toEqual([
      {
        unitId: 'user-1',
        kind: 'user_turn',
        messageCount: 1,
        estimatedTokens: 20,
        status: 'kept',
        protectedBy: 'current_user_message'
      },
      {
        unitId: 'assistant-1',
        kind: 'assistant_turn',
        messageCount: 1,
        estimatedTokens: 20,
        status: 'kept',
        protectedBy: null
      }
    ]);
    expect(model.historySummaries).toEqual([]);
    expect(model.context.historyMode).toBe('conversation');
    expect(model.semanticRecall).toMatchObject({
      status: 'not_configured',
      strategy: 'none',
      selectedCount: 0,
      droppedCount: 0
    });
  });

  it('surfaces quote evidence from the receipt without treating it as memory', () => {
    const identity = createPart({
      name: 'system_identity',
      layer: 'identity',
      content: 'stable identity'
    });
    const audit = {
      ...createAudit([identity]),
      requestReceipt: createQuoteEvidenceReceipt()
    };

    const materials = new Map(buildRequestInspectorModel(audit).projectionMaterials.map((material) => [material.kind, material]));

    expect(materials.get('quote_evidence')).toMatchObject({
      itemCount: 1,
      sentToProvider: true,
      replayAsConversationHistory: true,
      topography: {
        lanes: ['quote_evidence'],
        authority: 'medium',
        sourceOwners: ['conversation_history'],
        expandability: ['raw_history'],
        overlapKeys: ['quote:user-raw-tail']
      },
      segmentKinds: ['conversation']
    });
    expect(materials.get('memory_selection')?.topography.lanes).toEqual(['confirmed_memory']);
  });

  it('uses request receipt blocks as the source of cache-prefix eligibility', () => {
    const identity = createPart({
      name: 'system_identity',
      layer: 'identity',
      content: 'stable identity'
    });
    const audit = createAudit([identity]);
    audit.context.segments = [
      {
        kind: 'memory',
        messages: [{ role: 'system', content: 'memory lines', cachePrefixEligible: true }]
      },
      {
        kind: 'conversation_summary',
        messages: [{ role: 'system', content: 'stored summary', cachePrefixEligible: true }]
      },
      {
        kind: 'system',
        messages: [{ role: 'system', content: '[工作区参考资料目录]\n- guide.md', cachePrefixEligible: true }]
      },
      {
        kind: 'history_summary',
        messages: [{ role: 'system', content: 'older conversation summary', cachePrefixEligible: true }]
      },
      {
        kind: 'semantic_recall',
        messages: [{ role: 'system', content: 'old candidate line' }]
      },
      {
        kind: 'conversation',
        messages: [{ role: 'user', content: 'please continue' }]
      }
    ];
    audit.contextPlan.summaries = [{
      summaryId: 'history-summary-1',
      unitIds: ['old-unit'],
      messageIds: ['old-message'],
      reason: 'history_budget',
      estimatedTokens: 8,
      content: 'older conversation summary'
    }];
    audit.requestReceipt = {
      ...createRequestReceipt(),
      blocks: [
        createReceiptBlock({
          id: 'prompt:system_identity',
          label: 'system identity',
          lane: 'hard_rule',
          cachePrefixEligible: true,
          source: 'prompt_part',
          partNames: ['system_identity']
        }),
        createReceiptBlock({
          id: 'segment:0:memory',
          label: 'memory',
          lane: 'confirmed_memory',
          cachePrefixEligible: true
        }),
        createReceiptBlock({
          id: 'segment:1:conversation_summary',
          label: 'conversation summary',
          lane: 'conversation_summary',
          cachePrefixEligible: true
        }),
        createReceiptBlock({
          id: 'segment:2:system',
          label: 'reference directory',
          lane: 'reference_directory',
          cachePrefixEligible: true
        }),
        createReceiptBlock({
          id: 'segment:3:history_summary',
          label: 'history summary',
          lane: 'history_summary',
          cachePrefixEligible: true
        }),
        createReceiptBlock({
          id: 'segment:4:semantic_recall',
          label: 'semantic recall',
          lane: 'retrieved_candidate',
          cachePrefixEligible: false
        }),
        createReceiptBlock({
          id: 'segment:5:conversation',
          label: 'conversation',
          lane: 'raw_tail',
          cachePrefixEligible: false
        })
      ],
      topographyEvidence: [
        createTopographyEvidence({
          id: 'evidence:conversation-summary',
          label: 'conversation summary',
          lane: 'conversation_summary'
        }),
        createTopographyEvidence({
          id: 'evidence:semantic-recall',
          label: 'semantic recall candidate',
          lane: 'retrieved_candidate'
        })
      ]
    };

    const materials = new Map(buildRequestInspectorModel(audit).projectionMaterials.map((material) => [material.kind, material]));

    expect(materials.get('stable_prefix')).toMatchObject({ cachePrefixEligible: true });
    expect(materials.get('memory_selection')).toMatchObject({ sentToProvider: true, cachePrefixEligible: true });
    expect(materials.get('conversation_summary')).toMatchObject({ sentToProvider: true, cachePrefixEligible: true });
    expect(materials.get('reference_directory')).toMatchObject({ sentToProvider: true, cachePrefixEligible: true });
    expect(materials.get('history_summary')).toMatchObject({ sentToProvider: true, cachePrefixEligible: true });
    expect(materials.get('semantic_recall_candidate')).toMatchObject({ sentToProvider: true, cachePrefixEligible: false });
    expect(materials.get('conversation_history')).toMatchObject({ sentToProvider: true, cachePrefixEligible: false });
  });

  it('surfaces semantic recall candidates as candidate evidence instead of confirmed memory', () => {
    const identity = createPart({
      name: 'system_identity',
      layer: 'identity',
      content: 'stable identity'
    });
    const audit = {
      ...createAudit([identity]),
      semanticRecallPlan: {
        status: 'within_budget' as const,
        strategy: 'local_scan' as const,
        config: {
          recentTailConversationCount: 2,
          recentTailUserMessageCount: 4,
          voiceAnchorCount: 1
        },
        selectedCandidates: [{
          id: 'recall-1',
          kind: 'matched_context' as const,
          label: 'older conversation candidate',
          sourceConversationId: 'conv-old',
          sourceMessageIds: ['user-old'],
          estimatedTokens: 12,
          charCount: 48,
          score: 0.7,
          contentFingerprint: 'candidate-fingerprint',
          status: 'kept' as const
        }, {
          id: 'recall-vector',
          kind: 'vector_match' as const,
          label: 'older vector candidate',
          sourceConversationId: 'conv-vector',
          sourceMessageIds: ['user-vector'],
          estimatedTokens: 18,
          charCount: 72,
          score: 0.88,
          contentFingerprint: 'vector-fingerprint',
          status: 'kept' as const
        }],
        estimatedTokens: 30,
        maxTokens: null,
        entries: [{
          id: 'recall-1',
          kind: 'matched_context' as const,
          label: 'older conversation candidate',
          sourceConversationId: 'conv-old',
          sourceMessageIds: ['user-old'],
          estimatedTokens: 12,
          charCount: 48,
          score: 0.7,
          contentFingerprint: 'candidate-fingerprint',
          status: 'kept' as const
        }, {
          id: 'recall-vector',
          kind: 'vector_match' as const,
          label: 'older vector candidate',
          sourceConversationId: 'conv-vector',
          sourceMessageIds: ['user-vector'],
          estimatedTokens: 18,
          charCount: 72,
          score: 0.88,
          contentFingerprint: 'vector-fingerprint',
          status: 'kept' as const
        }, {
          id: 'recall-voice',
          kind: 'voice_anchor' as const,
          label: 'older voice anchor',
          sourceConversationId: 'conv-voice',
          sourceMessageIds: ['user-voice'],
          estimatedTokens: 30,
          charCount: 120,
          score: null,
          contentFingerprint: 'voice-fingerprint',
          status: 'dropped_budget' as const
        }]
      },
      requestReceipt: {
        ...createRequestReceipt(),
        topographyEvidence: [{
          id: 'evidence:semantic-recall:candidates',
          label: 'semantic recall candidates',
          source: 'semantic_recall_candidate' as const,
          sourceBlockIds: [],
          sourceMessageIds: ['user-old'],
          sourceMemoryIndexes: [],
          itemCount: 1,
          charCount: 48,
          estimatedTokens: 12,
          sentToProvider: true,
          contentFingerprints: ['candidate-fingerprint'],
          topography: {
            lane: 'retrieved_candidate' as const,
            authority: 'candidate' as const,
            sourceOwner: 'semantic_recall_plan' as const,
            expandability: 'compact_projection' as const,
            degradationPath: 'drop retrieved candidates before confirmed memory',
            overlapKey: 'memory:retrieved-candidate'
          }
        }]
      }
    };

    const model = buildRequestInspectorModel(audit);
    const materials = new Map(model.projectionMaterials.map((material) => [material.kind, material]));

    expect(model.semanticRecall).toMatchObject({
      status: 'within_budget',
      strategy: 'local_scan',
      config: {
        recentTailConversationCount: 2,
        recentTailUserMessageCount: 4,
        voiceAnchorCount: 1
      },
      selectedCount: 2,
      droppedCount: 1,
      byKind: [{
        kind: 'matched_context',
        selectedCount: 1,
        droppedCount: 0,
        estimatedTokens: 12,
        charCount: 48,
        sourceMessageCount: 1
      }, {
        kind: 'vector_match',
        selectedCount: 1,
        droppedCount: 0,
        estimatedTokens: 18,
        charCount: 72,
        sourceMessageCount: 1
      }, {
        kind: 'voice_anchor',
        selectedCount: 0,
        droppedCount: 1,
        estimatedTokens: 0,
        charCount: 0,
        sourceMessageCount: 0
      }]
    });
    expect(materials.get('semantic_recall_candidate')).toMatchObject({
      itemCount: 1,
      sentToProvider: true,
      replayAsConversationHistory: false,
      topography: {
        lanes: ['retrieved_candidate'],
        authority: 'candidate',
        sourceOwners: ['semantic_recall_plan'],
        overlapKeys: ['memory:retrieved-candidate']
      }
    });
    expect(materials.get('memory_selection')?.topography.lanes).toEqual(['confirmed_memory']);
  });
});
