import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

type DoctorStatus = 'pass' | 'fail';

type DoctorCheck = {
  id: string;
  status: DoctorStatus;
  detail?: unknown;
};

type SourceForbiddenPattern = {
  id: string;
  label: string;
  pattern: RegExp;
};

type RuntimeViewport = {
  id: string;
  width: number;
  height: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  runWriteFlows?: boolean;
};

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 4197);
const baseUrl = `http://${host}:${port}`;
const outDir = process.env.OUT_DIR ?? 'tmp/release-doctor';
const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = `${outDir}/${runTimestamp}`;
const headed = process.env.HEADED === '1';

const sourceForbiddenPatterns: SourceForbiddenPattern[] = [
  {
    id: 'source-no-stale-skipped-copy',
    label: '已跳过',
    pattern: /已跳过/g
  },
  {
    id: 'source-no-stale-tool-directory-copy',
    label: '当前工具目录没有',
    pattern: /当前工具目录没有/g
  },
  {
    id: 'source-no-stale-memory-policy-field',
    label: 'memoryPolicy',
    pattern: /memoryPolicy\s*:/g
  },
  {
    id: 'source-no-stale-auto-write-field',
    label: 'auto-write / autoWrite',
    pattern: /auto-write|autoWrite/g
  }
];

const publicRuntimeForbiddenText = [
  '/debug last',
  '/qa long',
  '/qa env',
  '打开上一轮请求调试记录',
  '跑一条多阶段长任务 QA',
  '跑工作区环境契约 QA',
  '当前工具目录没有',
  '已跳过',
  'memoryPolicy',
  'auto-write',
  'autoWrite'
];

const viewports: RuntimeViewport[] = [
  { id: 'desktop', width: 1280, height: 860, runWriteFlows: true },
  { id: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }
];

const server = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

let serverLogs = '';
let browser: Browser | null = null;

server.stdout.on('data', (chunk) => {
  serverLogs += String(chunk);
});
server.stderr.on('data', (chunk) => {
  serverLogs += String(chunk);
});

try {
  await mkdir(runDir, { recursive: true });
  const checks: DoctorCheck[] = [];

  checks.push(...await runSourceScan());
  await waitForServer(baseUrl);

  browser = await chromium.launch({ headless: !headed });
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.isMobile ? 2 : 1,
      isMobile: viewport.isMobile ?? false,
      hasTouch: viewport.hasTouch ?? false
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    try {
      checks.push(...await runPublicRuntimeChecks(page, viewport));
      checks.push({
        id: `${viewport.id}-public-runtime-has-no-page-errors`,
        status: pageErrors.length === 0 ? 'pass' : 'fail',
        detail: pageErrors
      });
    } finally {
      await context.close();
    }
  }

  const report = {
    reportKind: 'polaris-release-doctor',
    generatedAt: new Date().toISOString(),
    baseUrl,
    checks,
    serverLogs: serverLogs.slice(-4000)
  };
  const reportPath = `${runDir}/release-doctor-${runTimestamp}.json`;
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(renderSummary(checks));
  console.log(`Artifacts -> ${runDir}`);
  console.log(`JSON -> ${reportPath}`);

  if (checks.some((check) => check.status === 'fail')) {
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  stopServer(server);
}

async function runSourceScan(): Promise<DoctorCheck[]> {
  const files = await listSourceFiles(join(process.cwd(), 'src'));
  const matches = new Map<string, Array<{ file: string; line: number; text: string }>>();
  sourceForbiddenPatterns.forEach((rule) => matches.set(rule.id, []));

  await Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      sourceForbiddenPatterns.forEach((rule) => {
        rule.pattern.lastIndex = 0;
        if (!rule.pattern.test(line)) return;
        matches.get(rule.id)?.push({
          file: relative(process.cwd(), file),
          line: index + 1,
          text: line.trim().slice(0, 180)
        });
      });
    });
  }));

  return sourceForbiddenPatterns.map((rule) => {
    const hits = matches.get(rule.id) ?? [];
    return {
      id: rule.id,
      status: hits.length === 0 ? 'pass' : 'fail',
      detail: hits.length === 0 ? { label: rule.label } : { label: rule.label, hits }
    };
  });
}

