import { mkdir, writeFile } from 'node:fs/promises';
import { CONVERSATION_SCENARIOS } from './theme-conversation-validation-cases.mjs';
import {
  buildExecutableActionMetrics,
  buildExecutableTransportMetrics,
  buildValidationContext,
  classifyConversationTurnFailure,
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
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 45000);
const outDir = process.env.OUT_DIR ?? 'tmp';
const scenarioFilter = parseCsv(process.env.SCENARIOS);
const transports = resolveTransports(process.env.TRANSPORTS);

const MODEL_REGISTRY = {
  small: { id: 'Qwen/Qwen2.5-7B-Instruct', tier: 'small' },
  medium: { id: 'deepseek-ai/DeepSeek-V3', tier: 'medium' },
  strong: { id: 'moonshotai/Kimi-K2-Thinking', tier: 'strong' }
};

const models = resolveValidationModels(process.env.VALIDATION_MODELS ?? process.env.MODELS, MODEL_REGISTRY, 'small,medium');
const scenarios = CONVERSATION_SCENARIOS.filter((scenario) =>
  scenarioFilter.length === 0 || scenarioFilter.includes(scenario.id)
);

const results = [];
for (const model of models) {
  for (const transport of transports) {
    for (const scenario of scenarios) {
      results.push(await runScenario(model, transport, scenario));
    }
  }
}

const report = {
  reportKind: 'conversation-theme',
  generatedAt: new Date().toISOString(),
  provider,
  api,
  transports,
  models,
  scenarioIds: scenarios.map((scenario) => scenario.id),
  summary: buildSummary(results),
  results
};

await mkdir(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = `${outDir}/theme-conversation-validation-${timestamp}.json`;
await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

console.log(renderSummary(report.summary));
console.log(`\nJSON -> ${outputPath}`);

async function runScenario(model, transport, scenario) {
  const turnResults = [];

  for (const [index, turn] of scenario.turns.entries()) {
    const themeFocus = buildThemeFocusFromTurnResults(scenario, turnResults);
    const context = buildValidationContext({
      activeWorld: scenario.activeWorld,
      collectionShelf: scenario.collectionShelf,
      modelTier: model.tier,
      lastUserMessage: turn.user,
      themeFocus,
      activeConversationTitle: '连续对话验证'
    });
    const response = await runThemeValidationRequest({
      api,
      key,
      model: model.id,
      modelTier: model.tier,
      prompt: turn.user,
      context,
      requestTimeoutMs,
      transport
    });

    const evaluation = evaluateTurn(turnResults, turn, response.actions);
    const failureKinds = classifyConversationTurnFailure({
      turn,
      response,
      evaluation
    });
    turnResults.push({
      turnIndex: index + 1,
      user: turn.user,
      ok: response.ok,
      http: response.http,
      latencyMs: response.latencyMs,
      raw: response.raw,
      actions: response.actions,
      issues: response.issues,
      usedNativeToolCalls: response.usedNativeToolCalls,
      nativeToolCallCount: response.nativeToolCallCount,
      requestedNativeTools: response.requestedNativeTools,
      nativeToolParseSucceeded: response.nativeToolParseSucceeded,
      attemptCount: response.attemptCount,
      rateLimitRetryCount: response.rateLimitRetryCount,
      transientRetryCount: response.transientRetryCount,
      evaluation,
      failureKinds
    });

    if (!response.ok) {
      break;
    }
  }

  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    model: model.id,
    tier: model.tier,
    transport,
    passedTurns: turnResults.filter((turn) => turn.evaluation.passed).length,
    totalTurns: scenario.turns.length,
    turnResults
  };
}

