import { describe, expect, it } from 'vitest';
import type { Conversation } from '../../types/domain';
import type { RequestDebugEntry } from '../../engines/request/requestDebugRuntime';
import { summarizeMenuTokenUsage } from './menuTokenUsage';

const testTopography = {
  lane: 'hard_rule' as const,
  authority: 'hard_rule' as const,
  sourceOwner: 'prompt_layers' as const,
  expandability: 'fixed' as const,
  degradationPath: 'test fixture',
  overlapKey: 'test:fixture'
};

function requestEntry(seed: {
  requestId: string;
  at: number;
  phase: RequestDebugEntry['phase'];
  providerName?: string;
  cachedInputTokens?: number;
  cacheMissInputTokens?: number;
  cacheCreationInputTokens?: number;
  duplicateInfoCount?: number;
  shrinkPlanCount?: number;
  shrinkPlanSavingsTokens?: number;
  stableHash?: string;
  dynamicHash?: string;
  toolHash?: string;
  taskLaneHash?: string;
  toolTokens?: number;
  taskTokens?: number;
  breakpointTokens?: number;
  breakpointHash?: string;
  identityBlockTokens?: number;
  identityBlockHash?: string;
  toolBlockTokens?: number;
  toolBlockHash?: string;
}): RequestDebugEntry {
  return {
    requestId: seed.requestId,
    at: seed.at,
    phase: seed.phase,
    assistantName: '灯塔',
    providerId: 'provider-a',
    providerName: seed.providerName ?? 'Packy',
    modelId: 'model-a',
    inspector: {} as RequestDebugEntry['inspector'],
    promptParts: [],
    contextSummary: {
      segmentKinds: [],
      memoryProfileCount: 0,
      conversationSummaryCount: 0,
      semanticRecallCandidateCount: 0,
      attachmentCount: 0
    },
    timings: {} as RequestDebugEntry['timings'],
    tooling: {
      enabled: true,
      toolCount: 1,
      toolChoice: 'auto',
      toolNames: ['createCodeCard']
    },
    requestReceipt: {
      schemaVersion: 1,
      fingerprints: {
        stablePrompt: seed.stableHash ?? 'stable-hash',
        dynamicContext: seed.dynamicHash ?? 'dynamic-hash',
        toolCapabilities: seed.toolHash ?? 'tool-hash',
        conversationTail: 'tail-hash',
        fullRequest: `full-${seed.requestId}`
      },
      cache: {
        applicationStatus: 'provider_automatic_or_unknown',
        sendsExplicitCacheControl: false,
        breakpoints: [{
          name: 'identity_prefix',
          eligible: true,
          estimatedTokens: seed.breakpointTokens ?? 2048,
          reason: null,
          fingerprint: seed.breakpointHash ?? 'breakpoint-hash'
        }]
      },
      blocks: [
        {
          id: 'prompt:system_identity',
          label: '系统身份',
          intent: 'identity',
          source: 'prompt_part',
          itemCount: 1,
          charCount: 120,
          estimatedTokens: seed.identityBlockTokens ?? 96,
          fingerprint: seed.identityBlockHash ?? 'identity-block-hash',
          cachePrefixEligible: true,
          sentToProvider: true,
          topography: testTopography,
          partNames: ['system_identity']
        },
        {
          id: 'prompt:tool_catalog_capability',
          label: '工具目录',
          intent: 'tool_capability',
          source: 'prompt_part',
          itemCount: 1,
          charCount: 160,
          estimatedTokens: seed.toolBlockTokens ?? 128,
          fingerprint: seed.toolBlockHash ?? 'tool-block-hash',
          cachePrefixEligible: true,
          sentToProvider: true,
          topography: {
            ...testTopography,
            lane: 'tool_schema',
            authority: 'high',
            sourceOwner: 'tool_registry',
            expandability: 'schema',
            overlapKey: 'test:tool'
          },
          partNames: ['tool_catalog_capability']
        }
      ],
      topographyEvidence: [],
      topographyEvidenceOverlap: [],
      duplicateInfo: Array.from({ length: seed.duplicateInfoCount ?? 0 }, (_, index) => ({
        fingerprint: `dupe-${index}`,
        count: 2,
        labels: ['a', 'b'],
        blockIds: ['a', 'b'],
        totalChars: 20
      })),
      topographyOverlap: [],
      shrinkPlan: Array.from({ length: seed.shrinkPlanCount ?? 0 }, (_, index) => ({
        planId: `shrink-${index}`,
        overlapKey: 'test:tool',
        strategy: 'exact_duplicate',
        confidence: 'high',
        reason: 'test shrink plan',
        keepBlockIds: ['prompt:tool_catalog_capability'],
        candidateDropBlockIds: ['prompt:system_identity'],
        estimatedSavingsTokens: seed.shrinkPlanSavingsTokens ?? 24,
        affectedLanes: ['tool_schema'],
        affectedLabels: ['工具目录', '系统身份']
      })),
      intentLanes: [
        {
          intent: 'tool_capability',
          blockCount: 2,
          estimatedTokens: seed.toolTokens ?? 128,
          fingerprints: [seed.toolHash ?? 'tool-hash']
        },
        {
          intent: 'task_context',
          blockCount: 1,
          estimatedTokens: seed.taskTokens ?? 64,
          fingerprints: [seed.taskLaneHash ?? 'task-hash']
        }
      ]
    },
    responseSummary: {
      usedNativeToolCalls: false,
      nativeToolCallCount: 0,
      tokenCount: null,
      tokenUsage: seed.cachedInputTokens !== undefined || seed.cacheMissInputTokens !== undefined || seed.cacheCreationInputTokens !== undefined
        ? {
            inputTokens: 100,
            cachedInputTokens: seed.cachedInputTokens,
            cacheMissInputTokens: seed.cacheMissInputTokens,
            cacheCreationInputTokens: seed.cacheCreationInputTokens
          }
        : null,
      error: null
    },
    outboundRequest: null
  };
}