async function listSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

async function runPublicRuntimeChecks(page: Page, viewport: RuntimeViewport): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const screenshotPath = `${runDir}/release-doctor-${viewport.id}-${runTimestamp}.png`;

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  const worldState = await ensureChatWorld(page);
  await page.waitForSelector('.chat-composer textarea', { timeout: 20_000 });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const shellState = await page.evaluate((forbiddenText) => {
    const bodyText = document.body.innerText;
    const shell = document.querySelector('.app-shell');
    const composer = document.querySelector<HTMLTextAreaElement>('.chat-composer textarea');
    const sendButton = document.querySelector<HTMLButtonElement>('.send-btn');
    return {
      hasShell: Boolean(shell),
      shellClass: shell?.className ?? '',
      hasComposer: Boolean(composer),
      composerDisabled: composer?.disabled ?? null,
      sendButtonLabel: sendButton?.getAttribute('aria-label') ?? '',
      requestDebugOverlayCount: document.querySelectorAll('.request-debug-overlay').length,
      assetDebugOverlayCount: document.querySelectorAll('.asset-governance-overlay').length,
      runtimePerformanceOverlayCount: document.querySelectorAll('.runtime-performance-overlay').length,
      developerMode: document.documentElement.dataset.developerMode ?? '',
      forbiddenVisibleText: forbiddenText.filter((text) => bodyText.includes(text))
    };
  }, publicRuntimeForbiddenText);

  checks.push({
    id: `${viewport.id}-public-shell-mounted`,
    status: shellState.hasShell && String(shellState.shellClass).includes('chat') ? 'pass' : 'fail',
    detail: { ...shellState, worldState, screenshotPath }
  });
  checks.push({
    id: `${viewport.id}-public-composer-ready`,
    status:
      shellState.hasComposer
      && shellState.composerDisabled === false
      && shellState.sendButtonLabel === '发送消息'
        ? 'pass'
        : 'fail',
    detail: shellState
  });
  checks.push({
    id: `${viewport.id}-public-debug-surfaces-hidden`,
    status:
      shellState.requestDebugOverlayCount === 0
      && shellState.assetDebugOverlayCount === 0
      && shellState.runtimePerformanceOverlayCount === 0
      && shellState.developerMode !== 'true'
        ? 'pass'
        : 'fail',
    detail: shellState
  });
  checks.push({
    id: `${viewport.id}-public-copy-has-no-debug-residue`,
    status: shellState.forbiddenVisibleText.length === 0 ? 'pass' : 'fail',
    detail: shellState.forbiddenVisibleText
  });

  const slashState = await readSlashCommandState(page);
  checks.push({
    id: `${viewport.id}-public-slash-hides-developer-commands`,
    status:
      slashState.hasMenu
      && slashState.visibleCommands.includes('/retry')
      && !slashState.visibleCommands.some((command) => command.startsWith('/qa') || command.startsWith('/debug'))
      && slashState.forbiddenVisibleText.length === 0
        ? 'pass'
        : 'fail',
    detail: slashState
  });

  const slashGuardrailState = await verifySlashCommandGuardrails(page, viewport);
  checks.push({
    id: `${viewport.id}-slash-commands-do-not-create-ghost-state`,
    status: slashGuardrailState.clean ? 'pass' : 'fail',
    detail: slashGuardrailState
  });

  const toolboxState = await openToolboxFromComposer(page);
  checks.push({
    id: `${viewport.id}-toolbox-opens-from-composer`,
    status: toolboxState.opened ? 'pass' : 'fail',
    detail: toolboxState
  });

  const collectionState = await inspectCollectionWorld(page, viewport);
  checks.push({
    id: `${viewport.id}-collection-world-opens`,
    status: collectionState.opened ? 'pass' : 'fail',
    detail: collectionState
  });

  if (viewport.runWriteFlows) {
    const cardState = await createManualCard(page);
    checks.push({
      id: `${viewport.id}-collection-card-create-flow`,
      status: cardState.created ? 'pass' : 'fail',
      detail: cardState
    });

    const projectState = await createWorkspaceAndFile(page);
    checks.push({
      id: `${viewport.id}-workspace-create-file-flow`,
      status: projectState.created ? 'pass' : 'fail',
      detail: projectState
    });
  }

  return checks;
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

