import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

type QaCheck = {
  id: string;
  passed: boolean;
  detail?: unknown;
};

type DeveloperBridgeSummary = {
  total: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  latestFailures: unknown[];
  latestIssues?: unknown[];
};

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 4187);
const baseUrl = `http://${host}:${port}`;
const outDir = process.env.OUT_DIR ?? 'tmp/chat-ui-qa';
const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = `${outDir}/${runTimestamp}`;
const headed = process.env.HEADED === '1';

const server = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

let serverLogs = '';
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

server.stdout.on('data', (chunk) => {
  serverLogs += String(chunk);
});
server.stderr.on('data', (chunk) => {
  serverLogs += String(chunk);
});

try {
  await mkdir(runDir, { recursive: true });
  await waitForServer(`${baseUrl}/?debugQa=1`);

  browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 1
  });
  const report = await runUiQa(page);
  const reportPath = `${runDir}/chat-ui-qa-${runTimestamp}.json`;
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(renderSummary(report.checks));
  console.log(`Artifacts -> ${runDir}`);
  console.log(`JSON -> ${reportPath}`);

  if (report.checks.some((check) => !check.passed)) {
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  stopServer(server);
}

async function runUiQa(page: Page) {
  const checks: QaCheck[] = [];
  const screenshotPath = `${runDir}/chat-ui-qa-${runTimestamp}.png`;

  await page.goto(`${baseUrl}/?debugQa=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  const worldState = await ensureChatWorld(page);
  await page.waitForSelector('.app-shell.chat .chat-composer textarea', { timeout: 20_000 });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const shellState = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    const composer = document.querySelector<HTMLTextAreaElement>('.chat-composer textarea');
    const sendButton = document.querySelector<HTMLButtonElement>('.send-btn');
    return {
      hasShell: Boolean(shell),
      shellClass: shell?.className ?? '',
      hasComposer: Boolean(composer),
      composerDisabled: composer?.disabled ?? null,
      composerPlaceholder: composer?.placeholder ?? '',
      sendButtonLabel: sendButton?.getAttribute('aria-label') ?? '',
      sendButtonDisabled: sendButton?.disabled ?? null
    };
  });

  checks.push({
    id: 'app-shell-mounted',
    passed: shellState.hasShell && String(shellState.shellClass).includes('chat'),
    detail: { ...shellState, worldState }
  });
  checks.push({
    id: 'chat-composer-ready',
    passed:
      shellState.hasComposer
      && shellState.composerDisabled === false
      && typeof shellState.composerPlaceholder === 'string'
      && shellState.composerPlaceholder.length > 0
      && shellState.sendButtonLabel === '发送消息'
      && shellState.sendButtonDisabled === false,
    detail: shellState
  });

  const bridgeReady = await waitForDeveloperBridge(page);
  checks.push({
    id: 'developer-bridge-ready',
    passed: bridgeReady.ready,
    detail: bridgeReady
  });

  let summary: DeveloperBridgeSummary | null = null;
  let flowSummary: DeveloperBridgeSummary | null = null;
  let snapshot: unknown = null;
  if (bridgeReady.ready) {
    await page.evaluate(async () => {
      window.__polarisDev?.enable();
      await window.__polarisDev?.clearChatQaAuditEntries();
      await window.__polarisDev?.clearModelFlowTraceEntries();
    });
    summary = await page.evaluate(async () => (
      await window.__polarisDev!.summarizeChatQaAuditEntries()
    )) as DeveloperBridgeSummary;
    flowSummary = await page.evaluate(async () => (
      await window.__polarisDev!.summarizeModelFlowTraceEntries()
    )) as DeveloperBridgeSummary;
    snapshot = await page.evaluate(async () => await window.__polarisDev!.snapshot());
  }

  checks.push({
    id: 'chat-qa-audit-readable',
    passed:
      Boolean(summary)
      && summary?.total === 0
      && summary?.warnCount === 0
      && summary?.failCount === 0,
    detail: summary
  });
  checks.push({
    id: 'model-flow-trace-readable',
    passed:
      Boolean(flowSummary)
      && flowSummary?.total === 0
      && flowSummary?.warnCount === 0
      && flowSummary?.failCount === 0,
    detail: flowSummary
  });
  checks.push({
    id: 'developer-snapshot-readable',
    passed: Boolean(snapshot && typeof snapshot === 'object'),
    detail: snapshot
  });

  return {
    reportKind: 'chat-ui-qa-runner',
    generatedAt: new Date().toISOString(),
    baseUrl,
    screenshotPath,
    checks,
    serverLogs: serverLogs.slice(-4000)
  };
}

async function ensureChatWorld(page: Page) {
  const before = await readActiveWorld(page);
  if (before === 'chat') {
    return { switched: false, before, after: before };
  }

  const switchToChat = page.getByLabel('切换到对话');
  if (await switchToChat.count()) {
    await switchToChat.first().click();
    await switchToChat.first().click();
  } else {
    const veil = page.locator('.world-switch-veil[aria-label="切换到对话"]');
    await veil.click();
    await veil.click();
  }
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.classList.contains('chat') === true,
    undefined,
    { timeout: 20_000 }
  );

  return {
    switched: true,
    before,
    after: await readActiveWorld(page)
  };
}

async function readActiveWorld(page: Page) {
  return await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    if (shell?.classList.contains('chat')) return 'chat';
    if (shell?.classList.contains('collection')) return 'collection';
    return 'unknown';
  });
}

async function waitForDeveloperBridge(page: Page, retries = 80) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const ready = await page.evaluate(() => Boolean(window.__polarisDev?.summarizeChatQaAuditEntries));
    if (ready) {
      return { ready: true, attempts: attempt + 1 };
    }
    await page.waitForTimeout(250);
  }
  return { ready: false, attempts: retries };
}

async function waitForServer(url: string, retries = 80) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep waiting while Vite starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`chat UI QA server did not become ready: ${url}`);
}

function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.killed) return;
  child.kill('SIGTERM');
}

function renderSummary(checks: QaCheck[]) {
  const passed = checks.filter((check) => check.passed).length;
  const failed = checks.length - passed;
  return [
    'Polaris chat UI QA runner',
    `checks=${checks.length}`,
    `passed=${passed}`,
    `failed=${failed}`,
    '',
    ...checks.map((check) => `  ${check.passed ? 'PASS' : 'FAIL'} ${check.id}`)
  ].join('\n');
}
