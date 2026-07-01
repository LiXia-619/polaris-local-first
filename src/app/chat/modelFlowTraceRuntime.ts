import { isModelFlowTraceCaptureEnabled } from '../developer/debugCaptureRuntime';
import { createDebugLog } from '../../infrastructure/debugLog';
import type { AssistantReply } from '../../engines/chatApi';
import type { AssistantRequestAudit } from '../../engines/request/requestAudit';
import { buildRequestInspectorModel, type AssistantRequestInspectorModel } from '../../engines/request/requestInspector';
import { projectToolResultPayloadForRequest } from '../../engines/request/requestToolResultProjection';
import type { ToolAction } from '../../engines/toolExecutor';
import type { ChatMessage, ChatTokenUsage, ToolLedgerEntry } from '../../types/domain';
import type { AssistantToolPreparationOutcome, ToolActionRunOutcome } from './chatToolOutcome';

export type ModelFlowReasoningSignal =
  | 'tool_selection'
  | 'missing_context'
  | 'target_resolution'
  | 'error_interpretation'
  | 'followup_planning';

export type ModelFlowTraceEntry = {
  at: number;
  conversationId: string;
  collaboratorId: string;
  assistantName: string;
  assistantMessageId: string | null;
  requestId: string | null;
  modelId: string | null;
  phase: 'completed' | 'tooling_blocked' | 'request_failed' | 'aborted';
  userIntent: string;
  request: {
    inspector: AssistantRequestInspectorModel | null;
    promptParts: Array<{
      name: AssistantRequestAudit['promptParts'][number]['name'];
      layer: AssistantRequestAudit['promptParts'][number]['layer'];
      status: AssistantRequestInspectorModel['promptParts'][number]['status'];
      charCount: number;
    }>;
    visibleToolNames: string[];
    projectionMaterials: AssistantRequestInspectorModel['projectionMaterials'];
  };
  reasoningEvidence: {
    available: boolean;
    source: 'provider-thinking' | 'none';
    excerpt: string;
    signals: ModelFlowReasoningSignal[];
  };
  response: {
    finishReason: string | null;
    transportIncomplete?: boolean;
    visibleReply: string;
    toolDraftBlockCount?: number;
    usedNativeToolCalls: boolean;
    nativeToolCallCount: number;
    tokenCount: number | null;
    tokenUsage: ChatTokenUsage | null;
  };
  toolPlan: {
    preparationStatus: AssistantToolPreparationOutcome['status'] | 'request_failed' | 'aborted';
    declaredActionKinds: string[];
    resolvedActionKinds: ToolAction['kind'][];
    parseIssues: string[];
    message: string | null;
  };
  toolExecution: Array<{
    path: ToolActionRunOutcome['path'];
    kind: ToolAction['kind'];
    status: string;
    title: string;
    targetLabel: string | null;
    summary: string | null;
    error: string | null;
  }>;
  toolResultProjection: Array<{
    toolCallId: string;
    toolName: string;
    resultMessageId: string | null;
    resultStatus: string | null;
    projectedKeys: string[];
    detailProjection: 'full' | 'excerpt' | 'omitted' | 'none';
    isError: boolean;
  }>;
  verdict: 'pass' | 'warn' | 'fail';
  reasons: string[];
};

export type ModelFlowTraceSummary = {
  total: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  latestIssues: Array<{
    at: number;
    assistantName: string;
    phase: ModelFlowTraceEntry['phase'];
    verdict: 'warn' | 'fail';
    reasons: string[];
    userIntent: string;
  }>;
};