async function ensureCollectionWorld(page: Page) {
  const before = await readActiveWorld(page);
  if (before === 'collection') {
    return { switched: false, before, after: before };
  }

  const switchToCollection = page.getByLabel('切换到房间');
  if (await switchToCollection.count()) {
    await switchToCollection.first().click();
    await switchToCollection.first().click();
  } else {
    const veil = page.locator('.world-switch-veil[aria-label="切换到房间"]');
    await veil.click();
    await veil.click();
  }
  await page.waitForFunction(
    () => document.querySelector('.app-shell')?.classList.contains('collection') === true,
    undefined,
    { timeout: 20_000 }
  );
  await page.waitForSelector('.collection-shelf-tabs', { timeout: 20_000 });

  return {
    switched: true,
    before,
    after: await readActiveWorld(page)
  };
}

async function readSlashCommandState(page: Page) {
  const composer = page.locator('.chat-composer textarea').first();
  await composer.fill('/');
  await page.waitForSelector('.slash-command-menu', { timeout: 10_000 });

  return await page.evaluate((forbiddenText) => {
    const menu = document.querySelector('.slash-command-menu');
    const visibleCommands = Array.from(document.querySelectorAll('.slash-command-name'))
      .map((node) => node.textContent?.trim() ?? '')
      .filter((text) => text.startsWith('/'));
    const bodyText = menu?.textContent ?? '';
    return {
      hasMenu: Boolean(menu),
      visibleCommands,
      forbiddenVisibleText: forbiddenText.filter((text) => bodyText.includes(text))
    };
  }, publicRuntimeForbiddenText);
}

async function verifySlashCommandGuardrails(page: Page, viewport: RuntimeViewport) {
  const composer = page.locator('.chat-composer textarea').first();
  const screenshotPath = `${runDir}/release-doctor-${viewport.id}-slash-guardrails-${runTimestamp}.png`;
  const before = await readConversationGhostState(page);

  try {
    await composer.fill('/export');
    await page.waitForFunction(() => document.querySelector('.send-btn')?.getAttribute('aria-label') === '执行指令');
    await page.getByLabel('执行指令').click();
    await page.waitForFunction(() => {
      const status = document.querySelector('.command-status')?.textContent ?? '';
      return status.includes('当前没有可以导出的对话') || status.includes('当前对话还是空的');
    }, undefined, { timeout: 5_000 });
    const afterExport = await readConversationGhostState(page);

    await composer.fill('/workspace release-doctor-missing-workspace');
    await page.waitForFunction(() => document.querySelector('.send-btn')?.getAttribute('aria-label') === '执行指令');
    await page.getByLabel('执行指令').click();
    await page.waitForFunction(() =>
      document.querySelector('.command-status')?.textContent?.includes('没有找到工作区') === true,
      undefined,
      { timeout: 5_000 }
    );
    const afterMissingWorkspace = await readConversationGhostState(page);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const messageCountStable =
      afterExport.messageRowCount === before.messageRowCount
      && afterMissingWorkspace.messageRowCount === before.messageRowCount;
    const noTask =
      afterExport.activeTaskCount === 0
      && afterMissingWorkspace.activeTaskCount === 0
      && afterExport.armedTaskCount === 0
      && afterMissingWorkspace.armedTaskCount === 0;
    const noWorkspace =
      afterExport.workspaceBannerCount === 0
      && afterMissingWorkspace.workspaceBannerCount === 0;
    const expectedStatus =
      (afterExport.commandStatus.includes('当前没有可以导出的对话') || afterExport.commandStatus.includes('当前对话还是空的'))
      && afterMissingWorkspace.commandStatus.includes('没有找到工作区');

    await composer.fill('');

    return {
      clean: messageCountStable && noTask && noWorkspace && expectedStatus,
      screenshotPath,
      before,
      afterExport,
      afterMissingWorkspace
    };
  } catch (error) {
    const afterError = await readConversationGhostState(page).catch((stateError) => ({
      messageRowCount: -1,
      userMessageCount: -1,
      assistantMessageCount: -1,
      activeTaskCount: -1,
      armedTaskCount: -1,
      workspaceBannerCount: -1,
      workspaceBannerText: [],
      commandStatus: `state read failed: ${String(stateError)}`
    }));
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    await composer.fill('').catch(() => undefined);
    return {
      clean: false,
      screenshotPath,
      error: String(error),
      before,
      afterError
    };
  }
}

