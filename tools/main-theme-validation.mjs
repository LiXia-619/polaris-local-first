import { mkdir, writeFile } from 'node:fs/promises';
import { TEST_CASES } from './main-theme-validation-cases.mjs';
import {
  buildExecutableActionMetrics,
  buildExecutableTransportMetrics,
  buildValidationContext,
  dedupe,
  extractValidationAliases,
  parseCsv,
  ratio,
  resolveValidationProviderMeta,
  resolveTransports,
  runThemeValidationRequest
} from './theme-validation-shared.mjs';
import {
  resolveValidationApiKey,
  resolveValidationModels
} from './theme-validation-config.mjs';

const key = resolveValidationApiKey();
if (!key) {
  throw new Error('missing validation API key');
}

const api =
  process.env.VALIDATION_API
  ?? process.env.OPENROUTER_API
  ?? process.env.SILICON_API
  ?? 'https://api.siliconflow.cn/v1/chat/completions';
const provider = resolveValidationProviderMeta(api, process.env.PROVIDER_LABEL);
const rounds = Number(process.env.ROUNDS ?? 3);
const concurrency = Number(process.env.CONCURRENCY ?? 4);
const outDir = process.env.OUT_DIR ?? 'tmp';
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 45000);
const groupFilter = parseCsv(process.env.GROUPS);
const caseFilter = parseCsv(process.env.CASE_IDS);
const transports = resolveTransports(process.env.TRANSPORTS);

const MODEL_REGISTRY = {
  small: { id: 'Qwen/Qwen2.5-7B-Instruct', tier: 'small' },
  medium: { id: 'deepseek-ai/DeepSeek-V3', tier: 'medium' },
  strong: { id: 'moonshotai/Kimi-K2-Thinking', tier: 'strong' }
};

const models = resolveValidationModels(process.env.VALIDATION_MODELS ?? process.env.MODELS, MODEL_REGISTRY, 'small,medium');
const selectedCases = TEST_CASES.filter((testCase) => {
  const groupMatch = groupFilter.length === 0 || groupFilter.includes(testCase.group);
  const caseMatch = caseFilter.length === 0 || caseFilter.includes(testCase.id);
  return groupMatch && caseMatch;
});

const jobs = [];
for (const model of models) {
  for (const transport of transports) {
    for (let round = 1; round <= rounds; round += 1) {
      for (const testCase of selectedCases) {
        jobs.push({ model, transport, round, testCase });
      }
    }
  }
}

const results = [];
let cursor = 0;

