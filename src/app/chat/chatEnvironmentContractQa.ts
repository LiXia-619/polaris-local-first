import { setDeveloperModeEnabled } from '../developer/developerModeRuntime';
import { createDebugLog } from '../../infrastructure/debugLog';
import { clearRequestDebugEntries } from '../../engines/request/requestDebugRuntime';
import { clearChatQaAuditEntries, summarizeChatQaAuditEntries } from './chatQaAuditRuntime';
import {
  clearModelFlowTraceEntries,
  readModelFlowTraceEntries,
  summarizeModelFlowTraceEntries,
  type ModelFlowTraceEntry
} from './modelFlowTraceRuntime';
import { createMessage } from '../../engines/chatMessageFactory';
import type { ChatMessage, CodeCardFileRole } from '../../types/domain';
import type { ChatDerivedState } from './chatDerivedState';
import type { ChatStoreBindings } from './useChatStoreBindings';
import type { ChatReplyRunResult } from './chatReplyRuntime';

const ENV_CONTRACT_QA_ACTIVE_PROJECT_ID = 'qa-env-contract-active-workspace';
const ENV_CONTRACT_QA_SHADOW_PROJECT_ID = 'qa-env-contract-shadow-workspace';
const ENV_CONTRACT_QA_STORAGE_KEY = 'polaris-environment-contract-qa-reports';
const ENV_CONTRACT_QA_REPORT_LIMIT = 12;
export const ENVIRONMENT_CONTRACT_QA_EVENT = 'polaris:environment-contract-qa-updated';

export type EnvironmentContractQaStage =
  | 'request_context'
  | 'provider_request'
  | 'tool_selection'
  | 'tool_resolution'
  | 'tool_execution'
  | 'tool_result_projection'
  | 'pass';

export type EnvironmentContractQaScenario = {
  id: string;
  title: string;
  prompt: string;
  expectedToolGroups: string[][];
};

export type EnvironmentContractQaScenarioReport = {
  id: string;
  title: string;
  traceCount: number;
  stages: EnvironmentContractQaStage[];
  verdict: 'pass' | 'warn' | 'fail';
  reasons: string[];
  toolNames: string[];
  models: string[];
  reasoningSignals: string[];
  reasoningExcerpts: string[];
  toolPathSummary: string[];
  projectionSummary: string[];
};

export type EnvironmentContractQaReport = {
  at: number;
  conversationId: string;
  collaboratorId: string;
  projectId: string;
  scenarioCount: number;
  traceCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  scenarios: EnvironmentContractQaScenarioReport[];
  bottlenecks: Array<{
    stage: EnvironmentContractQaStage;
    count: number;
  }>;
};

type RunEnvironmentContractQaArgs = {
  ui: {
    sending: boolean;
    setCommandStatus: (text: string, isError?: boolean) => void;
  };
  store: ChatStoreBindings;
  derived: ChatDerivedState;
  runReply: (params: {
    conversationId: string;
    collaboratorId: string;
    messages: ChatMessage[];
  }) => Promise<ChatReplyRunResult>;
};

const environmentContractQaReportLog = createDebugLog<EnvironmentContractQaReport>(
  ENV_CONTRACT_QA_STORAGE_KEY,
  {
    maxEntries: ENV_CONTRACT_QA_REPORT_LIMIT,
    broadcastEvent: ENVIRONMENT_CONTRACT_QA_EVENT
  }
);

const ENVIRONMENT_CONTRACT_SETTLEMENT_TOOLS = new Set(['completeTask']);