function evaluateTurn(previousTurns, turn, actions) {
  const aliases = dedupe(actions.flatMap((action) => extractValidationAliases(action)));
  const hasExecutableAction = actions.length > 0;
  const expectedAliases = turn.expectedAliases ?? [];
  const forbiddenAliases = turn.forbiddenAliases ?? [];
  const hitExpectedTarget = !expectedAliases.length || aliases.some((alias) => expectedAliases.includes(alias));
  const unexpectedForbiddenTarget = forbiddenAliases.some((alias) => aliases.includes(alias));
  const previousExpectedAliases = previousTurns.flatMap((entry) => entry.evaluation.expectedAliases ?? []);
  const continuityPool = expectedAliases.length > 0 ? expectedAliases : previousExpectedAliases;
  const continuityOk = continuityPool.length === 0 || aliases.some((alias) => continuityPool.includes(alias));
  const resetByPreset = actions.some((action) => action.kind === 'applyPreset') && expectedAliases.length > 0;

  return {
    hasExecutableAction,
    hasTool: hasExecutableAction,
    aliases,
    expectedAliases,
    hitExpectedTarget,
    continuityOk,
    resetByPreset,
    passed:
      (!turn.requireTool || hasExecutableAction)
      && hitExpectedTarget
      && !unexpectedForbiddenTarget
      && continuityOk
      && !resetByPreset
  };
}

function buildSummary(results) {
  const byRun = {};
  for (const model of models) {
    for (const transport of transports) {
      const subset = results.filter((result) => result.model === model.id && result.transport === transport);
      const turns = subset.flatMap((result) => result.turnResults);
      const failureKinds = dedupe(turns.flatMap((turn) => turn.failureKinds ?? []));
      const actionMetrics = buildExecutableActionMetrics(turns);
      const transportMetrics = buildExecutableTransportMetrics(turns);
      byRun[`${model.id} :: ${transport}`] = {
        scenarios: subset.length,
        passedScenarios: subset.filter((result) => result.passedTurns === result.totalTurns).length,
        turnPassRate: ratio(turns.filter((turn) => turn.evaluation.passed).length, turns.length),
        ...actionMetrics,
        continuityRate: ratio(turns.filter((turn) => turn.evaluation.continuityOk).length, turns.length),
        requestedNativeToolRate: transportMetrics.requestedNativeToolRate,
        nativeToolCallRate: transportMetrics.nativeToolCallRate,
        nativeTextFallbackRate: transportMetrics.nativeTextFallbackRate,
        nativeActionParseRate: transportMetrics.nativeActionParseRate,
        rateLimitedTurnCount: transportMetrics.rateLimitedCount,
        resetByPresetCount: turns.filter((turn) => turn.evaluation.resetByPreset).length,
        failureKinds: failureKinds.reduce((acc, kind) => ({
          ...acc,
          [kind]: turns.filter((turn) => (turn.failureKinds ?? []).includes(kind)).length
        }), {})
      };
    }
  }
  return { totalScenarios: results.length, byRun };
}

function renderSummary(summary) {
  const lines = [
    'Polaris theme conversation validation',
    `scenarios=${summary.totalScenarios}`
  ];
  for (const [label, runSummary] of Object.entries(summary.byRun)) {
    lines.push(
      '',
      label,
      `  passedScenarios=${runSummary.passedScenarios}/${runSummary.scenarios}`,
      `  turnPassRate=${runSummary.turnPassRate}%`,
      `  actionCompletionRate=${runSummary.actionCompletionRate}%`,
      `  continuityRate=${runSummary.continuityRate}%`,
      `  requestedNativeToolRate=${runSummary.requestedNativeToolRate}%`,
      `  nativeToolCallRate=${runSummary.nativeToolCallRate}%`,
      `  nativeTextFallbackRate=${runSummary.nativeTextFallbackRate}%`,
      `  nativeActionParseRate=${runSummary.nativeActionParseRate}%`,
      `  rateLimitedTurnCount=${runSummary.rateLimitedTurnCount}`,
      `  resetByPresetCount=${runSummary.resetByPresetCount}`,
      `  failureKinds=${JSON.stringify(runSummary.failureKinds)}`
    );
  }
  return lines.join('\n');
}

function buildThemeFocusFromTurnResults(scenario, turnResults) {
  const previousTurn = [...turnResults]
    .reverse()
    .find((entry) => entry.actions.length > 0 || entry.evaluation.expectedAliases.length > 0);
  if (!previousTurn) return undefined;

  const recentSurfaceLabels = dedupe([
    ...previousTurn.evaluation.aliases,
    ...previousTurn.evaluation.expectedAliases
  ]).slice(0, 4);
  const scopeLabel = scenario.activeWorld === 'collection' ? '收藏区局部' : '对话区局部';

  return {
    scopeLabel,
    recentSurfaceLabels,
    recentSummary: previousTurn.user,
    avoidGlobalPreset: true
  };
}
