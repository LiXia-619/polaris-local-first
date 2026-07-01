import { mkdir, writeFile } from 'node:fs/promises';
import { buildProviderPresetPatch, findProviderPreset } from '../src/config/catalog/providerCatalog';
import { createPersonaTemplate } from '../src/config/persona/personaBuilder';
import { buildApiRequest } from '../src/engines/chat-api/chatApiRequestBuilder';
import { createStreamingReplyCollector } from '../src/engines/chat-api/chatApiStreamingCollector';
import { extractAnthropicReply, extractOpenAiCompatibleReply } from '../src/engines/provider-runtime/providerRuntimeResponsePayload';
import { inferProviderProtocol } from '../src/engines/providerProtocol';
import type { AssistantReply, AssistantReplyProgress } from '../src/engines/chat-api/chatApiTypes';
import type { AssistantRequestCachePlan } from '../src/engines/request/requestCachePlan';
import { prepareCollaboratorReplyRequest } from '../src/engines/request/requestPreparation';
import type { AssistantToolContext } from '../src/engines/tool-protocol/assistantToolProtocolTypes';
import { parseAssistantReplyContent } from '../src/app/chat/chatReplyContent';
import type {
  ChatMessage,
  ChatTokenUsage,
  Persona,
  ProjectFileEffect,
  ProjectFileFact,
  ProjectFileReadEvidence,
  ProviderProfile,
  ToolInvocation
} from '../src/types/domain';
import { OUTPUT_STABILITY_CASES, type OutputStabilityCase } from './chat-output-stability-monitor-cases';
import {
  loadValidationLocalEnv,
  parseCsv,
  resolveValidationApiKey,
  resolveValidationModels,
  resolveValidationProviderMeta
} from './validation-monitor-shared';

loadValidationLocalEnv();

const key = resolveValidationApiKey();
if (!key) {
  throw new Error('missing validation API key');
}

const ANALYSIS_STANDARD_VERSION = '2026-03-31-output-monitor-v1';
const ANALYSIS_STANDARD = {
  fix: {
    appliesWhen: '请求预算或 Polaris 自己的解析/显示链让正文掉得不合理，或流式过程中明明出来了，最后却被自己收没了。',
    meaning: '这是 Polaris 结构问题，优先找根因修，不做补丁兜底。'
  },
  optimize: {
    appliesWhen: '模型端没给够正文、被 thinking 吃掉、被工具诱导偏航，或供应商流式稳定性本身差。',
    meaning: '这是模型或接入策略问题，先积累样本，再做 prompt、protocol、profile 优化。'
  },
  record: {
    appliesWhen: '这轮证据还不够，或者是纯 transport / 限流 / 偶发失败。',
    meaning: '先记账，等模式更清楚再决定归 fix 还是 optimize。'
  }
};

type ProfileConfig = {
  id: string;
  label: string;
  toolsEnabled: boolean;
  streaming: boolean;
  thinkingBudget: string;
};

const PROFILE_REGISTRY: Record<string, ProfileConfig> = {
  baseline: {
    id: 'baseline',
    label: 'tools-off / stream-on',
    toolsEnabled: false,
    streaming: true,
    thinkingBudget: ''
  },
  tools_on: {
    id: 'tools_on',
    label: 'tools-on / stream-on',
    toolsEnabled: true,
    streaming: true,
    thinkingBudget: ''
  },
  no_stream: {
    id: 'no_stream',
    label: 'tools-off / stream-off',
    toolsEnabled: false,
    streaming: false,
    thinkingBudget: ''
  },
  tools_on_no_stream: {
    id: 'tools_on_no_stream',
    label: 'tools-on / stream-off',
    toolsEnabled: true,
    streaming: false,
    thinkingBudget: ''
  },
  thinking_on: {
    id: 'thinking_on',
    label: 'tools-off / stream-on / thinking-on',
    toolsEnabled: false,
    streaming: true,
    thinkingBudget: '1024'
  }
};

const MODEL_REGISTRY = {
  small: { id: 'Qwen/Qwen2.5-7B-Instruct', tier: 'small' },
  medium: { id: 'deepseek-ai/DeepSeek-V3', tier: 'medium' },
  strong: { id: 'moonshotai/Kimi-K2-Thinking', tier: 'strong' },
  mimo: { id: 'mimo-v2.5-pro', tier: 'strong' },
  mimo_25_pro: { id: 'mimo-v2.5-pro', tier: 'strong' },
  mimo_pro: { id: 'mimo-v2-pro', tier: 'medium' },
  mimo_omni: { id: 'mimo-v2-omni', tier: 'medium' },
  mimo_flash: { id: 'mimo-v2-flash', tier: 'small' }
} as const;

const api =
  process.env.VALIDATION_API
  ?? process.env.OPENROUTER_API
  ?? process.env.SILICON_API
  ?? 'https://api.siliconflow.cn/v1/chat/completions';
const provider = resolveValidationProviderMeta(api, process.env.PROVIDER_LABEL);
const outDir = process.env.OUT_DIR ?? 'tmp/chat-output-stability-monitor';
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 120000);
const rounds = Number(process.env.ROUNDS ?? 2);
const concurrency = Number(process.env.CONCURRENCY ?? 2);
const caseFilter = parseCsv(process.env.CASE_IDS);
const categoryFilter = parseCsv(process.env.CATEGORIES);
const profileFilter = parseCsv(process.env.PROFILES);
const selectedCases = OUTPUT_STABILITY_CASES.filter((entry) => {
  const categoryMatch = categoryFilter.length === 0 || categoryFilter.includes(entry.category);
  const caseMatch = caseFilter.length === 0 || caseFilter.includes(entry.id);
  return categoryMatch && caseMatch;
});
const selectedProfiles = parseCsv(process.env.PROFILES || 'baseline,tools_on,no_stream,tools_on_no_stream,thinking_on')
  .map((id: string) => PROFILE_REGISTRY[id])
  .filter((profile: ProfileConfig | undefined): profile is ProfileConfig => Boolean(profile))
  .filter((profile: ProfileConfig) => profileFilter.length === 0 || profileFilter.includes(profile.id));
const models = resolveValidationModels(
  process.env.VALIDATION_MODELS ?? process.env.MODELS,
  MODEL_REGISTRY,
  'small,medium'
);

const jobs: Array<{
  model: { id: string; tier: 'small' | 'medium' | 'strong' };
  profile: ProfileConfig;
  round: number;
  testCase: OutputStabilityCase;
}> = [];

for (const model of models) {
  for (const profile of selectedProfiles) {
    for (let round = 1; round <= rounds; round += 1) {
      for (const testCase of selectedCases) {
        if (testCase.requiresTools && !profile.toolsEnabled) continue;
        jobs.push({ model, profile, round, testCase });
      }
    }
  }
}

await mkdir(outDir, { recursive: true });

let cursor = 0;
const results: OutputRunResult[] = [];