async function worker() {
  while (cursor < jobs.length) {
    const index = cursor;
    cursor += 1;
    results.push(await runOne(jobs[index]));
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const report = {
  reportKind: 'main-theme',
  generatedAt: new Date().toISOString(),
  provider,
  rounds,
  concurrency,
  api,
  transports,
  models,
  selectedCaseIds: selectedCases.map((testCase) => testCase.id),
  summary: buildSummary(results),
  results
};

await mkdir(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = `${outDir}/main-theme-validation-${timestamp}.json`;
await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(renderSummary(report.summary));
console.log(`\nJSON -> ${outputPath}`);

async function runOne(job) {
  const { model, transport, round, testCase } = job;
  const context = buildValidationContext({
    activeWorld: testCase.activeWorld,
    collectionShelf: testCase.collectionShelf,
    modelTier: model.tier,
    lastUserMessage: testCase.prompt,
    activeConversationTitle: '主题判活实验',
    visibleCards: testCase.group === 'D'
      ? [
          { id: 'card-candy', title: '糖果罐', language: 'html', tags: ['html', '糖果'], kind: 'code', code: '<div>candy</div>' },
          { id: 'card-star', title: '接星星小游戏', language: 'html', tags: ['html', '游戏'], kind: 'code', code: '<div>star</div>' },
          { id: 'card-gift', title: '给Aeve的小礼物', language: 'html', tags: ['html', '礼物'], kind: 'code', code: '<div>gift</div>' },
          { id: 'conv-pharos', title: 'Pharos~我要改卡片本身', language: 'text', tags: ['对话'], kind: 'dialogue', code: 'Pharos 对话卡摘要' }
        ]
      : []
  });

  const response = await runThemeValidationRequest({
    api,
    key,
    model: model.id,
    modelTier: model.tier,
    prompt: testCase.prompt,
    context,
    requestTimeoutMs,
    transport
  });

  const evaluation = evaluateCase(testCase, response.actions);
  return {
    model: model.id,
    tier: model.tier,
    transport,
    round,
    group: testCase.group,
    caseId: testCase.id,
    prompt: testCase.prompt,
    ok: response.ok,
    http: response.http,
    latencyMs: response.latencyMs,
    raw: response.raw,
    displayContent: response.displayContent,
    actions: response.actions,
    issues: response.issues,
    usedNativeToolCalls: response.usedNativeToolCalls,
    nativeToolCallCount: response.nativeToolCallCount,
    requestedNativeTools: response.requestedNativeTools,
    nativeToolParseSucceeded: response.nativeToolParseSucceeded,
    attemptCount: response.attemptCount,
    rateLimitRetryCount: response.rateLimitRetryCount,
    transientRetryCount: response.transientRetryCount,
    evaluation
  };
}

function evaluateCase(testCase, actions) {
  const aliases = dedupe(actions.flatMap((action) => extractValidationAliases(action)));
  const kinds = dedupe(actions.map((action) => action.kind));
  const hasExecutableAction = actions.length > 0;
  const expectedAliases = testCase.expectedAliases ?? [];
  const forbiddenAliases = testCase.forbiddenAliases ?? [];
  const hitExpectedTarget = !expectedAliases.length || aliases.some((alias) => expectedAliases.includes(alias));
  const unexpectedForbiddenTarget = forbiddenAliases.some((alias) => aliases.includes(alias));
  const backgroundOnlyFailure =
    expectedAliases.some((alias) => alias.includes('card'))
    && !hitExpectedTarget
    && aliases.includes('collection-background');
  const expectedKindHit = !testCase.expectedKinds?.length || kinds.some((kind) => testCase.expectedKinds.includes(kind));
  const wholeGroupHit = !testCase.requireWholeGroup || aliases.some((alias) => alias.startsWith(`${testCase.requireWholeGroup}-`));

  return {
    hasExecutableAction,
    hasTool: hasExecutableAction,
    aliases,
    kinds,
    hitExpectedTarget,
    backgroundOnlyFailure,
    unexpectedForbiddenTarget,
    expectedKindHit,
    wholeGroupHit
  };
}

function buildSummary(results) {
  const byRun = {};
  for (const model of models) {
    for (const transport of transports) {
      const subset = results.filter((result) => result.model === model.id && result.transport === transport);
      const actionMetrics = buildExecutableActionMetrics(subset);
      const transportMetrics = buildExecutableTransportMetrics(subset);
      byRun[`${model.id} :: ${transport}`] = {
        cases: subset.length,
        ...actionMetrics,
        expectedTargetRate: ratio(subset.filter((result) => result.evaluation.hitExpectedTarget).length, subset.length),
        expectedKindRate: ratio(subset.filter((result) => result.evaluation.expectedKindHit).length, subset.length),
        forbiddenTargetMissCount: subset.filter((result) => result.evaluation.unexpectedForbiddenTarget).length,
        ...transportMetrics
      };
    }
  }
  return { totalCases: results.length, byRun };
}

function renderSummary(summary) {
  const lines = [
    'Polaris main theme validation',
    `cases=${summary.totalCases}`
  ];
  for (const [label, runSummary] of Object.entries(summary.byRun)) {
    lines.push(
      '',
      label,
      `  actionCompletionRate=${runSummary.actionCompletionRate}%`,
      `  expectedTargetRate=${runSummary.expectedTargetRate}%`,
      `  expectedKindRate=${runSummary.expectedKindRate}%`,
      `  requestedNativeToolRate=${runSummary.requestedNativeToolRate}%`,
      `  nativeToolCallRate=${runSummary.nativeToolCallRate}%`,
      `  nativeTextFallbackRate=${runSummary.nativeTextFallbackRate}%`,
      `  nativeActionParseRate=${runSummary.nativeActionParseRate}%`,
      `  rateLimitedCount=${runSummary.rateLimitedCount}`,
      `  forbiddenTargetMissCount=${runSummary.forbiddenTargetMissCount}`
    );
  }
  return lines.join('\n');
}