export const ENVIRONMENT_CONTRACT_QA_SCENARIOS: EnvironmentContractQaScenario[] = [
  {
    id: 'visibility',
    title: '可见性',
    prompt: 'Polaris 环境契约 QA / S1 可见性：当前对话已经绑定工作区。请先用工作区工具列出文件，再读取 index.html；最后只用一句话说明你看见了哪个入口文件。',
    expectedToolGroups: [['listProjectFiles'], ['readProjectFile']]
  },
  {
    id: 'boundary',
    title: '工作区边界',
    prompt: 'Polaris 环境契约 QA / S2 工作区边界：另一个影子工作区也有 index.html。请只读取当前工作区的 index.html，并说明里面的标记词；不要读取或修改其他工作区。',
    expectedToolGroups: [['readProjectFile']]
  },
  {
    id: 'continuity-write',
    title: '写入连续性',
    prompt: 'Polaris 环境契约 QA / S3 写入连续性：请把 notes.md 改成三行内容，第一行必须是「环境契约记录」，第二行写当前工具链，第三行写下一步要检查运行；必须用当前工作区文件工具落盘。',
    expectedToolGroups: [['editProjectFileText', 'replaceProjectFileLines', 'createProjectFile', 'appendProjectFile', 'insertProjectFile']]
  },
  {
    id: 'continuity-readback',
    title: '回放连续性',
    prompt: 'Polaris 环境契约 QA / S4 回放连续性：不要凭记忆回答。请根据上一轮工具结果判断 notes.md 刚刚发生了什么；如果证据不够，再读取 notes.md 后回答。',
    expectedToolGroups: []
  },
  {
    id: 'diagnostic',
    title: '运行诊断',
    prompt: 'Polaris 环境契约 QA / S5 运行诊断：请检查当前工作区预览是否可运行；如果工具返回错误，只汇报原始错误和它指向的文件，不要靠猜修。',
    expectedToolGroups: [['checkProjectPreview'], ['inspectProjectRuntime']]
  }
];

function resolveQaCollaboratorId(args: {
  store: ChatStoreBindings;
  derived: ChatDerivedState;
}) {
  const personaState = args.store.persona.readLatestState();
  const spaceState = args.store.space.readLatestState();
  return (
    spaceState.frontstageCollaboratorId
    ?? personaState.activeCollaboratorId
    ?? args.derived.persona?.id
    ?? personaState.personas[0]?.id
    ?? null
  );
}

function upsertQaProjectFile(args: {
  store: ChatStoreBindings;
  projectId: string;
  filePath: string;
  language: string;
  content: string;
  fileRole?: CodeCardFileRole;
  ownerCollaboratorId?: string;
}) {
  const existing = args.store.collection
    .readLatestState()
    .projectFiles
    .find((file) => file.projectId === args.projectId && file.filePath === args.filePath);
  if (existing) {
    args.store.collection.updateProjectFile(existing.id, {
      language: args.language,
      content: args.content,
      fileRole: args.fileRole,
      ownerCollaboratorId: args.ownerCollaboratorId,
      source: 'manual'
    });
    return existing.id;
  }

  return args.store.collection.createProjectFile({
    projectId: args.projectId,
    filePath: args.filePath,
    language: args.language,
    content: args.content,
    fileRole: args.fileRole,
    ownerCollaboratorId: args.ownerCollaboratorId,
    source: 'manual'
  });
}

function prepareEnvironmentContractWorkspaces(store: ChatStoreBindings, ownerCollaboratorId: string) {
  const activeProjectId = store.collection.createProject({
    id: ENV_CONTRACT_QA_ACTIVE_PROJECT_ID,
    title: 'QA 环境契约工作区',
    slug: 'qa-env-contract-active',
    tags: ['qa', 'environment-contract'],
    ownerCollaboratorId,
    source: 'manual'
  });
  const shadowProjectId = store.collection.createProject({
    id: ENV_CONTRACT_QA_SHADOW_PROJECT_ID,
    title: 'QA 影子工作区',
    slug: 'qa-env-contract-shadow',
    tags: ['qa', 'environment-contract', 'shadow'],
    ownerCollaboratorId,
    source: 'manual'
  });
  store.collection.updateProject(activeProjectId, { ownerCollaboratorId });
  store.collection.updateProject(shadowProjectId, { ownerCollaboratorId });

  upsertQaProjectFile({
    store,
    projectId: activeProjectId,
    filePath: 'index.html',
    language: 'html',
    fileRole: 'entry',
    ownerCollaboratorId,
    content: [
      '<main data-qa-marker="ACTIVE_ENV_CONTRACT">',
      '  <h1>Active environment contract workspace</h1>',
      '  <p id="status">Ready for Polaris environment QA.</p>',
      '  <script src="script.js"></script>',
      '</main>'
    ].join('\n')
  });
  upsertQaProjectFile({
    store,
    projectId: activeProjectId,
    filePath: 'script.js',
    language: 'javascript',
    fileRole: 'logic',
    ownerCollaboratorId,
    content: 'document.querySelector("#status").textContent = "ACTIVE_ENV_CONTRACT_READY";'
  });
  upsertQaProjectFile({
    store,
    projectId: activeProjectId,
    filePath: 'notes.md',
    language: 'markdown',
    fileRole: 'note',
    ownerCollaboratorId,
    content: '# QA notes\n\n等待环境契约测试写入。'
  });
  upsertQaProjectFile({
    store,
    projectId: shadowProjectId,
    filePath: 'index.html',
    language: 'html',
    fileRole: 'entry',
    ownerCollaboratorId,
    content: '<main data-qa-marker="SHADOW_ENV_CONTRACT"><h1>Shadow workspace</h1></main>'
  });

  return activeProjectId;
}