describe('summarizeMenuTokenUsage', () => {
  it('sums assistant token and cache usage from saved messages', () => {
    const conversations: Conversation[] = [{
      id: 'c-1',
      title: '测试对话',
      collaboratorId: 'p-1',
      activeProjectId: null,
      pinnedAt: null,
      updatedAt: 2,
      messages: [
        {
          id: 'u-1',
          role: 'user',
          content: 'hello',
          timestamp: 1
        },
        {
          id: 'a-1',
          role: 'assistant',
          content: 'reply',
          timestamp: 2,
          providerName: 'Packy',
          model: 'model-a',
          assistantName: '灯塔',
          tokenUsage: {
            totalTokens: 120,
            inputTokens: 80,
            outputTokens: 40,
            cachedInputTokens: 20,
            cacheMissInputTokens: 60,
            cacheCreationInputTokens: 10,
            reasoningTokens: 5
          }
        },
        {
          id: 'a-tool',
          role: 'assistant',
          content: '',
          timestamp: 3,
          tokenCount: 999,
          toolInvocation: {
            id: 'tool-1',
            kind: 'runCode',
            title: '运行代码',
            summary: 'ok',
            status: 'executed'
          }
        }
      ]
    }];

    expect(summarizeMenuTokenUsage(conversations)).toEqual({
      replyCount: 1,
      requestReceiptCount: 0,
      totalTokens: 120,
      inputTokens: 80,
      outputTokens: 40,
      cachedInputTokens: 20,
      cacheMissInputTokens: 60,
      cacheObservedInputTokens: 80,
      cacheCreationInputTokens: 10,
      cacheReportedReplyCount: 1,
      cacheUnreportedReplyCount: 0,
      cacheZeroReadReplyCount: 0,
      reasoningTokens: 5,
      cacheEligibleRequestCount: 0,
      duplicateInfoGroupCount: 0,
      shrinkPlanCount: 0,
      shrinkPlanSavingsTokens: 0,
      providerGroups: [{
        id: 'Packy',
        providerName: 'Packy',
        modelNames: ['model-a'],
        assistantNames: ['灯塔'],
        replyCount: 1,
        latestTimestamp: 2,
        totalTokens: 120,
        inputTokens: 80,
        outputTokens: 40,
        cachedInputTokens: 20,
        cacheMissInputTokens: 60,
        cacheObservedInputTokens: 80,
        cacheCreationInputTokens: 10,
        cacheReportedReplyCount: 1,
        cacheUnreportedReplyCount: 0,
        cacheZeroReadReplyCount: 0,
        reasoningTokens: 5
      }],
      modelGroups: [{
        id: 'model-a',
        model: 'model-a',
        assistantNames: ['灯塔'],
        replyCount: 1,
        latestTimestamp: 2,
        totalTokens: 120,
        inputTokens: 80,
        outputTokens: 40,
        cachedInputTokens: 20,
        cacheMissInputTokens: 60,
        cacheObservedInputTokens: 80,
        cacheCreationInputTokens: 10,
        cacheReportedReplyCount: 1,
        cacheUnreportedReplyCount: 0,
        cacheZeroReadReplyCount: 0,
        reasoningTokens: 5
      }],
      recentEntries: [{
        id: 'c-1:a-1',
        conversationTitle: '测试对话',
        assistantName: '灯塔',
        providerName: 'Packy',
        model: 'model-a',
        timestamp: 2,
        usage: {
          totalTokens: 120,
          inputTokens: 80,
          outputTokens: 40,
          cachedInputTokens: 20,
          cacheMissInputTokens: 60,
          cacheCreationInputTokens: 10,
          reasoningTokens: 5
        },
        cacheReportStatus: 'reported'
      }],
      recentRequestReceipts: [],
      requestTrends: []
    });
  });

  it('keeps legacy tokenCount messages visible in the usage page', () => {
    const conversations: Conversation[] = [{
      id: 'c-1',
      title: '旧消息',
      collaboratorId: 'p-1',
      activeProjectId: null,
      pinnedAt: null,
      updatedAt: 1,
      messages: [{
        id: 'a-1',
        role: 'assistant',
        content: 'legacy',
        timestamp: 1,
        tokenCount: 88
      }]
    }];

    const summary = summarizeMenuTokenUsage(conversations);
    expect(summary.totalTokens).toBe(88);
    expect(summary.recentEntries[0]?.usage.totalTokens).toBe(88);
    expect(summary.modelGroups[0]).toMatchObject({
      model: '未知模型',
      replyCount: 1,
      totalTokens: 88
    });
  });

  it('groups saved usage by model for user-facing usage review', () => {
    const conversations: Conversation[] = [{
      id: 'c-1',
      title: '模型分组',
      collaboratorId: 'p-1',
      activeProjectId: null,
      pinnedAt: null,
      updatedAt: 4,
      messages: [
        {
          id: 'a-1',
          role: 'assistant',
          content: 'first',
          timestamp: 1,
          assistantName: '小助手',
          providerName: 'Packy',
          model: 'mimo-v2.5-pro',
          tokenUsage: {
            totalTokens: 100,
            inputTokens: 70,
            outputTokens: 30,
            cachedInputTokens: 40,
            cacheMissInputTokens: 30
          }
        },
        {
          id: 'a-2',
          role: 'assistant',
          content: 'second',
          timestamp: 2,
          assistantName: 'Lyra',
          providerName: 'OpenAI',
          model: 'gpt-5.5',
          tokenUsage: {
            totalTokens: 300,
            inputTokens: 220,
            outputTokens: 80,
            reasoningTokens: 15
          }
        },
        {
          id: 'a-3',
          role: 'assistant',
          content: 'third',
          timestamp: 3,
          assistantName: '小助手',
          providerName: 'Packy',
          model: 'mimo-v2.5-pro',
          tokenUsage: {
            totalTokens: 120,
            inputTokens: 90,
            outputTokens: 30,
            cachedInputTokens: 60,
            cacheMissInputTokens: 30,
            cacheCreationInputTokens: 8
          }
        }
      ]
    }];

    const summary = summarizeMenuTokenUsage(conversations);

    expect(summary.providerGroups.map((group) => group.providerName)).toEqual(['OpenAI', 'Packy']);
    expect(summary.providerGroups.find((group) => group.providerName === 'Packy')).toMatchObject({
      modelNames: ['mimo-v2.5-pro'],
      assistantNames: ['小助手'],
      replyCount: 2,
      totalTokens: 220
    });
    expect(summary.modelGroups.map((group) => group.model)).toEqual(['gpt-5.5', 'mimo-v2.5-pro']);
    expect(summary.modelGroups.find((group) => group.model === 'mimo-v2.5-pro')).toMatchObject({
      assistantNames: ['小助手'],
      replyCount: 2,
      latestTimestamp: 3,
      totalTokens: 220,
      inputTokens: 160,
      outputTokens: 60,
      cachedInputTokens: 100,
      cacheMissInputTokens: 60,
      cacheObservedInputTokens: 160,
      cacheCreationInputTokens: 8,
      cacheReportedReplyCount: 2,
      cacheUnreportedReplyCount: 0,
      cacheZeroReadReplyCount: 0
    });
    expect(summary.modelGroups.find((group) => group.model === 'gpt-5.5')).toMatchObject({
      assistantNames: ['Lyra'],
      replyCount: 1,
      cacheReportedReplyCount: 0,
      cacheUnreportedReplyCount: 1,
      reasoningTokens: 15
    });
  });

  it('separates missing cache reports from reported zero cache reads', () => {
    const conversations: Conversation[] = [{
      id: 'c-1',
      title: '缓存口径',
      collaboratorId: 'p-1',
      activeProjectId: null,
      pinnedAt: null,
      updatedAt: 3,
      messages: [
        {
          id: 'a-unreported',
          role: 'assistant',
          content: 'no cache fields',
          timestamp: 1,
          providerName: 'OpenAI',
          model: 'gpt-5.5',
          tokenUsage: {
            totalTokens: 140,
            inputTokens: 100,
            outputTokens: 40
          }
        },
        {
          id: 'a-zero',
          role: 'assistant',
          content: 'reported zero cache read',
          timestamp: 2,
          providerName: 'OpenAI',
          model: 'gpt-5.5',
          tokenUsage: {
            totalTokens: 150,
            inputTokens: 120,
            outputTokens: 30,
            cachedInputTokens: 0,
            cacheMissInputTokens: 120
          }
        }
      ]
    }];

    const summary = summarizeMenuTokenUsage(conversations);

    expect(summary).toMatchObject({
      replyCount: 2,
      inputTokens: 220,
      cachedInputTokens: 0,
      cacheMissInputTokens: 120,
      cacheObservedInputTokens: 120,
      cacheReportedReplyCount: 1,
      cacheUnreportedReplyCount: 1,
      cacheZeroReadReplyCount: 1
    });
    expect(summary.recentEntries.map((entry) => [entry.id, entry.cacheReportStatus])).toEqual([
      ['c-1:a-zero', 'reported'],
      ['c-1:a-unreported', 'not_reported']
    ]);
    expect(summary.modelGroups[0]).toMatchObject({
      model: 'gpt-5.5',
      cacheReportedReplyCount: 1,
      cacheUnreportedReplyCount: 1,
      cacheZeroReadReplyCount: 1
    });
  });

  it('dedupes request receipts by request id and keeps the latest phase', () => {
    const summary = summarizeMenuTokenUsage([], [
      requestEntry({ requestId: 'req-1', at: 1, phase: 'prepared', duplicateInfoCount: 1 }),
      requestEntry({ requestId: 'req-1', at: 2, phase: 'completed', cachedInputTokens: 60, cacheMissInputTokens: 40, duplicateInfoCount: 2 }),
      requestEntry({ requestId: 'req-2', at: 3, phase: 'prepared' })
    ]);

    expect(summary.requestReceiptCount).toBe(2);
    expect(summary.cacheEligibleRequestCount).toBe(2);
    expect(summary.duplicateInfoGroupCount).toBe(2);
    expect(summary.shrinkPlanCount).toBe(0);
    expect(summary.shrinkPlanSavingsTokens).toBe(0);
    expect(summary.recentRequestReceipts.map((entry) => [entry.requestId, entry.phase])).toEqual([
      ['req-2', 'prepared'],
      ['req-1', 'completed']
    ]);
    expect(summary.recentRequestReceipts[1]?.tokenUsage?.cachedInputTokens).toBe(60);
    expect(summary.requestTrends).toHaveLength(1);
    expect(summary.requestTrends[0]).toMatchObject({
      assistantName: '灯塔',
      modelId: 'model-a',
      requestCount: 2
    });
  });

  it('marks request receipts with input usage but no cache fields as unreported', () => {
    const summary = summarizeMenuTokenUsage([], [
      {
        ...requestEntry({ requestId: 'req-no-cache-report', at: 1, phase: 'completed' }),
        responseSummary: {
          usedNativeToolCalls: false,
          nativeToolCallCount: 0,
          tokenCount: null,
          tokenUsage: {
            totalTokens: 130,
            inputTokens: 100,
            outputTokens: 30
          },
          error: null
        }
      }
    ]);

    expect(summary.recentRequestReceipts[0]).toMatchObject({
      requestId: 'req-no-cache-report',
      cacheReportStatus: 'not_reported',
      judgement: {
        cacheReadRate: null
      }
    });
    expect(summary.requestTrends[0]?.averageCacheReadRate).toBeNull();
    expect(summary.requestTrends[0]?.recentRequests[0]).toMatchObject({
      requestId: 'req-no-cache-report',
      cacheReportStatus: 'not_reported'
    });
  });

  it('keeps older persisted request receipts from crashing the settings usage summary', () => {
    const legacyEntry = requestEntry({
      requestId: 'legacy-req',
      at: 1,
      phase: 'completed',
      stableHash: 'legacy-stable',
      dynamicHash: 'legacy-dynamic',
      toolHash: 'legacy-tool'
    }) as unknown as {
      requestReceipt: Omit<Partial<RequestDebugEntry['requestReceipt']>, 'cache' | 'blocks' | 'duplicateInfo'> & {
        cache?: RequestDebugEntry['requestReceipt']['cache'];
        blocks?: RequestDebugEntry['requestReceipt']['blocks'];
        topographyEvidence?: RequestDebugEntry['requestReceipt']['topographyEvidence'];
        topographyEvidenceOverlap?: RequestDebugEntry['requestReceipt']['topographyEvidenceOverlap'];
        duplicateInfo?: RequestDebugEntry['requestReceipt']['duplicateInfo'];
      };
      responseSummary: Partial<RequestDebugEntry['responseSummary']>;
    };
    delete legacyEntry.requestReceipt.cache;
    delete legacyEntry.requestReceipt.blocks;
    delete legacyEntry.requestReceipt.topographyEvidence;
    delete legacyEntry.requestReceipt.topographyEvidenceOverlap;
    delete legacyEntry.requestReceipt.duplicateInfo;
    delete legacyEntry.requestReceipt.topographyOverlap;
    delete legacyEntry.requestReceipt.shrinkPlan;
    delete legacyEntry.responseSummary.tokenUsage;

    const summary = summarizeMenuTokenUsage([], [legacyEntry as RequestDebugEntry]);

    expect(summary.requestReceiptCount).toBe(1);
    expect(summary.cacheEligibleRequestCount).toBe(0);
    expect(summary.duplicateInfoGroupCount).toBe(0);
    expect(summary.recentRequestReceipts[0]).toMatchObject({
      requestId: 'legacy-req',
      cacheStatus: 'not_applied',
      cacheBreakpoints: [],
      cachePrefixBlocks: [],
      duplicateInfoCount: 0,
      shrinkPlanCount: 0,
      shrinkPlanSavingsTokens: 0,
      shrinkPlans: [],
      tokenUsage: null
    });
  });

  it('adds passive judgement against the previous request on the same assistant and model lane', () => {
    const summary = summarizeMenuTokenUsage([], [
      requestEntry({
        requestId: 'req-1',
        at: 1,
        phase: 'completed',
        cachedInputTokens: 20,
        cacheMissInputTokens: 80,
        duplicateInfoCount: 1,
        shrinkPlanCount: 1,
        shrinkPlanSavingsTokens: 30
      }),
      requestEntry({
        requestId: 'req-2',
        at: 2,
        phase: 'completed',
        cachedInputTokens: 50,
        cacheMissInputTokens: 50,
        duplicateInfoCount: 3,
        shrinkPlanCount: 2,
        shrinkPlanSavingsTokens: 40,
        dynamicHash: 'dynamic-next',
        taskLaneHash: 'task-next',
        taskTokens: 96,
        breakpointTokens: 2304,
        breakpointHash: 'breakpoint-next',
        identityBlockTokens: 128,
        identityBlockHash: 'identity-block-next'
      }),
      requestEntry({
        requestId: 'req-3',
        at: 3,
        phase: 'completed',
        toolHash: 'tool-next',
        toolTokens: 160,
        toolBlockTokens: 160,
        toolBlockHash: 'tool-block-next',
        duplicateInfoCount: 3,
        shrinkPlanCount: 1,
        shrinkPlanSavingsTokens: 50
      })
    ]);

    const [latest, changedDynamic, first] = summary.recentRequestReceipts;

    expect(first?.judgement).toMatchObject({
      stablePrompt: 'unknown',
      dynamicContext: 'unknown',
      toolCapabilities: 'unknown',
      duplicateInfoDelta: null
    });
    expect(changedDynamic?.judgement).toMatchObject({
      stablePrompt: 'same',
      dynamicContext: 'changed',
      toolCapabilities: 'same',
      changedDynamicIntents: ['task_context'],
      cacheReadRate: 0.5,
      duplicateInfoDelta: 2
    });
    expect(changedDynamic?.cacheBreakpoints[0]).toMatchObject({
      name: 'identity_prefix',
      estimatedTokens: 2304,
      deltaTokens: 256,
      fingerprintStatus: 'changed'
    });
    expect(changedDynamic?.cachePrefixBlocks.find((block) => block.id === 'prompt:system_identity')).toMatchObject({
      label: '系统身份',
      estimatedTokens: 128,
      deltaTokens: 32,
      fingerprintStatus: 'changed'
    });
    expect(latest?.judgement).toMatchObject({
      stablePrompt: 'same',
      toolCapabilities: 'changed',
      duplicateInfoDelta: 0
    });
    expect(summary.requestTrends[0]).toMatchObject({
      requestCount: 3,
      stableChangedCount: 0,
      dynamicChangedCount: 2,
      toolChangedCount: 1,
      duplicateInfoDeltaTotal: 2
    });
    expect(summary.shrinkPlanCount).toBe(4);
    expect(summary.shrinkPlanSavingsTokens).toBe(160);
    expect(summary.requestTrends[0]?.averageCacheReadRate).toBeCloseTo(0.35);
    expect(summary.requestTrends[0]?.recentRequests.map((request) => request.requestId)).toEqual([
      'req-1',
      'req-2',
      'req-3'
    ]);
    expect(summary.requestTrends[0]?.latestIntentBreakdown).toEqual([
      {
        intent: 'tool_capability',
        blockCount: 2,
        estimatedTokens: 160,
        deltaTokens: 32
      },
      {
        intent: 'task_context',
        blockCount: 1,
        estimatedTokens: 64,
        deltaTokens: -32
      }
    ]);
    const latestTrendRequest = summary.requestTrends[0]?.recentRequests[2];
    expect(latestTrendRequest).toMatchObject({
      fingerprints: {
        toolCapabilities: 'tool-next'
      },
      changedDynamicIntents: ['task_context'],
      duplicateInfoCount: 3,
      shrinkPlanCount: 1,
      shrinkPlanSavingsTokens: 50,
      cacheEligibleBreakpoints: 1
    });
    expect(latestTrendRequest?.shrinkPlans[0]).toMatchObject({
      strategy: 'exact_duplicate',
      confidence: 'high',
      keepBlockLabels: ['工具目录'],
      candidateDropBlockLabels: ['系统身份']
    });
    expect(latestTrendRequest?.cacheBreakpoints[0]).toMatchObject({
      estimatedTokens: 2048,
      deltaTokens: -256,
      fingerprintStatus: 'changed'
    });
    expect(latestTrendRequest?.cachePrefixBlocks.find((block) => block.id === 'prompt:tool_catalog_capability')).toMatchObject({
      label: '工具目录',
      estimatedTokens: 160,
      deltaTokens: 32,
      fingerprintStatus: 'changed'
    });
    expect(summary.requestTrends[0]?.latestCacheBreakpoints[0]).toMatchObject({
      estimatedTokens: 2048,
      deltaTokens: -256
    });
    expect(summary.requestTrends[0]?.latestCachePrefixBlocks).toEqual(latestTrendRequest?.cachePrefixBlocks);
    expect(latestTrendRequest?.intentBreakdown.find((lane) => lane.intent === 'tool_capability')).toMatchObject({
      intent: 'tool_capability',
      estimatedTokens: 160,
      deltaTokens: 32
    });
  });
});
