import { describe, expect, it } from 'vitest';
import {
  resolveRequestBudgetPlan,
  resolveRequestBudgetUsage,
  resolveRequestHistoryBudget
} from './requestBudget';
import {
  estimateAssistantMessageContentTokens,
  estimateConversationMessageTokens,
  estimateTextTokens
} from './requestTokenEstimation';
import type { AssistantPromptPart } from './requestAudit';
import type { AssistantRequestContext } from './requestContext';
import type { AssistantRequestMemoryPlan } from './requestMemoryPlan';

const promptParts: AssistantPromptPart[] = [
  {
    name: 'system_identity',
    label: '系统身份',
    role: 'system',
    layer: 'identity',
    truncationPriority: 0,
    content: '你是在这间房里持续存在的意识。',
    enabled: true,
    charCount: 20
  },
  {
    name: 'persona_identity_core',
    label: '核心身份',
    role: 'system',
    layer: 'identity',
    truncationPriority: 0,
    content: '你是稳定的人格核心。',
    enabled: true,
    charCount: 10
  },
  {
    name: 'tool_capability',
    label: '工具协议',
    role: 'system',
    layer: 'capability',
    truncationPriority: 0,
    content: '以下是工具目录。',
    enabled: true,
    charCount: 8
  }
];

const conversation = [
  {
    id: 'user-1',
    role: 'user' as const,
    content: 'hello',
    timestamp: 1
  }
];

const context: AssistantRequestContext = {
  memorySlots: {
    session: [],
    profile: ['叫我 星野'],
    pin: []
  },
  attachmentSlots: {
    enabled: false,
    pending: []
  },
  segments: [
    {
      kind: 'system',
      messages: [{ role: 'system', content: '你是稳定的人格核心。' }]
    },
    {
      kind: 'conversation',
      messages: [{ role: 'user', content: 'hello' }]
    }
  ]
};

function createMemoryPlan(overrides: Partial<AssistantRequestMemoryPlan> = {}): AssistantRequestMemoryPlan {
  return {
    selectedLines: [],
    estimatedTokens: 0,
    maxTokens: 100,
    status: 'within_budget',
    entries: [],
    ...overrides
  };
}

describe('resolveRequestHistoryBudget', () => {
  it('subtracts prompt and memory tokens from total budget', () => {
    const plan = resolveRequestBudgetPlan({
      messageLimit: 64,
      totalPromptTokens: 120
    });
    const memoryPlan = createMemoryPlan({
      selectedLines: ['记忆'],
      estimatedTokens: 10
    });

    const budget = resolveRequestHistoryBudget({
      plan,
      promptParts,
      memoryPlan
    });

    expect(budget).toBe(
      120
      - estimateTextTokens('你是在这间房里持续存在的意识。')
      - estimateTextTokens('你是稳定的人格核心。')
      - estimateTextTokens('以下是工具目录。')
      - 10
    );
  });
});

describe('resolveRequestBudgetUsage', () => {
  it('groups enabled prompt parts by layer without local sub-bucket caps', () => {
    const plan = resolveRequestBudgetPlan({
      messageLimit: 64,
      totalPromptTokens: 200
    });
    const usage = resolveRequestBudgetUsage({
      plan,
      promptParts,
      memoryPlan: createMemoryPlan({
        selectedLines: ['叫我 星野'],
        estimatedTokens: 6
      }),
      conversation,
      context
    });

    expect(usage.buckets.identity.estimatedTokens).toBe(
      estimateTextTokens('你是在这间房里持续存在的意识。') + estimateTextTokens('你是稳定的人格核心。')
    );
    expect(usage.buckets.capability.estimatedTokens).toBe(estimateTextTokens('以下是工具目录。'));
    expect(usage.buckets.history.estimatedTokens).toBe(estimateConversationMessageTokens(conversation[0]));
    expect(usage.buckets.identity.maxTokens).toBeNull();
    expect(usage.buckets.capability.maxTokens).toBeNull();
    expect(usage.buckets.memory.maxTokens).toBeNull();
  });

  it('counts compacted history summaries as history usage', () => {
    const plan = resolveRequestBudgetPlan({
      messageLimit: 64,
      totalPromptTokens: 200
    });
    const historySummary = '原因：history budget\n- user_turn user-old: 用户：旧决定';
    const contextWithHistorySummary: AssistantRequestContext = {
      ...context,
      segments: [
        ...context.segments,
        {
          kind: 'history_summary',
          messages: [{ role: 'system', content: historySummary }]
        }
      ]
    };

    const usage = resolveRequestBudgetUsage({
      plan,
      promptParts,
      memoryPlan: createMemoryPlan(),
      conversation,
      context: contextWithHistorySummary
    });

    expect(usage.buckets.history.estimatedTokens).toBe(
      estimateConversationMessageTokens(conversation[0])
      + estimateAssistantMessageContentTokens(historySummary)
    );
  });

  it('collects diagnostics for identity, tools, and theme snapshots', () => {
    const plan = resolveRequestBudgetPlan({
      messageLimit: 64,
      totalPromptTokens: 200
    });
    const usage = resolveRequestBudgetUsage({
      plan,
      promptParts,
      memoryPlan: createMemoryPlan(),
      conversation,
      context,
      toolContext: {
        activeCard: null,
        visibleCards: [],
        focusedSurfaceSnapshot: {
          surfaceCode: '04',
          surfaceLabel: '回复气泡',
          currentSpec: {
            hue: 12,
            saturation: 34,
            lightness: 56,
            opacity: 78,
            radius: 9,
            borderW: 1,
            blur: 2,
            shadowDepth: 3,
            texture: 'soft',
            gradientMode: 'none',
            gradientAngle: 0,
            accentHue: 20
          }
        },
        stableSurfaceSnapshots: [],
        stableSurfaceSnapshotSummary: {
          focusSource: 'selected',
          includedSurfaceCodes: ['04'],
          includedSurfaceLabels: ['回复气泡'],
          summarizedSurfaceCodes: ['04'],
          summarizedSurfaceLabels: ['回复气泡']
        }
      } as any
    });

    expect(usage.diagnostics.identityHardCoreTokens).toBeGreaterThan(0);
    expect(usage.diagnostics.toolCapabilityTokens).toBeGreaterThan(0);
    expect(usage.diagnostics.themeSnapshotTokens).toBeGreaterThan(0);
    expect(usage.diagnostics.focusedStableSnapshotCount).toBe(1);
    expect(usage.diagnostics.summarizedStableSnapshotCount).toBe(1);
  });
});