async function worker() {
  while (cursor < jobs.length) {
    const index = cursor;
    cursor += 1;
    results.push(await runOne(jobs[index]));
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const report = {
  reportKind: 'chat-output-stability-monitor',
  generatedAt: new Date().toISOString(),
  analysisStandardVersion: ANALYSIS_STANDARD_VERSION,
  analysisStandard: ANALYSIS_STANDARD,
  provider,
  api,
  requestTimeoutMs,
  rounds,
  summary: buildSummary(results),
  comparisons: buildComparisons(results),
  results
};

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = `${outDir}/chat-output-stability-monitor-${timestamp}.json`;
await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(renderSummary(report.summary));
console.log(`\nJSON -> ${outputPath}`);

type OutputRunResult = {
  model: string;
  tier: 'small' | 'medium' | 'strong';
  round: number;
  caseId: string;
  category: string;
  historyProfile: string;
  profile: string;
  profileLabel: string;
  requestPrepared: {
    preflightStatus: string;
    estimatedTokens: number;
    budgetTokens: number;
    toolCapabilityTokens: number;
    themeSnapshotTokens: number;
    toolCount: number;
    toolChoice: string | null;
    droppedHistoryCount: number;
    droppedMessageLimitCount: number;
    cache: {
      status: string;
      label: string;
      sendsExplicitCacheControl: boolean;
      breakpoints: Array<{
        name: string;
        estimatedTokens: number;
        minimumTokens: number;
        enabled: boolean;
        eligible: boolean;
        reason: string | null;
      }>;
    };
  };
  transport: {
    streamRequested: boolean;
    requestTimeoutMs: number;
    ok: boolean;
    http: number;
    error: string | null;
    latencyMs: number;
    progressCount: number;
    maxProgressVisibleChars: number;
    maxProgressRawChars: number;
  };
  reply: {
    rawChars: number;
    visibleChars: number;
    thinkingChars: number;
    tokenCount: number | null;
    tokenUsage: ChatTokenUsage | null;
    parsedIssueCount: number;
    declaredActionKinds: string[];
    declaredActionPreviews: string[];
    nativeToolCallPreviews: string[];
    hasCodeFence: boolean;
    requiredPatternsHit: string[];
    missingRequiredPatterns: string[];
    rawPreview: string;
    thinkingPreview: string;
    visiblePreview: string;
  };
  evaluation: {
    passed: boolean;
    expectedVisibleEnough: boolean;
    expectedPatternsEnough: boolean;
    acceptedToolPathUsed: boolean;
    completionToolPathUsed: boolean;
    expectedCompletionTurnsEnough: boolean;
    unexpectedToolDrift: boolean;
  };
  diagnosis: {
    owner: 'polaris' | 'model' | 'record' | 'pass';
    kind: string;
    note: string;
    confidence: number;
  };
  evidence: {
    progressExceededFinalVisible: boolean;
    visibleToRawRatio: number;
    thinkingToVisibleRatio: number | null;
  };
  workflow: {
    maxTurns: number;
    completedTurn: number | null;
    completedTurns: number[];
    continuationUsed: boolean;
    continuationReasons: string[];
    followUpPromptsUsed: number;
    minimumCompletionTurns: number;
    turnCount: number;
  };
  turns: OutputRunTurn[];
  recommendedAction: {
    class: 'fix' | 'optimize' | 'record' | 'pass';
    nextStep: string;
  };
};

type OutputRunTurn = {
  turn: number;
  requestPrepared: OutputRunResult['requestPrepared'];
  transport: OutputRunResult['transport'];
  reply: OutputRunResult['reply'];
};

type MonitorTurnAnalysis = OutputRunTurn & {
  prepared: Awaited<ReturnType<typeof prepareCollaboratorReplyRequest>>;
  execution: Awaited<ReturnType<typeof executePreparedRequest>>;
  parsed: ReturnType<typeof parseAssistantReplyContent>;
  requiredPatternsHit: string[];
  missingRequiredPatterns: string[];
  visibleChars: number;
  rawChars: number;
  thinkingChars: number;
  declaredActionKinds: string[];
};

type SyntheticToolBase = Pick<ToolInvocation, 'id' | 'kind' | 'status' | 'originMessageId'>;

function buildCacheSnapshot(cachePlan: AssistantRequestCachePlan): OutputRunResult['requestPrepared']['cache'] {
  return {
    status: cachePlan.requestApplication.status,
    label: cachePlan.requestApplication.label,
    sendsExplicitCacheControl: cachePlan.requestApplication.sendsExplicitCacheControl,
    breakpoints: cachePlan.breakpoints.map((breakpoint) => ({
      name: breakpoint.name,
      estimatedTokens: breakpoint.estimatedTokens,
      minimumTokens: breakpoint.minimumTokens,
      enabled: breakpoint.enabled,
      eligible: breakpoint.eligible,
      reason: breakpoint.reason
    }))
  };
}

async function runOne(job: { model: { id: string; tier: 'small' | 'medium' | 'strong' }; profile: ProfileConfig; round: number; testCase: OutputStabilityCase; }): Promise<OutputRunResult> {
  const providerProfile = buildProviderProfile(job.model.id);
  const persona = buildPersona(job.model.id, job.profile);
  const toolContext = buildToolContext(job.profile.toolsEnabled, job.model.tier, job.testCase);
  const messages = buildMessages(job.testCase);
  const followUpPrompts = job.testCase.followUpPrompts ?? [];
  const maxTurns = job.testCase.maxWorkflowTurns ?? Math.max(1, followUpPrompts.length > 0 ? (followUpPrompts.length + 1) * 2 + 1 : 2);
  const continuationReasons: string[] = [];
  let followUpPromptIndex = 0;
  const turns: MonitorTurnAnalysis[] = [];

  while (turns.length < maxTurns) {
    const turn = await runMonitorTurn({
      turn: turns.length + 1,
      providerProfile,
      persona,
      messages,
      toolContext,
      modelTier: job.model.tier,
      testCase: job.testCase
    });
    turns.push(turn);

    const nextStep = resolveWorkflowNextStep({
      testCase: job.testCase,
      turn,
      followUpPromptIndex
    });
    if (!nextStep) break;

    continuationReasons.push(nextStep.reason);
    appendTurnResultMessages({
      messages,
      turn,
      testCase: job.testCase,
      toolContext,
      nextUserPrompt: nextStep.prompt
    });
    if (nextStep.kind === 'follow_up') {
      followUpPromptIndex += 1;
    }
  }

  const finalTurn = turns[turns.length - 1];
  const prepared = finalTurn.prepared;
  const execution = finalTurn.execution;
  const parsed = finalTurn.parsed;
  const requiredPatternsHit = finalTurn.requiredPatternsHit;
  const missingRequiredPatterns = finalTurn.missingRequiredPatterns;
  const visibleChars = finalTurn.visibleChars;
  const rawChars = finalTurn.rawChars;
  const thinkingChars = finalTurn.thinkingChars;
  const declaredActionKinds = turns.flatMap((turn) => turn.declaredActionKinds);
  const acceptedToolKinds = job.testCase.acceptedToolKinds ?? [];
  const acceptedToolPathUsed = declaredActionKinds.some((kind) => acceptedToolKinds.includes(kind));
  const completionToolKinds = job.testCase.completionToolKinds ?? [];
  const completionToolPathUsed =
    completionToolKinds.length === 0 || declaredActionKinds.some((kind) => completionToolKinds.includes(kind));
  const completedTurns =
    completionToolKinds.length === 0
      ? []
      : turns
          .filter((turn) => turn.declaredActionKinds.some((kind) => completionToolKinds.includes(kind)))
          .map((turn) => turn.turn);
  const minimumCompletionTurns = job.testCase.minimumCompletionTurns ?? (followUpPrompts.length > 0 ? followUpPrompts.length + 1 : completionToolKinds.length > 0 ? 1 : 0);
  const unexpectedToolDrift =
    declaredActionKinds.some((kind) => !acceptedToolKinds.includes(kind));
  const evaluation = {
    passed:
      turns.every((turn) => turn.execution.ok)
      && turns.every((turn) => turn.prepared.audit.budgetUsage.preflightStatus === 'within_budget')
      && visibleChars >= job.testCase.minVisibleChars
      && missingRequiredPatterns.length === 0
      && completionToolPathUsed
      && completedTurns.length >= minimumCompletionTurns
      && !unexpectedToolDrift,
    expectedVisibleEnough: visibleChars >= job.testCase.minVisibleChars,
    expectedPatternsEnough: missingRequiredPatterns.length === 0,
    acceptedToolPathUsed,
    completionToolPathUsed,
    expectedCompletionTurnsEnough: completedTurns.length >= minimumCompletionTurns,
    unexpectedToolDrift
  };
  const evidence = {
    progressExceededFinalVisible: execution.maxProgressVisibleChars >= job.testCase.minVisibleChars && visibleChars < job.testCase.minVisibleChars,
    visibleToRawRatio: rawChars > 0 ? Number((visibleChars / rawChars).toFixed(3)) : 0,
    thinkingToVisibleRatio: visibleChars > 0 && thinkingChars > 0 ? Number((thinkingChars / visibleChars).toFixed(3)) : null
  };
  const diagnosis = classifyDiagnosis({
    prepared,
    execution,
    evaluation,
    evidence,
    testCase: job.testCase,
    reply: execution.reply,
    parsed
  });

  return {
    model: job.model.id,
    tier: job.model.tier,
    round: job.round,
    caseId: job.testCase.id,
    category: job.testCase.category,
    historyProfile: job.testCase.historyProfile,
    profile: job.profile.id,
    profileLabel: job.profile.label,
    requestPrepared: {
      preflightStatus: prepared.audit.budgetUsage.preflightStatus,
      estimatedTokens: prepared.audit.budgetUsage.totalEstimatedTokens,
      budgetTokens: prepared.audit.budgetUsage.totalPromptTokens,
      toolCapabilityTokens: prepared.audit.budgetUsage.diagnostics.toolCapabilityTokens,
      themeSnapshotTokens: prepared.audit.budgetUsage.diagnostics.themeSnapshotTokens,
      toolCount: prepared.audit.tooling.toolCount,
      toolChoice: prepared.audit.tooling.toolChoice ?? null,
      droppedHistoryCount: prepared.audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_history_budget').length,
      droppedMessageLimitCount: prepared.audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_message_limit').length,
      cache: buildCacheSnapshot(prepared.audit.cachePlan)
    },
    transport: {
      streamRequested: execution.streamRequested,
      requestTimeoutMs,
      ok: execution.ok,
      http: execution.http,
      error: execution.error,
      latencyMs: execution.latencyMs,
      progressCount: execution.progressCount,
      maxProgressVisibleChars: execution.maxProgressVisibleChars,
      maxProgressRawChars: execution.maxProgressRawChars
    },
    reply: {
      rawChars,
      visibleChars,
      thinkingChars,
      tokenCount: typeof execution.reply.tokenCount === 'number' ? execution.reply.tokenCount : null,
      tokenUsage: execution.reply.tokenUsage ?? null,
      parsedIssueCount: parsed.parsed.issues.length,
      declaredActionKinds,
      declaredActionPreviews: parsed.parsed.actions.map((action) => JSON.stringify(action).slice(0, 420)),
      nativeToolCallPreviews: (execution.reply.nativeToolCalls ?? []).map((toolCall) => JSON.stringify(toolCall).slice(0, 420)),
      hasCodeFence: /```/.test(parsed.visibleContent) || /<!DOCTYPE html>/i.test(parsed.visibleContent),
      requiredPatternsHit,
      missingRequiredPatterns,
      rawPreview: execution.reply.content.slice(0, 240),
      thinkingPreview: (execution.reply.thinkingText ?? '').slice(0, 420),
      visiblePreview: parsed.visibleContent.slice(0, 240)
    },
    evaluation,
    diagnosis,
    evidence,
    workflow: {
      maxTurns,
      completedTurn: completedTurns[0] ?? null,
      completedTurns,
      continuationUsed: continuationReasons.length > 0,
      continuationReasons,
      followUpPromptsUsed: followUpPromptIndex,
      minimumCompletionTurns,
      turnCount: turns.length
    },
    turns: turns.map((turn) => ({
      turn: turn.turn,
      requestPrepared: turn.requestPrepared,
      transport: turn.transport,
      reply: turn.reply
    })),
    recommendedAction: resolveRecommendedAction(diagnosis)
  };
}

async function runMonitorTurn(args: {
  turn: number;
  providerProfile: ProviderProfile;
  persona: Persona;
  messages: ChatMessage[];
  toolContext: AssistantToolContext | undefined;
  modelTier: 'small' | 'medium' | 'strong';
  testCase: OutputStabilityCase;
}): Promise<MonitorTurnAnalysis> {
  const prepared = await prepareCollaboratorReplyRequest({
    api: args.providerProfile,
    persona: args.persona,
    messages: args.messages,
    toolContext: args.toolContext,
    nickname: '测试用户'
  });

  const execution = await executePreparedRequest({
    api: args.providerProfile,
    persona: args.persona,
    context: prepared.context,
    modelId: prepared.modelId,
    requestTimeoutMs
  });
  const parsed = parseAssistantReplyContent(
    execution.reply.content,
    args.modelTier,
    'stable',
    'final',
    execution.reply.nativeToolCalls ?? [],
    [],
    {
      hasWorkspaceContext: Boolean(args.toolContext?.activeProject),
      activeProjectId: args.toolContext?.activeProject?.id ?? null
    }
  );
  const requiredPatterns = args.testCase.requiredPatterns ?? [];
  const requiredPatternsHit = requiredPatterns.filter((pattern) => execution.reply.content.includes(pattern) || parsed.visibleContent.includes(pattern));
  const missingRequiredPatterns = requiredPatterns.filter((pattern) => !requiredPatternsHit.includes(pattern));
  const visibleChars = parsed.visibleContent.length;
  const rawChars = execution.reply.content.length;
  const thinkingChars = execution.reply.thinkingText?.length ?? 0;
  const declaredActionKinds = parsed.parsed.actions.map((action) => action.kind);

  return {
    turn: args.turn,
    prepared,
    execution,
    parsed,
    requiredPatternsHit,
    missingRequiredPatterns,
    visibleChars,
    rawChars,
    thinkingChars,
    declaredActionKinds,
    requestPrepared: {
      preflightStatus: prepared.audit.budgetUsage.preflightStatus,
      estimatedTokens: prepared.audit.budgetUsage.totalEstimatedTokens,
      budgetTokens: prepared.audit.budgetUsage.totalPromptTokens,
      toolCapabilityTokens: prepared.audit.budgetUsage.diagnostics.toolCapabilityTokens,
      themeSnapshotTokens: prepared.audit.budgetUsage.diagnostics.themeSnapshotTokens,
      toolCount: prepared.audit.tooling.toolCount,
      toolChoice: prepared.audit.tooling.toolChoice ?? null,
      droppedHistoryCount: prepared.audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_history_budget').length,
      droppedMessageLimitCount: prepared.audit.contextPlan.entries.filter((entry) => entry.status === 'dropped_message_limit').length,
      cache: buildCacheSnapshot(prepared.audit.cachePlan)
    },
    transport: {
      streamRequested: execution.streamRequested,
      requestTimeoutMs,
      ok: execution.ok,
      http: execution.http,
      error: execution.error,
      latencyMs: execution.latencyMs,
      progressCount: execution.progressCount,
      maxProgressVisibleChars: execution.maxProgressVisibleChars,
      maxProgressRawChars: execution.maxProgressRawChars
    },
    reply: {
      rawChars,
      visibleChars,
      thinkingChars,
      tokenCount: typeof execution.reply.tokenCount === 'number' ? execution.reply.tokenCount : null,
      tokenUsage: execution.reply.tokenUsage ?? null,
      parsedIssueCount: parsed.parsed.issues.length,
      declaredActionKinds,
      declaredActionPreviews: parsed.parsed.actions.map((action) => JSON.stringify(action).slice(0, 420)),
      nativeToolCallPreviews: (execution.reply.nativeToolCalls ?? []).map((toolCall) => JSON.stringify(toolCall).slice(0, 420)),
      hasCodeFence: /```/.test(parsed.visibleContent) || /<!DOCTYPE html>/i.test(parsed.visibleContent),
      requiredPatternsHit,
      missingRequiredPatterns,
      rawPreview: execution.reply.content.slice(0, 240),
      thinkingPreview: (execution.reply.thinkingText ?? '').slice(0, 420),
      visiblePreview: parsed.visibleContent.slice(0, 240)
    }
  };
}

function buildProviderProfile(modelId: string): ProviderProfile {
  const preset = findProviderPreset(api, '/chat/completions') ?? findProviderPreset(api) ?? null;
  const patch = preset ? buildProviderPresetPatch(preset.id, modelId) : null;
  const protocol = inferProviderProtocol({
    protocol: patch?.protocol,
    path: patch?.path ?? (api.includes('/messages') ? '/messages' : '/chat/completions')
  });
  return {
    id: patch?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'validation-provider',
    name: patch?.name ?? 'Validation Provider',
    protocol,
    baseUrl: patch?.baseUrl ?? api.replace(/\/chat\/completions$/, '').replace(/\/messages$/, ''),
    path: patch?.path ?? (protocol === 'anthropic-messages' ? '/messages' : '/chat/completions'),
    apiKey: key,
    model: modelId,
    capabilities: patch?.capabilities ?? {
      images: false,
      streaming: true,
      thinking: /thinking|reasoner|r1|claude/i.test(modelId)
    }
  };
}

function buildPersona(modelId: string, profile: ProfileConfig): Persona {
  const maxTokens = process.env.VALIDATION_MAX_TOKENS?.trim() ?? '';

  return createPersonaTemplate({
    id: 'output-monitor',
    name: 'Pharos',
    description: '在输出稳定性监测里维持正常连续回复。',
    advanced: {
      modelOverride: modelId,
      temperature: process.env.VALIDATION_TEMPERATURE?.trim() || '0.35',
      topP: process.env.VALIDATION_TOP_P?.trim() || '1',
      maxTokens,
      thinkingBudget: profile.thinkingBudget,
      contextMessageLimit: '64',
      showThinking: true,
      streaming: profile.streaming,
      customHeaders: '',
      customBody: '',
      regexRules: '',
      snippets: []
    }
  });
}

function buildToolContext(
  enabled: boolean,
  modelTier: 'small' | 'medium' | 'strong',
  testCase: OutputStabilityCase
): AssistantToolContext | undefined {
  if (!enabled) return undefined;
  const workspaceScenario = testCase.toolScenario === 'workspace';
  const activeProject = workspaceScenario
    ? {
        id: 'monitor-project-nova-diary',
        title: 'Nova Journal',
        slug: 'nova-diary',
        tags: ['monitor'],
        source: 'manual' as const,
        fileCount: 1,
        entryFileId: 'monitor-file-index',
        entryFilePath: 'index.html',
        files: [{
          fileId: 'monitor-file-index',
          title: 'index.html',
          language: 'html',
          path: 'index.html',
          role: 'entry' as const,
          isEntry: true
        }]
      }
    : null;
  return {
    activeCard: null,
    visibleCards: [],
    visibleProjectFiles: workspaceScenario
      ? [{
          id: 'monitor-file-index',
          projectId: 'monitor-project-nova-diary',
          filePath: 'index.html',
          fileRole: 'entry',
          language: 'html',
          content: '<main><h1>Nova Journal</h1><p>等待继续写。</p></main>',
          source: 'manual',
          createdAt: 1_774_000_000_000,
          updatedAt: 1_774_000_000_000
        }]
      : [],
    activeProject,
    visibleProjects: activeProject ? [activeProject] : [],
    modelTier,
    enabledToolGroups: {
      room: true,
      project: workspaceScenario,
      theme: true,
      attachment: true,
      archive: true,
      web: true,
      memory: true
    },
    toolEnforcementMode: 'normal',
    uiSnapshot: {
      activeWorld: 'chat',
      collectionShelf: 'code',
      activeConversationTitle: '输出稳定性监测',
      activeCollaboratorName: 'Pharos',
      selectorHints: []
    }
  };
}

function buildMessages(testCase: OutputStabilityCase): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (testCase.historyProfile === 'heavy') {
    messages.push(
      createMessage('user', repeatSentence('我在想一个很长的复杂需求，里面既有情绪连续性，也有结构要求，还希望你不要突然转去做别的。', 18)),
      createMessage('assistant', repeatSentence('我会先把真正重要的要求捋清，再继续写，不会随手切模式，也不会把结构丢掉。', 16)),
      createMessage('user', repeatSentence('而且这轮我很在意上下文衔接、表达完整度、不要突然断掉，也不要只给一小半。', 18)),
      createMessage('assistant', repeatSentence('我记住了，这轮重点是完整输出、别乱分点、别突然偏题、别把正文让给别的东西。', 16))
    );
  }
  messages.push(createMessage('user', testCase.prompt));
  return messages;
}

function resolveWorkflowNextStep(args: {
  testCase: OutputStabilityCase;
  turn: MonitorTurnAnalysis;
  followUpPromptIndex: number;
}) {
  if (!args.turn.execution.ok) return null;
  if (args.turn.prepared.audit.budgetUsage.preflightStatus !== 'within_budget') return null;
  if (args.turn.parsed.parsed.issues.length > 0) return null;

  const acceptedToolKinds = args.testCase.acceptedToolKinds ?? [];
  if (args.turn.declaredActionKinds.some((kind) => !acceptedToolKinds.includes(kind))) {
    return null;
  }

  const completionToolKinds = args.testCase.completionToolKinds ?? [];
  const completedThisTurn = completionToolKinds.some((kind) => args.turn.declaredActionKinds.includes(kind));
  const followUpPrompt = args.testCase.followUpPrompts?.[args.followUpPromptIndex];
  if (completedThisTurn && followUpPrompt) {
    return {
      kind: 'follow_up' as const,
      reason: `turn_${args.turn.turn}_completed_then_follow_up_${args.followUpPromptIndex + 1}`,
      prompt: followUpPrompt
    };
  }

  const continuationToolKinds = args.testCase.continuationToolKinds ?? [];
  if (continuationToolKinds.length === 0) return null;
  const continuationKind = args.turn.declaredActionKinds.find((kind) => continuationToolKinds.includes(kind));
  return continuationKind
    ? {
        kind: 'continue_after_read' as const,
        reason: `turn_${args.turn.turn}_used_${continuationKind}`,
        prompt: '继续完成刚才的工作。你已经拿到了上一轮工具结果，请基于工具结果直接完成原始需求。'
      }
    : null;
}

function appendTurnResultMessages(args: {
  messages: ChatMessage[];
  turn: MonitorTurnAnalysis;
  testCase: OutputStabilityCase;
  toolContext: AssistantToolContext | undefined;
  nextUserPrompt: string;
}) {
  const assistantMessageId = `assistant-turn-${args.turn.turn}-${Math.random().toString(36).slice(2, 10)}`;
  const assistantMessage: ChatMessage = {
    ...createMessage('assistant', args.turn.execution.reply.content),
    id: assistantMessageId,
    origin: 'assistant-reply',
    thinkingText: args.turn.execution.reply.thinkingText,
    nativeToolCalls: args.turn.execution.reply.nativeToolCalls
  };
  const acceptedKinds = new Set(args.testCase.acceptedToolKinds ?? []);
  const acceptedActions = args.turn.parsed.parsed.actions
    .filter((action) => acceptedKinds.has(action.kind));
  applySyntheticActionEffectsToToolContext({
    toolContext: args.toolContext,
    testCase: args.testCase,
    actionKinds: acceptedActions.map((action) => action.kind as ToolInvocation['kind'])
  });
  const toolMessages = acceptedActions
    .map((action, index) => {
      const invocation = buildSyntheticToolInvocation({
        kind: action.kind as ToolInvocation['kind'],
        originMessageId: assistantMessageId,
        index,
        testCase: args.testCase,
        toolContext: args.toolContext
      });
      return {
        ...createMessage('system', invocation.summary),
        id: invocation.id,
        origin: 'tool-runtime' as const,
        toolInvocation: invocation
      };
    });

  args.messages.push(
    assistantMessage,
    ...toolMessages,
    createMessage('user', args.nextUserPrompt)
  );
}

function applySyntheticActionEffectsToToolContext(args: {
  toolContext: AssistantToolContext | undefined;
  testCase: OutputStabilityCase;
  actionKinds: ToolInvocation['kind'][];
}) {
  if (args.testCase.toolScenario !== 'workspace' || !args.toolContext) return;
  if (!args.actionKinds.some(isWorkspaceWriteKind)) return;

  const activeProject = args.toolContext.activeProject;
  const projectId = activeProject?.id ?? 'monitor-project-nova-diary';
  const updatedAt = Date.now();
  const revision = nextSyntheticWorkflowRevision(args.toolContext);
  args.toolContext.visibleProjectFiles = buildSyntheticProjectFiles({
    projectId,
    updatedAt,
    revision
  });

  if (activeProject) {
    activeProject.fileCount = args.toolContext.visibleProjectFiles.length;
    activeProject.entryFileId = 'monitor-file-index';
    activeProject.entryFilePath = 'index.html';
    activeProject.files = args.toolContext.visibleProjectFiles.map((file) => ({
      fileId: file.id,
      title: file.filePath.split('/').pop() || file.filePath,
      language: file.language,
      path: file.filePath,
      role: file.fileRole,
      isEntry: file.fileRole === 'entry'
    }));
  }
}

function nextSyntheticWorkflowRevision(toolContext: AssistantToolContext) {
  const state = toolContext as AssistantToolContext & { __monitorWorkflowRevision?: number };
  state.__monitorWorkflowRevision = (state.__monitorWorkflowRevision ?? 0) + 1;
  return state.__monitorWorkflowRevision;
}

function buildSyntheticProjectFiles(args: {
  projectId: string;
  updatedAt: number;
  revision: number;
}): NonNullable<AssistantToolContext['visibleProjectFiles']> {
  const htmlBody =
    args.revision >= 3
      ? [
          '  <main id="diary-app" class="diary-shell">',
          '    <section class="toolbar" aria-label="日记筛选">',
          '      <input id="search" placeholder="搜索日记" />',
          '      <select id="tag-filter"><option value="">全部标签</option></select>',
          '    </section>',
          '    <section id="empty-state" class="empty-state">还没有日记，先写一条。</section>',
          '    <section id="entry-list" class="entry-list"></section>',
          '    <article id="entry-reader" class="entry-reader"></article>',
          '    <form id="entry-editor" class="entry-editor"></form>',
          '  </main>'
        ]
      : args.revision >= 2
        ? [
            '  <main id="diary-app" class="diary-shell">',
            '    <input id="search" placeholder="搜索标题和正文" />',
            '    <div id="tag-filter"></div>',
            '    <section id="entry-list"></section>',
            '    <article id="entry-reader"></article>',
            '    <form id="draft-editor"></form>',
            '  </main>'
          ]
        : [
            '  <main id="diary-app" class="diary-shell">',
            '    <section id="entry-list"></section>',
            '    <article id="entry-reader"></article>',
            '    <form id="entry-editor"></form>',
            '  </main>'
          ];
  const cssLines =
    args.revision >= 3
      ? [
          ':root { color-scheme: light; --paper: #fff8ee; --ink: #2d2722; }',
          '* { box-sizing: border-box; }',
          'body { margin: 0; min-height: 100vh; font-family: system-ui, sans-serif; background: #f3efe7; color: var(--ink); }',
          '.diary-shell { min-height: 100vh; display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 20px; padding: 24px; }',
          '.toolbar { grid-column: 1 / -1; display: flex; gap: 12px; }',
          '.entry-list, .entry-reader, .entry-editor, .empty-state { border: 1px solid #e2d5c5; background: var(--paper); padding: 16px; border-radius: 14px; }',
          '@media (max-width: 720px) { .diary-shell { grid-template-columns: 1fr; padding: 14px; } .toolbar { flex-direction: column; } }'
        ]
      : args.revision >= 2
        ? [
            ':root { color-scheme: light; --paper: #fff8ee; }',
            'body { margin: 0; font-family: system-ui, sans-serif; background: #f6efe4; }',
            '.diary-shell { min-height: 100vh; display: grid; grid-template-columns: 280px 1fr; gap: 18px; padding: 24px; }',
            '#search, #tag-filter { border: 1px solid #dccdbc; border-radius: 10px; padding: 10px 12px; }'
          ]
        : [
            ':root { color-scheme: light; }',
            'body { margin: 0; font-family: system-ui, sans-serif; }',
            '.diary-shell { min-height: 100vh; display: grid; grid-template-columns: 280px 1fr; gap: 16px; padding: 24px; }'
          ];
  const scriptLines =
    args.revision >= 3
      ? [
          'const STORAGE_KEY = "nova-diary.entries";',
          'const DRAFT_KEY = "nova-diary.draft";',
          'const state = { query: "", tag: "", entries: JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") };',
          'function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries)); }',
          'function saveDraft(value) { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); }',
          'function filteredEntries() { return state.entries.filter((entry) => (!state.query || `${entry.title} ${entry.body}`.includes(state.query)) && (!state.tag || entry.tags.includes(state.tag))); }',
          'function renderEmptyState() { document.querySelector("#empty-state").hidden = filteredEntries().length > 0; }',
          'function render() { renderEmptyState(); }',
          'render();'
        ]
      : args.revision >= 2
        ? [
            'const STORAGE_KEY = "nova-diary.entries";',
            'const DRAFT_KEY = "nova-diary.draft";',
            'const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");',
            'function saveEntries(nextEntries) { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries)); }',
            'function filterEntries(query, tag) { return entries.filter((entry) => entry.title.includes(query) || entry.body.includes(query) || entry.tags.includes(tag)); }'
          ]
        : [
            'const STORAGE_KEY = "nova-diary.entries";',
            'const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");',
            'console.log(entries);'
          ];

  return [
    {
      id: 'monitor-file-index',
      projectId: args.projectId,
      filePath: 'index.html',
      fileRole: 'entry',
      language: 'html',
      content: [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<head>',
        '  <meta charset="UTF-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        '  <title>Nova Journal</title>',
        '  <link rel="stylesheet" href="./styles.css" />',
        '</head>',
        '<body>',
        ...htmlBody,
        '  <script src="./script.js"></script>',
        '</body>',
        '</html>'
      ].join('\n'),
      source: 'chat-generated',
      createdAt: 1_774_000_000_000,
      updatedAt: args.updatedAt
    },
    {
      id: 'monitor-file-styles',
      projectId: args.projectId,
      filePath: 'styles.css',
      fileRole: 'style',
      language: 'css',
      content: cssLines.join('\n'),
      source: 'chat-generated',
      createdAt: args.updatedAt,
      updatedAt: args.updatedAt
    },
    {
      id: 'monitor-file-script',
      projectId: args.projectId,
      filePath: 'script.js',
      fileRole: 'logic',
      language: 'javascript',
      content: scriptLines.join('\n'),
      source: 'chat-generated',
      createdAt: args.updatedAt,
      updatedAt: args.updatedAt
    }
  ];
}

function isWorkspaceWriteKind(kind: ToolInvocation['kind']) {
  return (
    kind === 'createProjectFile'
    || kind === 'writeProjectFiles'
    || kind === 'editProjectFileText'
    || kind === 'appendProjectFile'
    || kind === 'insertProjectFile'
  );
}

function buildSyntheticToolInvocation(args: {
  kind: ToolInvocation['kind'];
  originMessageId: string;
  index: number;
  testCase: OutputStabilityCase;
  toolContext: AssistantToolContext | undefined;
}): ToolInvocation {
  const base = {
    id: `monitor-tool-${args.index + 1}-${Math.random().toString(36).slice(2, 10)}`,
    kind: args.kind,
    status: 'executed' as const,
    originMessageId: args.originMessageId
  };
  if (args.testCase.toolScenario === 'workspace') {
    const writeInvocation = buildWorkspaceWriteInvocation(args, base);
    if (writeInvocation) return writeInvocation;
    return {
      ...base,
      title: resolveWorkspaceReadTitle(args.kind),
      summary: resolveWorkspaceReadSummary(args.kind),
      detailText: buildWorkspaceReadDetail(args.toolContext, args.kind),
      projectFileId: getMonitorProjectFileFact(args.toolContext)?.fileId,
      projectFiles: getMonitorProjectFileFact(args.toolContext) ? [getMonitorProjectFileFact(args.toolContext)!] : undefined,
      projectFileReads: buildWorkspaceReadEvidence(args.toolContext, args.kind)
    };
  }

  const themeWriteInvocation = buildThemeWriteInvocation(args, base);
  if (themeWriteInvocation) return themeWriteInvocation;

  return {
    ...base,
    title: args.kind === 'inspectThemeRender' ? '检查主题渲染' : '读取主题 CSS',
    summary:
      args.kind === 'inspectThemeRender'
        ? '已检查当前主题渲染，用户气泡区域可正常应用 CSS。'
        : '已读取当前主题 CSS。',
    detailText:
      args.kind === 'inspectThemeRender'
        ? '检查结果：当前对话主题可渲染，用户气泡选择器可用，适合继续追加或替换气泡质感 CSS。'
        : [
            '当前主题 CSS：',
            '.chat-message.user {',
            '  border-radius: 18px;',
            '  background: var(--cool-panel);',
            '  color: var(--cool-text);',
            '}'
          ].join('\n')
  };
}

function buildWorkspaceWriteInvocation(
  args: {
    kind: ToolInvocation['kind'];
    toolContext: AssistantToolContext | undefined;
  },
  base: SyntheticToolBase
): ToolInvocation | null {
  const writeKinds = new Set<ToolInvocation['kind']>([
    'createProjectFile',
    'writeProjectFiles',
    'editProjectFileText',
    'appendProjectFile',
    'insertProjectFile'
  ]);
  if (!writeKinds.has(args.kind)) return null;
  const facts = getMonitorProjectFileFacts(args.toolContext);
  const fact = facts[0] ?? null;
  const fallbackProjectId = args.toolContext?.activeProject?.id ?? 'monitor-project-nova-diary';
  const fallbackFileId = fact?.fileId ?? 'monitor-file-index';
  const fallbackFilePath = fact?.filePath ?? 'index.html';
  const effect: ProjectFileEffect = {
    projectId: fact?.projectId ?? fallbackProjectId,
    fileId: fallbackFileId,
    filePath: fallbackFilePath,
    operation: resolveWorkspaceWriteOperation(args.kind),
    beforeLines: fact?.totalLines ?? 3,
    afterLines: 96,
    changedLines: {
      start: 1,
      end: 96
    },
    afterExcerptStartLine: 1,
    afterExcerptEndLine: 12,
    afterExcerpt: [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '  <meta charset="UTF-8" />',
      '  <title>Nova Journal</title>',
      '</head>'
    ].join('\n'),
    insertedChars: 4200
  };

  return {
    ...base,
    title: '写入工作区文件',
    summary: `已更新工作区文件 · ${fallbackFilePath}`,
    detailText: '监控合成结果：上一轮已把阶段需求落到当前工作区文件，下一轮应基于这个结果继续补功能、修引用或检查运行状态。',
    projectFileId: fallbackFileId,
    projectFileIds: facts.length ? facts.map((entry) => entry.fileId) : [fallbackFileId],
    projectFilePaths: facts.length ? facts.map((entry) => entry.filePath) : [fallbackFilePath],
    projectFiles: facts.length ? facts : undefined,
    projectFileEffects: [effect]
  };
}

function resolveWorkspaceWriteOperation(kind: ToolInvocation['kind']): ProjectFileEffect['operation'] {
  if (kind === 'appendProjectFile') return 'appended';
  if (kind === 'insertProjectFile') return 'inserted';
  if (kind === 'editProjectFileText') return 'replaced';
  if (kind === 'createProjectFile') return 'created';
  return 'overwritten';
}

function buildThemeWriteInvocation(
  args: {
    kind: ToolInvocation['kind'];
  },
  base: SyntheticToolBase
): ToolInvocation | null {
  const writeKinds = new Set<ToolInvocation['kind']>([
    'appendThemeCss',
    'insertThemeCss',
    'replaceThemeCss',
    'editThemeCss',
    'applySurfaceTokens',
    'applyThemeCoordinates',
    'patchRawCss'
  ]);
  if (!writeKinds.has(args.kind)) return null;
  return {
    ...base,
    title: '应用主题改动',
    summary: '已应用当前主题 CSS 改动。',
    detailText: '监控合成结果：主题改动已进入当前对话主题，下一轮应基于已应用状态继续检查或补丁。',
    themeScope: 'chat',
    themeSurfaceLabels: ['用户气泡'],
    themeIntentLabel: '吐司质感用户气泡'
  };
}

function resolveWorkspaceReadTitle(kind: ToolInvocation['kind']) {
  if (kind === 'listProjectFiles') return '列出工作区文件';
  if (kind === 'readProjectFileContext') return '读取工作区上下文';
  return '读取工作区文件';
}

function resolveWorkspaceReadSummary(kind: ToolInvocation['kind']) {
  if (kind === 'listProjectFiles') return '已列出工作区文件 · index.html';
  if (kind === 'readProjectFileContext') return '已读取上下文 · index.html';
  return '已读取工作区文件 · index.html';
}

function getMonitorProjectFileFact(toolContext: AssistantToolContext | undefined): ProjectFileFact | null {
  return getMonitorProjectFileFacts(toolContext)[0] ?? null;
}

function getMonitorProjectFileFacts(toolContext: AssistantToolContext | undefined): ProjectFileFact[] {
  const files = toolContext?.visibleProjectFiles;
  const project = toolContext?.activeProject;
  if (!files?.[0] || !project) return [];
  return files.map((entry) => ({
    projectId: project.id,
    fileId: entry.id,
    filePath: entry.filePath,
    language: entry.language,
    fileRole: entry.fileRole,
    isEntry: entry.fileRole === 'entry',
    totalLines: countLines(entry.content),
    totalChars: entry.content.length
  }));
}

function buildWorkspaceReadDetail(toolContext: AssistantToolContext | undefined, kind: ToolInvocation['kind']) {
  const files = toolContext?.visibleProjectFiles ?? [];
  const file = files[0];
  if (!file) return '工作区文件列表为空。';
  if (kind === 'listProjectFiles') {
    return [
      '工作区：Nova Journal',
      '文件：',
      ...files.map((entry) => `- ${entry.filePath} (${entry.language}, ${countLines(entry.content)} lines)`)
    ].join('\n');
  }
  return [
    `文件：${file.filePath}`,
    `语言：${file.language}`,
    `工作区：${file.projectId}`,
    file.fileRole ? `角色：${file.fileRole}` : null,
    '',
    file.content.trim() || '[空]'
  ].filter(Boolean).join('\n');
}

function buildWorkspaceReadEvidence(
  toolContext: AssistantToolContext | undefined,
  kind: ToolInvocation['kind']
): ProjectFileReadEvidence[] | undefined {
  const facts = getMonitorProjectFileFacts(toolContext);
  const fact = facts[0] ?? null;
  if (!fact) return undefined;
  if (kind === 'listProjectFiles') {
    return [{
      kind: 'directory',
      projectId: fact.projectId,
      totalFiles: facts.length,
      files: facts
    }];
  }
  if (kind === 'readProjectFileContext') {
    return [{
      kind: 'context',
      projectId: fact.projectId,
      fileId: fact.fileId,
      filePath: fact.filePath,
      language: fact.language,
      startLine: 1,
      endLine: fact.totalLines,
      totalLines: fact.totalLines,
      anchorLineNumber: null
    }];
  }
  return [{
    kind: 'file',
    projectId: fact.projectId,
    file: fact
  }];
}

function countLines(input: string) {
  return input.length === 0 ? 0 : input.split(/\r\n|\r|\n/).length;
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
    timestamp: Date.now()
  };
}