export type ModelFlowTraceRecordArgs = {
  phase: ModelFlowTraceEntry['phase'];
  toolPreparationStatus: ModelFlowTraceEntry['toolPlan']['preparationStatus'];
  conversationId: string;
  collaboratorId: string;
  assistantName: string;
  assistantMessageId?: string | null;
  messages: ChatMessage[];
  audit?: AssistantRequestAudit | null;
  visibleReply?: string;
  reply?: AssistantReply;
  preparationOutcome?: AssistantToolPreparationOutcome;
  resolvedActions?: ToolAction[];
  outcomes?: ToolActionRunOutcome[];
  toolLedger?: ToolLedgerEntry[];
};

const MODEL_FLOW_TRACE_STORAGE_KEY = 'polaris-model-flow-trace-log';
const MODEL_FLOW_TRACE_LIMIT = 80;
export const MODEL_FLOW_TRACE_EVENT = 'polaris:model-flow-trace-updated';

const modelFlowTraceLog = createDebugLog<ModelFlowTraceEntry>(MODEL_FLOW_TRACE_STORAGE_KEY, {
  maxEntries: MODEL_FLOW_TRACE_LIMIT,
  broadcastEvent: MODEL_FLOW_TRACE_EVENT
});

function truncate(text: string | undefined | null, maxLength = 600) {
  const value = text?.trim() ?? '';
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function countToolDraftBlocks(text: string | undefined | null) {
  return text?.match(/```polaris-tools\b/gi)?.length ?? 0;
}

function getLatestUserIntent(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user' && !message.toolInvocation && message.content.trim())
    ?.content
    ?.trim()
    ?? '';
}

function inferReasoningSignals(thinkingText: string): ModelFlowReasoningSignal[] {
  const text = thinkingText.toLowerCase();
  const signals: ModelFlowReasoningSignal[] = [];
  if (/tool|工具|调用|schema|function/.test(text)) signals.push('tool_selection');
  if (/context|上下文|看不到|不知道|missing|unclear/.test(text)) signals.push('missing_context');
  if (/target|目标|文件|project|workspace|工作区|id\b|path/.test(text)) signals.push('target_resolution');
  if (/error|错误|报错|failed|failure|exception/.test(text)) signals.push('error_interpretation');
  if (/next|继续|follow|然后|下一步/.test(text)) signals.push('followup_planning');
  return signals;
}

function buildReasoningEvidence(reply: AssistantReply | undefined) {
  const thinkingText = reply?.thinkingText?.trim() ?? '';
  return {
    available: Boolean(thinkingText),
    source: thinkingText ? 'provider-thinking' as const : 'none' as const,
    excerpt: truncate(thinkingText, 900),
    signals: thinkingText ? inferReasoningSignals(thinkingText) : []
  };
}

function simplifyOutcome(outcome: ToolActionRunOutcome) {
  if (outcome.path === 'direct') {
    return {
      path: outcome.path,
      kind: outcome.action.kind,
      status: outcome.status,
      title: outcome.toolInvocation.title,
      targetLabel: outcome.toolInvocation.targetLabel ?? null,
      summary: truncate(outcome.toolInvocation.summary, 180) || null,
      error: outcome.error ?? outcome.toolInvocation.error ?? null
    };
  }

  return {
    path: outcome.path,
    kind: outcome.action.kind,
    status: outcome.status,
    title: outcome.action.kind,
    targetLabel: 'targetLabel' in outcome.action && typeof outcome.action.targetLabel === 'string'
      ? outcome.action.targetLabel
      : null,
    summary: null,
    error: 'error' in outcome ? outcome.error ?? null : null
  };
}

function resolveDetailProjection(projected: Record<string, unknown>) {
  if (typeof projected.detailText === 'string') return 'full' as const;
  if (typeof projected.detailExcerpt === 'string') return 'excerpt' as const;
  if (projected.detailOmitted === true) return 'omitted' as const;
  return 'none' as const;
}

function buildToolResultProjection(args: {
  assistantMessageId: string | null;
  toolLedger: ToolLedgerEntry[] | undefined;
}) {
  if (!args.assistantMessageId) return [];

  return (args.toolLedger ?? [])
    .filter((entry) => entry.assistantMessageId === args.assistantMessageId)
    .map((entry) => {
      const payload = entry.resultStructuredPayload ?? {};
      const projected = projectToolResultPayloadForRequest(payload, {
        toolName: entry.resultToolName ?? entry.toolName,
        kind: typeof payload.kind === 'string' ? payload.kind : entry.resultToolName ?? entry.toolName
      });
      return {
        toolCallId: entry.toolCallId,
        toolName: entry.toolName,
        resultMessageId: entry.resultMessageId ?? null,
        resultStatus: entry.resultStatus ?? null,
        projectedKeys: Object.keys(projected).sort(),
        detailProjection: resolveDetailProjection(projected),
        isError: entry.resultIsError === true || projected.isError === true
      };
    });
}

function buildRequestSection(audit: AssistantRequestAudit | null | undefined) {
  if (!audit) {
    return {
      inspector: null,
      promptParts: [],
      visibleToolNames: [],
      projectionMaterials: []
    };
  }

  const inspector = buildRequestInspectorModel(audit);
  return {
    inspector,
    promptParts: inspector.promptParts.map((part) => ({
      name: part.name,
      layer: part.layer,
      status: part.status,
      charCount: part.charCount
    })),
    visibleToolNames: inspector.registryTools,
    projectionMaterials: inspector.projectionMaterials
  };
}

function buildToolPlan(args: ModelFlowTraceRecordArgs) {
  return {
    preparationStatus: args.toolPreparationStatus,
    declaredActionKinds: args.preparationOutcome?.parsed.actions.map((action) => action.kind) ?? [],
    resolvedActionKinds: args.resolvedActions?.map((action) => action.kind) ?? [],
    parseIssues: args.preparationOutcome?.parsed.issues ?? [],
    message: args.preparationOutcome && args.preparationOutcome.status !== 'ready'
      ? args.preparationOutcome.message
      : null
  };
}

function buildVerdict(entry: Omit<ModelFlowTraceEntry, 'verdict' | 'reasons'>): Pick<ModelFlowTraceEntry, 'verdict' | 'reasons'> {
  const reasons: string[] = [];

  if (!entry.request.inspector) {
    reasons.push('这一轮没有留下 request audit，无法确认模型实际看见了什么。');
  }
  if (entry.phase === 'request_failed') {
    reasons.push('请求本身失败，流程停在 provider/request 层。');
  }
  if (entry.phase === 'aborted') {
    reasons.push('这一轮被中途停止，trace 只能作为部分证据。');
  }
  if (entry.toolPlan.preparationStatus === 'parse_failed') {
    reasons.push('模型输出了工具意图，但工具格式没有解析通过。');
  }
  if (entry.toolPlan.preparationStatus === 'resolution_failed') {
    reasons.push('模型输出了工具意图，但 Polaris 没能解析到有效目标。');
  }
  if (entry.toolPlan.preparationStatus === 'missing_actions') {
    reasons.push('这轮期待工具动作，但没有形成可执行动作。');
  }
  if (entry.response.transportIncomplete === true) {
    reasons.push('流式回复没有正常结束，系统按不完整输出处理。');
  }
  if (entry.response.finishReason === 'length') {
    reasons.push('模型回复因为长度限制结束，可能截断了正文或工具参数。');
  }

  const failedExecutions = entry.toolExecution.filter((outcome) => outcome.status === 'failed');
  if (failedExecutions.length > 0) {
    reasons.push(`有 ${failedExecutions.length} 个工具执行失败。`);
  }
  if (
    (entry.response.toolDraftBlockCount ?? 0) > 0
    && entry.toolExecution.length === 0
    && entry.toolResultProjection.length === 0
  ) {
    reasons.push('回复里还有界面动作草稿，但没有对应的工具执行或结果投影证据。');
  }
  if (entry.toolExecution.length > 0 && entry.toolResultProjection.length === 0) {
    reasons.push('工具执行了，但没有对应的下一轮结果投影证据。');
  }

  if (reasons.length === 0) {
    return {
      verdict: 'pass',
      reasons: entry.toolExecution.length > 0
        ? ['这轮从模型可见环境到工具执行和结果投影都有连续证据。']
        : ['这轮没有执行工具，request/response 证据完整。']
    };
  }

  return {
    verdict: entry.phase === 'request_failed'
      || entry.toolPlan.preparationStatus === 'parse_failed'
      || failedExecutions.length > 0
      || (
        (entry.response.toolDraftBlockCount ?? 0) > 0
        && entry.toolExecution.length === 0
        && entry.toolResultProjection.length === 0
      )
      ? 'fail'
      : 'warn',
    reasons
  };
}

export function buildModelFlowTraceEntry(args: ModelFlowTraceRecordArgs, at = Date.now()): ModelFlowTraceEntry {
  const assistantMessageId = args.assistantMessageId?.trim() || null;
  const request = buildRequestSection(args.audit);
  const draftEntry = {
    at,
    conversationId: args.conversationId,
    collaboratorId: args.collaboratorId,
    assistantName: args.assistantName,
    assistantMessageId,
    requestId: args.audit?.requestId ?? null,
    modelId: (args.reply?.model?.trim() || args.audit?.modelId) ?? null,
    phase: args.phase,
    userIntent: truncate(getLatestUserIntent(args.messages), 320),
    request,
    reasoningEvidence: buildReasoningEvidence(args.reply),
    response: {
      finishReason: args.reply?.finishReason?.trim() || null,
      transportIncomplete: args.reply?.transportIncomplete === true,
      visibleReply: truncate(args.visibleReply, 320),
      toolDraftBlockCount: countToolDraftBlocks(args.reply?.content ?? args.visibleReply),
      usedNativeToolCalls: args.reply?.usedNativeToolCalls === true,
      nativeToolCallCount: args.reply?.nativeToolCallCount ?? args.reply?.nativeToolCalls?.length ?? 0,
      tokenCount: typeof args.reply?.tokenCount === 'number' ? args.reply.tokenCount : null,
      tokenUsage: args.reply?.tokenUsage ?? null
    },
    toolPlan: buildToolPlan(args),
    toolExecution: (args.outcomes ?? []).map(simplifyOutcome),
    toolResultProjection: buildToolResultProjection({
      assistantMessageId,
      toolLedger: args.toolLedger
    })
  };
  const verdict = buildVerdict(draftEntry);
  return { ...draftEntry, ...verdict };
}

export function readModelFlowTraceEntries() {
  return modelFlowTraceLog.read();
}

export function clearModelFlowTraceEntries() {
  modelFlowTraceLog.clear();
}

export function summarizeModelFlowTraceEntries(entries = modelFlowTraceLog.read()): ModelFlowTraceSummary {
  const passCount = entries.filter((entry) => entry.verdict === 'pass').length;
  const warnCount = entries.filter((entry) => entry.verdict === 'warn').length;
  const failCount = entries.filter((entry) => entry.verdict === 'fail').length;

  return {
    total: entries.length,
    passCount,
    warnCount,
    failCount,
    latestIssues: [...entries]
      .reverse()
      .filter((entry): entry is ModelFlowTraceEntry & { verdict: 'warn' | 'fail' } => entry.verdict !== 'pass')
      .slice(0, 8)
      .map((entry) => ({
        at: entry.at,
        assistantName: entry.assistantName,
        phase: entry.phase,
        verdict: entry.verdict,
        reasons: entry.reasons,
        userIntent: entry.userIntent
      }))
  };
}

export function recordModelFlowTrace(args: ModelFlowTraceRecordArgs) {
  if (!isModelFlowTraceCaptureEnabled()) return;
  modelFlowTraceLog.append(buildModelFlowTraceEntry(args));
}