async function readConversationGhostState(page: Page) {
  return await page.evaluate(() => {
    const commandStatus = document.querySelector('.command-status')?.textContent?.trim() ?? '';
    const workspaceBannerText = Array.from(document.querySelectorAll('.chat-workspace-banner'))
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean);
    return {
      messageRowCount: document.querySelectorAll('.msg-row').length,
      userMessageCount: document.querySelectorAll('.msg-row.user').length,
      assistantMessageCount: document.querySelectorAll('.msg-row.assistant').length,
      activeTaskCount: document.querySelectorAll('.task-runtime-dock-panel.active, .task-runtime-card:not(.task-runtime-card-armed)').length,
      armedTaskCount: document.querySelectorAll('.task-runtime-card-armed').length,
      workspaceBannerCount: document.querySelectorAll('.chat-workspace-banner.active, .chat-workspace-banner.proposal').length,
      workspaceBannerText,
      commandStatus
    };
  });
}

async function openToolboxFromComposer(page: Page) {
  await page.locator('.chat-composer textarea').first().fill('');
  await page.getByLabel('添加附件，或发送指定卡片').click();
  const toolCard = page.locator('.attachment-picker-sheet').getByText('工具', { exact: true }).first();
  await toolCard.click();
  await page.waitForSelector('.menu-sheet', { timeout: 10_000 });
  const rootMenuText = await page.locator('.menu-sheet').innerText();
  if (!rootMenuText.includes('工具箱')) {
    return { opened: false, stage: 'root-menu', rootMenuText: rootMenuText.slice(0, 500) };
  }
  await page.locator('.menu-sheet').getByText('工具箱', { exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('.menu-sheet')?.textContent?.includes('常驻工具') === true);
  const toolboxText = await page.locator('.menu-sheet').innerText();
  return {
    opened: toolboxText.includes('工具箱') && toolboxText.includes('常驻工具'),
    stage: 'toolbox',
    toolboxText: toolboxText.slice(0, 800)
  };
}

async function inspectCollectionWorld(page: Page, viewport: RuntimeViewport) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 20_000 });
  const worldState = await ensureCollectionWorld(page);
  const screenshotPath = `${runDir}/release-doctor-${viewport.id}-collection-${runTimestamp}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const state = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    const tabs = Array.from(document.querySelectorAll('.collection-shelf-tabs [role="tab"]'))
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean);
    const text = document.body.innerText;
    return {
      shellClass: shell?.className ?? '',
      tabs,
      hasCardShelf: text.includes('卡片'),
      hasWorkspaceShelf: text.includes('工作区')
    };
  });
  return {
    opened:
      state.shellClass.includes('collection')
      && state.tabs.includes('卡片')
      && state.tabs.includes('工作区'),
    worldState,
    screenshotPath,
    ...state
  };
}

async function createManualCard(page: Page) {
  await ensureCollectionWorld(page);
  await page.getByRole('tab', { name: '卡片' }).click();
  await page.getByLabel('新建或导入卡片').click();
  await page.getByRole('menuitem', { name: /新建/ }).click();
  await page.waitForSelector('.create-code-fullscreen', { timeout: 10_000 });
  const cardSource = [
    '<section class="doctor-card">',
    '  <h1>Doctor Card</h1>',
    '  <p>Release doctor smoke card.</p>',
    '</section>'
  ].join('\n');
  await page.locator('.create-code-workshop-editor').fill(cardSource);
  await page.getByRole('button', { name: '创建' }).click();
  await page.waitForFunction(() => document.querySelector('.create-code-fullscreen') === null);
  await page.waitForFunction(() => document.body.innerText.includes('Doctor Card'));
  const state = await page.evaluate(() => ({
    createdCardVisible: document.body.innerText.includes('Doctor Card'),
    editorClosed: document.querySelector('.create-code-fullscreen') === null,
    cardCount: document.querySelectorAll('.code-card').length
  }));
  return {
    created: state.createdCardVisible && state.editorClosed,
    ...state
  };
}

async function createWorkspaceAndFile(page: Page) {
  await ensureCollectionWorld(page);
  await page.getByRole('tab', { name: '工作区' }).click();
  await page.getByLabel('新建工作区').click();
  await page.waitForSelector('.room-project-fullscreen', { timeout: 10_000 });
  const projectBeforeFile = await page.locator('.room-project-fullscreen').innerText();
  const inlineCreateFile = page.locator('.room-project-fullscreen-inline-action', { hasText: '新建文件' }).first();
  if (await inlineCreateFile.isVisible()) {
    await inlineCreateFile.click();
  } else {
    await page.getByLabel('新建或导入项目文件').click();
    await page.waitForSelector('.room-project-file-quick-menu', { timeout: 10_000 });
    await page.getByRole('menuitem', { name: /新建文件/ }).click();
  }
  try {
    await page.waitForSelector('.room-project-file-fullscreen', { timeout: 10_000 });
  } catch {
    const afterCreateAttempt = await page.locator('.room-project-fullscreen').innerText().catch(() => '');
    const visibleButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button'))
      .map((button) => ({
        text: button.textContent?.trim() ?? '',
        label: button.getAttribute('aria-label') ?? '',
        disabled: button.disabled,
        visible: Boolean(button.offsetWidth || button.offsetHeight || button.getClientRects().length)
      }))
      .filter((button) => button.visible)
      .slice(0, 80));
    return {
      created: false,
      stage: 'file-editor-not-open',
      projectBeforeFile: projectBeforeFile.slice(0, 500),
      afterCreateAttempt: afterCreateAttempt.slice(0, 900),
      visibleButtons
    };
  }
  const fileTitle = await page.locator('.room-project-file-fullscreen').getByText('index.html').first().textContent();
  await page.locator('.room-project-file-fullscreen .create-code-workshop-editor').fill('<!doctype html>\n<title>Doctor Workspace</title>\n<h1>Doctor Workspace</h1>');
  await page.getByLabel('返回工作区').click();
  await page.waitForFunction(() => document.querySelector('.room-project-file-fullscreen') === null);
  const projectAfterFile = await page.locator('.room-project-fullscreen').innerText();
  return {
    created: projectAfterFile.includes('index.html') && Boolean(fileTitle?.includes('index.html')),
    projectBeforeFile: projectBeforeFile.slice(0, 500),
    projectAfterFile: projectAfterFile.slice(0, 700),
    fileTitle
  };
}

async function waitForServer(url: string, retries = 80) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`release doctor server did not become ready: ${url}`);
}

function stopServer(child: ChildProcessWithoutNullStreams) {
  if (child.killed) return;
  child.kill('SIGTERM');
}

function renderSummary(checks: DoctorCheck[]) {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.length - passed;
  return [
    'Polaris release doctor',
    `checks=${checks.length}`,
    `passed=${passed}`,
    `failed=${failed}`,
    '',
    ...checks.map((check) => `  ${check.status === 'pass' ? 'PASS' : 'FAIL'} ${check.id}`)
  ].join('\n');
}