function repeatSentence(sentence: string, count: number) {
  return Array.from({ length: count }, () => sentence).join('');
}

async function executePreparedRequest(params: {
  api: ProviderProfile;
  persona: Persona;
  context: Awaited<ReturnType<typeof prepareCollaboratorReplyRequest>>['context'];
  modelId: string;
  requestTimeoutMs: number;
}): Promise<{
  ok: boolean;
  http: number;
  error: string | null;
  latencyMs: number;
  progressCount: number;
  maxProgressVisibleChars: number;
  maxProgressRawChars: number;
  streamRequested: boolean;
  reply: AssistantReply;
}> {
  const request = buildApiRequest({
    api: params.api,
    advanced: params.persona.advanced,
    context: params.context
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.requestTimeoutMs);
  const startedAt = Date.now();
  let progressCount = 0;
  let maxProgressVisibleChars = 0;
  let maxProgressRawChars = 0;

  const handleProgress = (partialReply: AssistantReplyProgress) => {
    progressCount += 1;
    maxProgressRawChars = Math.max(maxProgressRawChars, partialReply.content.length);
    const visible = parseAssistantReplyContent(
      partialReply.content,
      'medium',
      'stable',
      'streaming',
      partialReply.nativeToolCalls ?? []
    ).visibleContent.length;
    maxProgressVisibleChars = Math.max(maxProgressVisibleChars, visible);
  };

  try {
    const response = await fetch(request.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        http: response.status,
        error: text.slice(0, 220),
        latencyMs: Date.now() - startedAt,
        progressCount,
        maxProgressVisibleChars,
        maxProgressRawChars,
        streamRequested: request.body.stream === true,
        reply: {
          content: '',
          tokenCount: undefined
        }
      };
    }

    let reply: AssistantReply;
    if (request.body.stream === true && response.body) {
      reply = await readStreamingReplyForMonitor(response, params.modelId, handleProgress);
    } else {
      const payload = await response.json();
      reply =
        request.provider === 'anthropic-messages'
          ? extractAnthropicReply(payload, params.modelId)
          : extractOpenAiCompatibleReply(payload, params.modelId);
      handleProgress(reply);
    }

    return {
      ok: true,
      http: 200,
      error: null,
      latencyMs: Date.now() - startedAt,
      progressCount,
      maxProgressVisibleChars,
      maxProgressRawChars,
      streamRequested: request.body.stream === true,
      reply
    };
  } catch (error) {
    return {
      ok: false,
      http: 0,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
      progressCount,
      maxProgressVisibleChars,
      maxProgressRawChars,
      streamRequested: request.body.stream === true,
      reply: {
        content: '',
        tokenCount: undefined
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readStreamingReplyForMonitor(
  response: Response,
  fallbackModel: string,
  onProgress: (reply: AssistantReplyProgress) => void
): Promise<AssistantReply> {
  if (!response.body) {
    throw new Error('Streaming 响应为空');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const isEventStream = response.headers.get('content-type')?.includes('text/event-stream') ?? false;
  const collector = createStreamingReplyCollector(fallbackModel, onProgress);

  while (true) {
    const { value, done } = await reader.read();
    const decodedChunk = decoder.decode(value ?? new Uint8Array(), { stream: !done });
    collector.pushTextChunk(decodedChunk, isEventStream);
    if (done) break;
  }

  return collector.finish();
}

function classifyDiagnosis(args: {
  prepared: Awaited<ReturnType<typeof prepareCollaboratorReplyRequest>>;
  execution: Awaited<ReturnType<typeof executePreparedRequest>>;
  evaluation: OutputRunResult['evaluation'];
  evidence: OutputRunResult['evidence'];
  testCase: OutputStabilityCase;
  reply: AssistantReply;
  parsed: ReturnType<typeof parseAssistantReplyContent>;
}): OutputRunResult['diagnosis'] {
  const { prepared, execution, evaluation, evidence, reply, parsed, testCase } = args;

  if (prepared.audit.budgetUsage.preflightStatus === 'overflow') {
    return {
      owner: 'polaris',
      kind: 'preflight_overflow',
      note: '还没发请求就被自己的预算挡住了，这更像 Polaris 上下文组织或预算配置问题。',
      confidence: 0.96
    };
  }

  if (!execution.ok) {
    return {
      owner: 'record',
      kind: execution.streamRequested ? 'stream_transport_failure' : 'request_failure',
      note: '这轮请求本身失败，先记账，不直接定责到模型正文质量或 Polaris 渲染。',
      confidence: 0.94
    };
  }

  if (evaluation.passed) {
    return {
      owner: 'pass',
      kind: evaluation.acceptedToolPathUsed ? 'stable_room_landing' : 'stable',
      note:
        evaluation.acceptedToolPathUsed
          ? '这轮代码稳定进了房间，而且关键结构和可见投影都够用。'
          : '这轮正文长度、关键模式和链路都稳定。',
      confidence: 0.98
    };
  }

  if (evaluation.unexpectedToolDrift) {
    return {
      owner: 'model',
      kind: 'unexpected_tool_drift',
      note: '这轮用了当前 case 不接受的工具路径，更像模型或工具提示策略问题。',
      confidence: 0.9
    };
  }

  if (!evaluation.expectedCompletionTurnsEnough) {
    return {
      owner: 'model',
      kind: 'long_workflow_stall',
      note: '长任务里前置读取或阶段写入发生过，但没有在要求的阶段数内持续完成写入，更像模型长程执行策略或工具结果回放提示需要优化。',
      confidence: 0.78
    };
  }

  if (evaluation.acceptedToolPathUsed && !evaluation.completionToolPathUsed) {
    return {
      owner: 'model',
      kind: 'read_only_tool_stall',
      note: '这轮选了相关工具，但只停在读取/检查，没有落到完成任务所需的写入或应用工具。',
      confidence: 0.84
    };
  }

  if (parsed.parsed.issues.length > 0) {
    return {
      owner: 'model',
      kind: 'parse_or_schema_drift',
      note: '模型输出里带了 Polaris 结构，但格式不稳定，先归模型或接入策略优化。',
      confidence: 0.86
    };
  }

  if (evidence.progressExceededFinalVisible) {
    return {
      owner: 'polaris',
      kind: 'final_visible_regression',
      note: '流式过程中明明出现过足够正文，最后成品却变短了，更像 Polaris 自己的收尾或显示链在吃内容。',
      confidence: 0.78
    };
  }

  if (reply.content.length >= testCase.minVisibleChars && parsed.visibleContent.length < testCase.minVisibleChars) {
    return {
      owner: 'polaris',
      kind: 'visible_projection_loss',
      note: '原始回复长度够，但可见内容投影掉得异常，更像 Polaris 解析/投影链的问题。',
      confidence: 0.82
    };
  }

  if ((reply.thinkingText?.length ?? 0) > parsed.visibleContent.length * 1.2 && (reply.thinkingText?.length ?? 0) > 600) {
    return {
      owner: 'model',
      kind: 'thinking_pressure',
      note: '思考链占比明显压过可见正文，更像模型把预算花在 thinking 里了。',
      confidence: 0.72
    };
  }

  if (!evaluation.expectedPatternsEnough || !evaluation.expectedVisibleEnough) {
    return {
      owner: 'model',
      kind: testCase.category === 'code' ? 'code_output_truncated' : 'text_output_truncated',
      note: '请求成功了，但模型没有给够正文或关键结构，更像供应商/模型端输出稳定性问题。',
      confidence: 0.74
    };
  }

  return {
    owner: 'record',
    kind: 'needs_pattern_check',
    note: '这轮结果还不够单点定责，先记账等多轮模式。',
    confidence: 0.42
  };
}

function resolveRecommendedAction(diagnosis: OutputRunResult['diagnosis']): OutputRunResult['recommendedAction'] {
  if (diagnosis.owner === 'pass') {
    return {
      class: 'pass',
      nextStep: '保留这轮结果作为后续对照基线。'
    };
  }
  if (diagnosis.owner === 'polaris') {
    return {
      class: 'fix',
      nextStep: '进 Polaris 结构排查；如果一处修复能批量消掉同类掉字/截断问题，就直接修。'
    };
  }
  if (diagnosis.owner === 'model') {
    return {
      class: 'optimize',
      nextStep: '归档为模型/接入策略问题，后续统一优化 prompt、tool context、thinking 配置或供应商选型。'
    };
  }
  return {
    class: 'record',
    nextStep: '先记录，不做补丁式处理，等更多轮结果一起看。'
  };
}

function buildSummary(results: OutputRunResult[]) {
  const byRun: Record<string, unknown> = {};
  for (const model of models) {
    for (const profile of selectedProfiles) {
      const subset = results.filter((entry) => entry.model === model.id && entry.profile === profile.id);
      const total = subset.length;
      byRun[`${model.id} :: ${profile.id}`] = {
        cases: total,
        passRate: ratio(subset.filter((entry) => entry.evaluation.passed).length, total),
        visibleEnoughRate: ratio(subset.filter((entry) => entry.evaluation.expectedVisibleEnough).length, total),
        patternHitRate: ratio(subset.filter((entry) => entry.evaluation.expectedPatternsEnough).length, total),
        acceptedToolPathRate: ratio(subset.filter((entry) => entry.evaluation.acceptedToolPathUsed).length, total),
        fixCount: subset.filter((entry) => entry.recommendedAction.class === 'fix').length,
        optimizeCount: subset.filter((entry) => entry.recommendedAction.class === 'optimize').length,
        recordCount: subset.filter((entry) => entry.recommendedAction.class === 'record').length,
        averageVisibleChars: average(subset.map((entry) => entry.reply.visibleChars)),
        averageThinkingChars: average(subset.map((entry) => entry.reply.thinkingChars)),
        averageToolCapabilityTokens: average(subset.map((entry) => entry.requestPrepared.toolCapabilityTokens)),
        averageInputTokens: average(subset.map((entry) => tokenUsageNumber(entry.reply.tokenUsage?.inputTokens))),
        averageOutputTokens: average(subset.map((entry) => tokenUsageNumber(entry.reply.tokenUsage?.outputTokens))),
        averageCachedInputTokens: average(subset.map((entry) => tokenUsageNumber(entry.reply.tokenUsage?.cachedInputTokens))),
        averageCacheCreationInputTokens: average(subset.map((entry) => tokenUsageNumber(entry.reply.tokenUsage?.cacheCreationInputTokens))),
        averageReasoningTokens: average(subset.map((entry) => tokenUsageNumber(entry.reply.tokenUsage?.reasoningTokens))),
        cacheStatus: subset[0]?.requestPrepared.cache.status ?? null,
        cacheSendsExplicitControl: subset[0]?.requestPrepared.cache.sendsExplicitCacheControl ?? false
      };
    }
  }
  return {
    totalCases: results.length,
    byRun
  };
}

function buildComparisons(results: OutputRunResult[]) {
  const comparisons: Array<Record<string, unknown>> = [];
  const grouped = new Map<string, OutputRunResult[]>();
  for (const entry of results) {
    const key = `${entry.model}::${entry.round}::${entry.caseId}`;
    const current = grouped.get(key) ?? [];
    current.push(entry);
    grouped.set(key, current);
  }

  for (const [key, entries] of grouped.entries()) {
    const baseline = entries.find((entry) => entry.profile === 'baseline');
    const toolsOn = entries.find((entry) => entry.profile === 'tools_on');
    if (baseline && toolsOn) {
      comparisons.push({
        key,
        comparison: 'tools_pressure',
        baselineVisibleChars: baseline.reply.visibleChars,
        toolsOnVisibleChars: toolsOn.reply.visibleChars,
        visibleDelta: toolsOn.reply.visibleChars - baseline.reply.visibleChars,
        baselineToolCapabilityTokens: baseline.requestPrepared.toolCapabilityTokens,
        toolsOnToolCapabilityTokens: toolsOn.requestPrepared.toolCapabilityTokens,
        suspicion:
          baseline.reply.visibleChars >= baseline.requestPrepared.budgetTokens * 0 // keep shape stable
          && baseline.evaluation.expectedVisibleEnough
          && !toolsOn.evaluation.expectedVisibleEnough
          ? 'tools_on_may_be_eating_output_budget'
          : null
      });
    }
  }
  return comparisons;
}

function renderSummary(summary: { totalCases: number; byRun: Record<string, any> }) {
  const lines = [
    'Polaris chat output stability monitor',
    `cases=${summary.totalCases}`
  ];
  for (const [label, runSummary] of Object.entries(summary.byRun)) {
    lines.push(
      '',
      label,
      `  passRate=${runSummary.passRate}%`,
      `  visibleEnoughRate=${runSummary.visibleEnoughRate}%`,
      `  patternHitRate=${runSummary.patternHitRate}%`,
      `  acceptedToolPathRate=${runSummary.acceptedToolPathRate}%`,
      `  fixCount=${runSummary.fixCount}`,
      `  optimizeCount=${runSummary.optimizeCount}`,
      `  recordCount=${runSummary.recordCount}`,
      `  averageVisibleChars=${runSummary.averageVisibleChars}`,
      `  averageThinkingChars=${runSummary.averageThinkingChars}`,
      `  averageToolCapabilityTokens=${runSummary.averageToolCapabilityTokens}`,
      `  averageInputTokens=${runSummary.averageInputTokens}`,
      `  averageOutputTokens=${runSummary.averageOutputTokens}`,
      `  averageCachedInputTokens=${runSummary.averageCachedInputTokens}`,
      `  averageCacheCreationInputTokens=${runSummary.averageCacheCreationInputTokens}`,
      `  averageReasoningTokens=${runSummary.averageReasoningTokens}`,
      `  cacheStatus=${runSummary.cacheStatus}`,
      `  cacheSendsExplicitControl=${runSummary.cacheSendsExplicitControl}`
    );
  }
  return lines.join('\n');
}

function tokenUsageNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(hit: number, total: number) {
  if (!total) return 0;
  return Number(((hit / total) * 100).toFixed(1));
}