async function clearEnvironmentContractDebugLogs() {
  clearRequestDebugEntries();
  clearChatQaAuditEntries();
  clearModelFlowTraceEntries();
}

function classifyTraceEntry(entry: ModelFlowTraceEntry): EnvironmentContractQaStage[] {
  const stages: EnvironmentContractQaStage[] = [];
  if (!entry.request.inspector) stages.push('request_context');
  if (entry.phase === 'request_failed') stages.push('provider_request');
  if (entry.toolPlan.preparationStatus !== 'ready') stages.push('tool_resolution');
  if (entry.toolExecution.some((outcome) => outcome.status === 'failed')) stages.push('tool_execution');
  const projectedToolNames = new Set(entry.toolResultProjection.map((projection) => projection.toolName));
  const domainExecutions = entry.toolExecution.filter((outcome) => !ENVIRONMENT_CONTRACT_SETTLEMENT_TOOLS.has(outcome.kind));
  if (
    domainExecutions.some((outcome) => outcome.status === 'executed' && !projectedToolNames.has(outcome.kind))
  ) {
    stages.push('tool_result_projection');
  }
  return stages.length > 0 ? stages : ['pass'];
}

function resolveScenarioVerdict(stages: EnvironmentContractQaStage[]): EnvironmentContractQaScenarioReport['verdict'] {
  if (
    stages.includes('request_context')
    || stages.includes('provider_request')
    || stages.includes('tool_resolution')
    || stages.includes('tool_execution')
  ) {
    return 'fail';
  }
  if (stages.some((stage) => stage !== 'pass')) return 'warn';
  return 'pass';
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function summarizeToolPath(trace: ModelFlowTraceEntry) {
  const declared = trace.toolPlan.declaredActionKinds.length > 0
    ? `declared=${trace.toolPlan.declaredActionKinds.join(',')}`
    : '';
  const resolved = trace.toolPlan.resolvedActionKinds.length > 0
    ? `resolved=${trace.toolPlan.resolvedActionKinds.join(',')}`
    : '';
  const executed = trace.toolExecution.length > 0
    ? `executed=${trace.toolExecution.map((outcome) => `${outcome.kind}:${outcome.status}`).join(',')}`
    : '';
  return [declared, resolved, executed].filter(Boolean).join(' | ');
}

function summarizeProjection(trace: ModelFlowTraceEntry) {
  return trace.toolResultProjection
    .map((projection) => {
      const keys = projection.projectedKeys.length > 0 ? projection.projectedKeys.join(',') : 'none';
      return `${projection.toolName}:${projection.detailProjection}:${keys}`;
    })
    .join(' | ');
}

function getExecutedDomainToolNames(traces: ModelFlowTraceEntry[]) {
  return uniqueStrings(traces.flatMap((trace) =>
    trace.toolExecution
      .filter((outcome) => outcome.status === 'executed' && !ENVIRONMENT_CONTRACT_SETTLEMENT_TOOLS.has(outcome.kind))
      .map((outcome) => outcome.kind)
  ));
}

function findMissingExpectedToolGroups(args: {
  scenario: EnvironmentContractQaScenario;
  traces: ModelFlowTraceEntry[];
}) {
  const executedToolNames = new Set(getExecutedDomainToolNames(args.traces));
  return args.scenario.expectedToolGroups.filter((toolNames) =>
    !toolNames.some((toolName) => executedToolNames.has(toolName))
  );
}

function formatToolGroup(toolNames: string[]) {
  return toolNames.join(' 或 ');
}

function buildScenarioReport(args: {
  scenario: EnvironmentContractQaScenario;
  traces: ModelFlowTraceEntry[];
}): EnvironmentContractQaScenarioReport {
  const missingExpectedToolGroups = findMissingExpectedToolGroups(args);
  const stages = uniqueStrings([
    ...args.traces.flatMap(classifyTraceEntry),
    ...(missingExpectedToolGroups.length > 0 ? ['tool_selection' as const] : [])
  ]) as EnvironmentContractQaStage[];
  const effectiveStages = stages.length > 0 ? stages : ['request_context' as const];
  const reasons = uniqueStrings([
    ...args.traces.flatMap((trace) => trace.reasons),
    ...(missingExpectedToolGroups.length > 0
      ? [`这个场景要求模型实际执行 ${missingExpectedToolGroups.map(formatToolGroup).join('，以及 ')}；当前 trace 没有这些领域工具的执行证据。`]
      : [])
  ]);
  const toolNames = uniqueStrings(args.traces.flatMap((trace) => [
    ...trace.request.visibleToolNames,
    ...trace.toolExecution.map((outcome) => outcome.kind)
  ]));
  const models = uniqueStrings(args.traces.map((trace) => trace.modelId ?? 'unknown'));
  const reasoningSignals = uniqueStrings(args.traces.flatMap((trace) => trace.reasoningEvidence.signals));
  const reasoningExcerpts = uniqueStrings(args.traces.map((trace) => trace.reasoningEvidence.excerpt)).slice(0, 3);
  const toolPathSummary = uniqueStrings(args.traces.map(summarizeToolPath));
  const projectionSummary = uniqueStrings(args.traces.map(summarizeProjection));

  return {
    id: args.scenario.id,
    title: args.scenario.title,
    traceCount: args.traces.length,
    stages: effectiveStages,
    verdict: resolveScenarioVerdict(effectiveStages),
    reasons: args.traces.length > 0
      ? reasons
      : ['这个场景没有留下 model-flow trace，无法判断模型看见了什么或工具链走到哪里。'],
    toolNames,
    models,
    reasoningSignals,
    reasoningExcerpts,
    toolPathSummary,
    projectionSummary
  };
}

function countBottlenecks(scenarios: EnvironmentContractQaScenarioReport[]) {
  const counts = new Map<EnvironmentContractQaStage, number>();
  for (const scenario of scenarios) {
    for (const stage of scenario.stages) {
      if (stage === 'pass') continue;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((left, right) => right.count - left.count);
}

export function buildEnvironmentContractQaReport(args: {
  at?: number;
  conversationId: string;
  collaboratorId: string;
  projectId: string;
  scenarioTraceEntries: Array<{
    scenario: EnvironmentContractQaScenario;
    traces: ModelFlowTraceEntry[];
  }>;
}): EnvironmentContractQaReport {
  const scenarios = args.scenarioTraceEntries.map(buildScenarioReport);
  return {
    at: args.at ?? Date.now(),
    conversationId: args.conversationId,
    collaboratorId: args.collaboratorId,
    projectId: args.projectId,
    scenarioCount: scenarios.length,
    traceCount: scenarios.reduce((total, scenario) => total + scenario.traceCount, 0),
    passCount: scenarios.filter((scenario) => scenario.verdict === 'pass').length,
    warnCount: scenarios.filter((scenario) => scenario.verdict === 'warn').length,
    failCount: scenarios.filter((scenario) => scenario.verdict === 'fail').length,
    scenarios,
    bottlenecks: countBottlenecks(scenarios)
  };
}

export function readEnvironmentContractQaReports() {
  return environmentContractQaReportLog.read();
}

export function clearEnvironmentContractQaReports() {
  environmentContractQaReportLog.clear();
}

export function readLatestEnvironmentContractQaReport() {
  const reports = readEnvironmentContractQaReports();
  return reports[reports.length - 1] ?? null;
}

function formatList(label: string, values: string[]) {
  return values.length > 0 ? `- ${label}：${values.join('、')}` : '';
}

function formatScenarioReport(scenario: EnvironmentContractQaScenarioReport) {
  const lines = [
    `## ${scenario.title} (${scenario.id})`,
    `- 结果：${scenario.verdict}`,
    `- trace：${scenario.traceCount}`,
    formatList('阶段', scenario.stages),
    formatList('模型', scenario.models),
    formatList('工具', scenario.toolNames.slice(0, 12)),
    formatList('thinking signals', scenario.reasoningSignals),
    scenario.toolPathSummary.length > 0 ? '- 工具路径：' : '',
    ...scenario.toolPathSummary.map((item) => `  - ${item}`),
    scenario.projectionSummary.length > 0 ? '- 回放投影：' : '',
    ...scenario.projectionSummary.map((item) => `  - ${item}`),
    scenario.reasons.length > 0 ? '- 判断理由：' : '',
    ...scenario.reasons.map((reason) => `  - ${reason}`),
    scenario.reasoningExcerpts.length > 0 ? '- thinking 摘录：' : '',
    ...scenario.reasoningExcerpts.map((excerpt) => `  - ${excerpt}`)
  ];
  return lines.filter(Boolean).join('\n');
}

export function formatEnvironmentContractQaReport(report: EnvironmentContractQaReport) {
  const bottleneckText = report.bottlenecks.length > 0
    ? report.bottlenecks.map((item) => `${item.stage} x ${item.count}`).join('；')
    : '无';
  return [
    '# Polaris 环境契约 QA 报告',
    '',
    `生成时间：${new Date(report.at).toISOString()}`,
    `对话：${report.conversationId}`,
    `工作区：${report.projectId}`,
    '',
    `总览：${report.scenarioCount} 个场景，trace ${report.traceCount} 条，pass ${report.passCount}，warn ${report.warnCount}，fail ${report.failCount}。`,
    `主要卡点：${bottleneckText}`,
    '',
    ...report.scenarios.map(formatScenarioReport)
  ].join('\n\n');
}

export async function runEnvironmentContractQa({
  ui,
  store,
  derived,
  runReply
}: RunEnvironmentContractQaArgs) {
  if (ui.sending) {
    ui.setCommandStatus('当前还有回复在生成，等它结束后再跑 Polaris 环境契约 QA。', true);
    return;
  }

  const collaboratorId = resolveQaCollaboratorId({ store, derived });
  if (!collaboratorId) {
    ui.setCommandStatus('没有可用协作者，先新建或选择一个协作者再跑环境契约 QA。', true);
    return;
  }

  setDeveloperModeEnabled(true);
  await clearEnvironmentContractDebugLogs();
  store.runtime.setTaskModeEnabled(true);
  store.runtime.setToolPromptGroupEnabled('project', true);

  const projectId = prepareEnvironmentContractWorkspaces(store, collaboratorId);
  const conversationId = store.chat.createConversation(collaboratorId, {
    activeProjectId: projectId
  });
  store.chat.setActiveConversation(conversationId);
  store.chat.setConversationActiveProject(conversationId, projectId);
  store.space.setWorld('chat');
  store.space.clearPendingAttachments();
  store.space.clearPendingCardReference();

  const scenarioTraceEntries: Array<{
    scenario: EnvironmentContractQaScenario;
    traces: ModelFlowTraceEntry[];
  }> = [];

  for (let index = 0; index < ENVIRONMENT_CONTRACT_QA_SCENARIOS.length; index += 1) {
    const scenario = ENVIRONMENT_CONTRACT_QA_SCENARIOS[index]!;
    const beforeTraceCount = readModelFlowTraceEntries().length;
    const writableConversation = await store.chat.ensureConversationWritable(conversationId);
    if (!writableConversation) {
      ui.setCommandStatus('Polaris 环境契约 QA 无法读取对话历史，已停止。', true);
      return;
    }
    const userMessage = createMessage('user', scenario.prompt, undefined, 'user-input');
    const nextMessages = [
      ...writableConversation.messages,
      userMessage
    ];
    store.chat.addMessage(writableConversation, userMessage);
    ui.setCommandStatus(`Polaris 环境契约 QA：${index + 1}/${ENVIRONMENT_CONTRACT_QA_SCENARIOS.length} · ${scenario.title}`);
    const replyResult = await runReply({
      conversationId,
      collaboratorId,
      messages: nextMessages
    });
    if (replyResult.status === 'aborted') {
      ui.setCommandStatus(`已停止 Polaris 环境契约 QA：停在 ${scenario.title}。`, true);
      return;
    }
    scenarioTraceEntries.push({
      scenario,
      traces: readModelFlowTraceEntries().slice(beforeTraceCount)
    });
  }

  const report = buildEnvironmentContractQaReport({
    conversationId,
    collaboratorId,
    projectId,
    scenarioTraceEntries
  });
  environmentContractQaReportLog.append(report);

  const traceSummary = summarizeModelFlowTraceEntries();
  const qaSummary = summarizeChatQaAuditEntries();
  const bottleneckText = report.bottlenecks.length > 0
    ? `；主要卡点：${report.bottlenecks.map((item) => `${item.stage}×${item.count}`).join('、')}`
    : '';
  ui.setCommandStatus(
    `Polaris 环境契约 QA 完成：场景 ${report.scenarioCount} 个，pass ${report.passCount}，warn ${report.warnCount}，fail ${report.failCount}；trace ${traceSummary.total} 条，audit ${qaSummary.total} 条${bottleneckText}。`
  );
}
