import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildExecutableActionMetrics,
  buildExecutableTransportMetrics
} from './theme-validation-shared.mjs';

const outDir = process.env.OUT_DIR ?? 'tmp';
const stableLocalPath = await resolveReportPath(process.env.STABLE_LOCAL_REPORT, 'stable-theme-local-validation-');
const mainPath = await resolveReportPath(process.env.MAIN_REPORT, 'main-theme-validation-');
const conversationPath = await resolveReportPath(process.env.CONVERSATION_REPORT, 'theme-conversation-validation-');

const stableLocal = await readJsonReport(stableLocalPath);
const main = await readJsonReport(mainPath);
const conversation = await readJsonReport(conversationPath);

const report = {
  reportKind: 'theme-validation-matrix',
  generatedAt: new Date().toISOString(),
  sources: {
    stableLocal: stableLocalPath,
    main: mainPath,
    conversation: conversationPath
  },
  provider: resolveProvider(main, conversation),
  summary: buildSummary({ stableLocal, main, conversation })
};

await mkdir(outDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(outDir, `theme-validation-matrix-${timestamp}.json`);
const markdownPath = path.join(outDir, `theme-validation-matrix-${timestamp}.md`);

await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
await writeFile(markdownPath, renderMarkdown(report), 'utf8');

console.log(renderConsoleSummary(report));
console.log(`\nJSON -> ${jsonPath}`);
console.log(`Markdown -> ${markdownPath}`);

async function resolveReportPath(explicitPath, prefix) {
  if (explicitPath?.trim()) return explicitPath.trim();

  const entries = await readdir(outDir, { withFileTypes: true }).catch(() => []);
  const latest = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  return latest ? path.join(outDir, latest) : null;
}

async function readJsonReport(reportPath) {
  if (!reportPath) return null;
  try {
    const raw = await readFile(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveProvider(main, conversation) {
  const explicit = main?.provider ?? conversation?.provider;
  if (explicit) return explicit;

  const api = main?.api ?? conversation?.api;
  if (typeof api !== 'string') return null;

  try {
    const apiHost = new URL(api).host;
    if (apiHost.includes('siliconflow.cn')) {
      return { label: 'siliconflow', apiHost };
    }
    if (apiHost.includes('openai.com')) {
      return { label: 'openai-compatible', apiHost };
    }
    return { label: apiHost, apiHost };
  } catch {
    return null;
  }
}

function buildSummary({ stableLocal, main, conversation }) {
  const riskGroups = {
    stableLocal: [],
    main: [],
    conversation: []
  };

  const addRisk = (group, message) => {
    riskGroups[group].push(message);
  };

  const stableLocalSummary = stableLocal
    ? {
        presetRouteOk: countStablePresetOk(stableLocal),
        presetTotal: stableLocal.presetChecks?.length ?? 0,
        nativeThemeCallParseOk:
          stableLocal.parserChecks?.nativeToolCallCount === 1
          && stableLocal.parserChecks?.parsedActionKind === 'applyThemeCoordinates'
          && stableLocal.parserChecks?.parsedTargets === 'all'
          && (stableLocal.parserChecks?.parsedIssues?.length ?? 0) === 0,
        surfaceTokenFallbackOk:
          Array.isArray(stableLocal.parserChecks?.inferredKinds)
          && stableLocal.parserChecks.inferredKinds.length > 0
          && stableLocal.parserChecks.inferredKinds.every((kind) => kind === 'applySurfaceTokens')
          && (stableLocal.parserChecks?.inferredIssues?.length ?? 0) === 0,
        coordinateRouteOk:
          stableLocal.coordinateChecks?.ok === true
          && stableLocal.coordinateChecks?.sameSeedMatches === true
          && stableLocal.coordinateChecks?.differentSeedDiffers === true
          && stableLocal.coordinateChecks?.coordinateLayersPresent === true,
        surfaceRouteOk:
          stableLocal.coordinateChecks?.ok === true
          && stableLocal.coordinateChecks?.surfaceLayersPresent === true
          && stableLocal.coordinateChecks?.composerTouched === true,
        previewApplyRollbackOk:
          stableLocal.previewFlowChecks?.previewMessageOk === true
          && stableLocal.previewFlowChecks?.applyOk === true
          && stableLocal.previewFlowChecks?.rollbackOk === true,
        status: summarizeStableLocalStatus(stableLocal)
      }
    : null;

  if (!stableLocalSummary) {
    addRisk('stableLocal', '缺少 stable local 报告，当前矩阵看不到离线主链是否仍然闭环。');
  }

  const mainRows = collectRunRows(buildMainRunMetrics(main));
  if (!mainRows.length) {
    addRisk('main', '缺少 main theme 报告，当前矩阵看不到单轮主题命中率。');
  }

  const conversationRows = collectRunRows(buildConversationRunMetrics(conversation));
  if (!conversationRows.length) {
    addRisk('conversation', '缺少 conversation 报告，当前矩阵看不到连续对话稳定性。');
  }

  mainRows.forEach((row) => {
    if ((row.rateLimitedCount ?? 0) > 0) {
      addRisk('main', `${row.label} 含 ${row.rateLimitedCount} 个 rate-limited case，先清配额噪音再判断 native 兼容。`);
    }
    if ((row.actionCompletionRate ?? 0) < 85) {
      addRisk('main', `${row.label} 的 actionCompletionRate 低于 85%，主链路仍有掉动作风险。`);
    }
    if ((row.expectedTargetRate ?? 0) < 75) {
      addRisk('main', `${row.label} 的 expectedTargetRate 低于 75%，目标命中还不稳。`);
    }
    if (row.label.includes('native') && (row.requestedNativeToolRate ?? 0) < 100) {
      addRisk('main', `${row.label} 的 requestedNativeToolRate 低于 100%，验证请求本身没有稳定带上 native tools。`);
    }
    if (
      row.label.includes('native')
      && (row.nativeToolCallRate ?? 0) < 60
      && (row.rateLimitedCount ?? 0) === 0
      && (row.nativeTextFallbackRate ?? 0) >= 60
      && (row.actionCompletionRate ?? 0) >= 85
    ) {
      addRisk('main', `${row.label} 的 provider 更多走文本 tool fence fallback，不是主工具链失手，但原生 tool_call 兼容仍偏弱。`);
    } else if (row.label.includes('native') && (row.nativeToolCallRate ?? 0) < 60 && (row.rateLimitedCount ?? 0) === 0) {
      addRisk('main', `${row.label} 的 nativeToolCallRate 低于 60%，provider 原生 tools 兼容仍偏弱。`);
    }
    if (
      row.label.includes('native')
      && (row.nativeToolCallRate ?? 0) >= 60
      && (row.nativeActionParseRate ?? 0) + 20 < (row.nativeToolCallRate ?? 0)
    ) {
      addRisk('main', `${row.label} 的 nativeToolCallRate 明显高于 nativeActionParseRate，native call -> action 归一化接缝还在漏。`);
    }
  });

  conversationRows.forEach((row) => {
    if ((row.rateLimitedTurnCount ?? 0) > 0) {
      addRisk('conversation', `${row.label} 含 ${row.rateLimitedTurnCount} 个 rate-limited turn，连续性结果里带着配额噪音。`);
    }
    if ((row.turnPassRate ?? 0) < 60) {
      addRisk('conversation', `${row.label} 的 turnPassRate 低于 60%，连续改图还不够稳。`);
    }
    if ((row.continuityRate ?? 0) < 70) {
      addRisk('conversation', `${row.label} 的 continuityRate 低于 70%，上下文延续还容易丢。`);
    }
    if (row.label.includes('native') && (row.requestedNativeToolRate ?? 0) < 100) {
      addRisk('conversation', `${row.label} 的 requestedNativeToolRate 低于 100%，连续对话验证没有稳定带上 native tools。`);
    }
    if (
      row.label.includes('native')
      && (row.nativeToolCallRate ?? 0) < 60
      && (row.rateLimitedTurnCount ?? 0) === 0
      && (row.nativeTextFallbackRate ?? 0) >= 60
      && (row.actionCompletionRate ?? 0) >= 85
    ) {
      addRisk('conversation', `${row.label} 更多走文本 tool fence fallback，用户向链路基本仍通，但 provider 原生 tool_call 兼容偏弱。`);
    } else if (row.label.includes('native') && (row.nativeToolCallRate ?? 0) < 60 && (row.rateLimitedTurnCount ?? 0) === 0) {
      addRisk('conversation', `${row.label} 的 nativeToolCallRate 低于 60%，native provider 兼容本身仍偏弱。`);
    }
    if (
      row.label.includes('native')
      && (row.nativeToolCallRate ?? 0) >= 60
      && (row.nativeActionParseRate ?? 0) + 20 < (row.nativeToolCallRate ?? 0)
    ) {
      addRisk('conversation', `${row.label} 的 nativeToolCallRate 明显高于 nativeActionParseRate，连续对话里 native parse seam 还在漏。`);
    }
  });

  const risks = [...riskGroups.stableLocal, ...riskGroups.main, ...riskGroups.conversation];

  return {
    stableLocal: stableLocalSummary,
    mainRows,
    conversationRows,
    risks,
    riskGroups
  };
}

function countStablePresetOk(report) {
  return (report.presetChecks ?? []).filter((item) => item.ok && item.hasStableProfile).length;
}

function summarizeStableLocalStatus(report) {
  const total = report.presetChecks?.length ?? 0;
  const ok =
    countStablePresetOk(report) === total
    && report.parserChecks?.nativeToolCallCount === 1
    && report.parserChecks?.parsedActionKind === 'applyThemeCoordinates'
    && report.parserChecks?.parsedTargets === 'all'
    && (report.parserChecks?.parsedIssues?.length ?? 0) === 0
    && Array.isArray(report.parserChecks?.inferredKinds)
    && report.parserChecks.inferredKinds.length > 0
    && report.parserChecks.inferredKinds.every((kind) => kind === 'applySurfaceTokens')
    && (report.parserChecks?.inferredIssues?.length ?? 0) === 0
    && report.coordinateChecks?.ok === true
    && report.coordinateChecks?.sameSeedMatches === true
    && report.coordinateChecks?.differentSeedDiffers === true
    && report.coordinateChecks?.coordinateLayersPresent === true
    && report.coordinateChecks?.surfaceLayersPresent === true
    && report.coordinateChecks?.composerTouched === true
    && report.previewFlowChecks?.previewMessageOk === true
    && report.previewFlowChecks?.applyOk === true
    && report.previewFlowChecks?.rollbackOk === true;
  return ok ? 'pass' : 'warn';
}

function collectRunRows(byRun) {
  return Object.entries(byRun ?? {}).map(([label, metrics]) => ({
    label,
    ...metrics,
    status: summarizeRunStatus(label, metrics)
  }));
}

function buildMainRunMetrics(report) {
  const base = { ...(report?.summary?.byRun ?? {}) };
  const grouped = new Map();

  for (const result of report?.results ?? []) {
    const label = `${result.model} :: ${result.transport}`;
    const items = grouped.get(label) ?? [];
    items.push(result);
    grouped.set(label, items);
  }

  grouped.forEach((entries, label) => {
    const actionMetrics = buildExecutableActionMetrics(entries);
    const derived = buildExecutableTransportMetrics(entries);
    base[label] = {
      ...(base[label] ?? {}),
      actionCompletionRate: base[label]?.actionCompletionRate ?? base[label]?.toolRate ?? actionMetrics.actionCompletionRate,
      toolRate: base[label]?.toolRate ?? actionMetrics.toolRate,
      ...derived
    };
  });

  return base;
}

function buildConversationRunMetrics(report) {
  const base = { ...(report?.summary?.byRun ?? {}) };
  const grouped = new Map();

  for (const result of report?.results ?? []) {
    const label = `${result.model} :: ${result.transport}`;
    const turns = grouped.get(label) ?? [];
    turns.push(...(result.turnResults ?? []));
    grouped.set(label, turns);
  }

  grouped.forEach((turns, label) => {
    const actionMetrics = buildExecutableActionMetrics(turns);
    const derived = buildExecutableTransportMetrics(turns);
    base[label] = {
      ...(base[label] ?? {}),
      actionCompletionRate: base[label]?.actionCompletionRate ?? base[label]?.toolRate ?? actionMetrics.actionCompletionRate,
      toolRate: base[label]?.toolRate ?? actionMetrics.toolRate,
      requestedNativeToolRate: derived.requestedNativeToolRate,
      nativeToolCallRate: derived.nativeToolCallRate,
      nativeTextFallbackRate: derived.nativeTextFallbackRate,
      nativeActionParseRate: derived.nativeActionParseRate,
      rateLimitedTurnCount: derived.rateLimitedCount
    };
  });

  return base;
}

function summarizeRunStatus(label, metrics) {
  if ('expectedTargetRate' in metrics) {
    if ((metrics.rateLimitedCount ?? 0) > 0) return 'noisy';
    if (label.includes('native') && (metrics.requestedNativeToolRate ?? 0) < 100) return 'warn';
    if (
      label.includes('native')
      && (metrics.nativeToolCallRate ?? 0) >= 60
      && (metrics.nativeActionParseRate ?? 0) + 20 < (metrics.nativeToolCallRate ?? 0)
    ) {
      return 'warn';
    }
    if (
      label.includes('native')
      && (metrics.nativeToolCallRate ?? 0) < 60
      && (metrics.nativeTextFallbackRate ?? 0) >= 60
      && (metrics.actionCompletionRate ?? 0) >= 85
      && (metrics.expectedTargetRate ?? 0) >= 80
    ) {
      return 'pass';
    }
    if ((metrics.actionCompletionRate ?? 0) >= 90 && (metrics.expectedTargetRate ?? 0) >= 80) return 'pass';
    if (label.includes('native') && (metrics.nativeToolCallRate ?? 0) < 60) return 'warn';
    return 'warn';
  }

  if ((metrics.rateLimitedTurnCount ?? 0) > 0) return 'noisy';
  if (label.includes('native') && (metrics.requestedNativeToolRate ?? 0) < 100) return 'warn';
  if (
    label.includes('native')
    && (metrics.nativeToolCallRate ?? 0) < 60
    && (metrics.nativeTextFallbackRate ?? 0) >= 60
    && (metrics.actionCompletionRate ?? 0) >= 85
    && (metrics.turnPassRate ?? 0) >= 70
    && (metrics.continuityRate ?? 0) >= 75
  ) {
    return 'pass';
  }
  if (label.includes('native') && (metrics.nativeToolCallRate ?? 0) < 60) return 'warn';
  if (
    label.includes('native')
    && (metrics.nativeToolCallRate ?? 0) >= 60
    && (metrics.nativeActionParseRate ?? 0) + 20 < (metrics.nativeToolCallRate ?? 0)
  ) {
    return 'warn';
  }
  if ((metrics.turnPassRate ?? 0) >= 70 && (metrics.continuityRate ?? 0) >= 75) return 'pass';
  return 'warn';
}

function renderConsoleSummary(report) {
  const lines = [
    'Polaris theme validation matrix',
    `provider=${report.provider?.label ?? 'unknown'}`,
    `stableLocal=${report.summary.stableLocal?.status ?? 'missing'}`,
    `mainRuns=${report.summary.mainRows.length}`,
    `conversationRuns=${report.summary.conversationRows.length}`,
    `risks=${report.summary.risks.length}`
  ];

  report.summary.mainRows.forEach((row) => {
    lines.push(`${row.label} :: target=${row.expectedTargetRate ?? '-'} action=${row.actionCompletionRate ?? row.toolRate ?? '-'} requested=${formatNativeMetric(row, row.requestedNativeToolRate)} native=${formatNativeMetric(row, row.nativeToolCallRate)} fallback=${formatNativeMetric(row, row.nativeTextFallbackRate)} parsed=${formatNativeMetric(row, row.nativeActionParseRate)} rateLimited=${row.rateLimitedCount ?? 0} status=${row.status}`);
  });
  report.summary.conversationRows.forEach((row) => {
    lines.push(`${row.label} :: turn=${row.turnPassRate ?? '-'} action=${row.actionCompletionRate ?? row.toolRate ?? '-'} continuity=${row.continuityRate ?? '-'} requested=${formatNativeMetric(row, row.requestedNativeToolRate)} native=${formatNativeMetric(row, row.nativeToolCallRate)} fallback=${formatNativeMetric(row, row.nativeTextFallbackRate)} parsed=${formatNativeMetric(row, row.nativeActionParseRate)} rateLimited=${row.rateLimitedTurnCount ?? 0} status=${row.status}`);
  });

  return lines.join('\n');
}

function renderMarkdown(report) {
  const stable = report.summary.stableLocal;
  const lines = [
    '# Polaris Theme Validation Matrix',
    '',
    `- 生成时间：${report.generatedAt}`,
    `- Provider：${report.provider?.label ?? 'unknown'}${report.provider?.apiHost ? ` (${report.provider.apiHost})` : ''}`,
    `- stable local 报告：${report.sources.stableLocal ?? 'missing'}`,
    `- main 报告：${report.sources.main ?? 'missing'}`,
    `- conversation 报告：${report.sources.conversation ?? 'missing'}`,
    ''
  ];

  lines.push('## Stable Local');
  if (!stable) {
    lines.push('', '- missing');
  } else {
    lines.push(
      '',
      `- 状态：${stable.status}`,
      `- preset route ok：${stable.presetRouteOk}/${stable.presetTotal}`,
      `- native theme call parse ok：${stable.nativeThemeCallParseOk}`,
      `- surface token fallback ok：${stable.surfaceTokenFallbackOk}`,
      `- coordinate route ok：${stable.coordinateRouteOk}`,
      `- surface route ok：${stable.surfaceRouteOk}`,
      `- preview/apply/rollback ok：${stable.previewApplyRollbackOk}`
    );
  }

  lines.push('', '## Main Matrix', '');
  if (!report.summary.mainRows.length) {
    lines.push('- missing');
  } else {
    report.summary.mainRows.forEach((row) => {
      lines.push(`- ${row.label}: target=${row.expectedTargetRate}% action=${row.actionCompletionRate ?? row.toolRate}% requested=${formatNativeMetric(row, row.requestedNativeToolRate)} native=${formatNativeMetric(row, row.nativeToolCallRate)} fallback=${formatNativeMetric(row, row.nativeTextFallbackRate)} parsed=${formatNativeMetric(row, row.nativeActionParseRate)} rateLimited=${row.rateLimitedCount} status=${row.status}`);
    });
  }

  lines.push('', '## Conversation Matrix', '');
  if (!report.summary.conversationRows.length) {
    lines.push('- missing');
  } else {
    report.summary.conversationRows.forEach((row) => {
      lines.push(`- ${row.label}: turn=${row.turnPassRate}% action=${row.actionCompletionRate ?? row.toolRate}% continuity=${row.continuityRate}% requested=${formatNativeMetric(row, row.requestedNativeToolRate)} native=${formatNativeMetric(row, row.nativeToolCallRate)} fallback=${formatNativeMetric(row, row.nativeTextFallbackRate)} parsed=${formatNativeMetric(row, row.nativeActionParseRate)} rateLimited=${row.rateLimitedTurnCount} status=${row.status}`);
    });
  }

  lines.push('', '## Risks', '');
  const groups = [
    ['Stable Local', report.summary.riskGroups?.stableLocal ?? []],
    ['Main', report.summary.riskGroups?.main ?? []],
    ['Conversation', report.summary.riskGroups?.conversation ?? []]
  ];

  if (!report.summary.risks.length) {
    lines.push('- none');
  } else {
    groups.forEach(([title, items]) => {
      lines.push(`### ${title}`);
      if (!items.length) {
        lines.push('- none');
        return;
      }
      items.forEach((risk) => {
        lines.push(`- ${risk}`);
      });
      lines.push('');
    });
  }

  return lines.join('\n');
}

function formatNativeMetric(row, value) {
  return (row.requestedNativeToolRate ?? 0) > 0 ? `${value ?? 0}` : '-';
}
