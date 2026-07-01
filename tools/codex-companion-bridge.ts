import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  publishCompanionSnapshot,
  pullCompanionHostCommands,
  registerCompanionHost,
  unregisterCompanionHost
} from '../src/engines/companionApi';
import {
  countCodexUserMessages,
  createCodexCompanionSnapshot,
  isCodexThreadReadDeferredError,
  isCodexThreadBusy,
  isCodexThreadStatusBusy,
  isCodexThreadLoaded,
  pickCodexCompanionThread,
  reconcileCodexPendingCommands,
  type CodexCompanionPendingCommand,
  type CodexThread
} from '../src/engines/codexCompanion';

type JsonRpcResponse = {
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

const DEFAULT_RELAY_URL = 'http://127.0.0.1:8787';
const DEFAULT_CODEX_URL = 'ws://127.0.0.1:46321';
const IDLE_SYNC_INTERVAL_MS = 500;
const ACTIVE_SYNC_INTERVAL_MS = 250;
const FALLBACK_CODEX_BIN_CANDIDATES = [
  '/Applications/Codex.app/Contents/Resources/codex',
  '/opt/homebrew/bin/codex',
  '/usr/local/bin/codex'
];

class CodexRpcClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<string | number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly notificationListeners = new Set<(method: string, params: unknown) => void>();

  async connect(url: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(url);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        socket.removeEventListener('open', onOpen);
        reject(new Error(`连不上 Codex app-server：${url}`));
      };
      socket.addEventListener('open', onOpen, { once: true });
      socket.addEventListener('error', onError, { once: true });
    });
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const message = JSON.parse(event.data) as JsonRpcResponse & { method?: string; params?: unknown };
      if (message.id !== undefined && message.id !== null) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
          return;
        }
        pending.resolve(message.result);
        return;
      }
      if (typeof message.method === 'string') {
        for (const listener of this.notificationListeners) {
          listener(message.method, message.params);
        }
      }
    });
  }

  async initialize() {
    await this.request('initialize', {
      clientInfo: {
        name: 'polaris-codex-companion-bridge',
        version: '0.1.0'
      },
      capabilities: {
        experimentalApi: true
      }
    });
    this.notify('initialized');
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Codex app-server 连接还没打开。');
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const result = await new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket?.send(payload);
    });
    return result as T;
  }

  notify(method: string, params?: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(params === undefined ? { method } : { method, params }));
  }

  onNotification(listener: (method: string, params: unknown) => void) {
    this.notificationListeners.add(listener);
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRelayUrl(raw: string | undefined) {
  return raw?.trim() || process.env.POLARIS_COMPANION_RELAY_URL?.trim() || DEFAULT_RELAY_URL;
}

function resolveCodexExecutable() {
  const explicit = process.env.POLARIS_CODEX_BIN?.trim();
  if (explicit) {
    if (existsSync(explicit)) return explicit;
    throw new Error(`POLARIS_CODEX_BIN 指向的 Codex 不存在：${explicit}`);
  }

  const pathEntries = (process.env.PATH ?? '')
    .split(':')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = join(entry, 'codex');
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  for (const candidate of FALLBACK_CODEX_BIN_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    '找不到 Codex 可执行文件。先确认 Codex.app 已安装；如果它不在默认位置，就手动设置环境变量 POLARIS_CODEX_BIN=/你的/codex 路径。'
  );
}

function normalizeCliArgv(argv: string[]) {
  return argv.map((entry) => {
    switch (entry) {
      case '--relay-url':
        return '--relayUrl';
      case '--codex-url':
        return '--codexUrl';
      case '--thread-id':
        return '--threadId';
      case '--spawn':
      case '--spawn-app-server':
        return '--spawnAppServer';
      case '--no-spawn':
        return '--noSpawn';
      default:
        return entry;
    }
  });
}

function printHelp() {
  console.log(`Polaris Codex bridge

用法：
  polaris-codex-bridge [--relay-url <url>] [--codex-url <ws-url>] [--thread-id <id>] [--label <name>] [--cwd <path>] [--spawn-app-server]

默认：
  relay-url  ${DEFAULT_RELAY_URL}
  codex-url  ${DEFAULT_CODEX_URL}

说明：
  这条命令会连接已经打开的 Codex 桌面 app-server，把电脑上已加载的 Codex thread 挂到 Polaris companion relay 里，并打印 6 位配对码。
  手机端再去 Polaris 里的“连接电脑端”输入同一个 relay 地址和配对码就行。`);
}

async function ensureCodexServer(url: string, spawnServer: boolean) {
  let child: ChildProcess | null = null;
  if (spawnServer) {
    const codexExecutable = resolveCodexExecutable();
    child = await new Promise<ChildProcess>((resolve, reject) => {
      const spawned = spawn(codexExecutable, ['app-server', '--listen', url], {
        stdio: 'inherit'
      });
      spawned.once('spawn', () => {
        spawned.removeListener('error', reject);
        resolve(spawned);
      });
      spawned.once('error', (error) => {
        reject(
          new Error(
            error instanceof Error
              ? `Codex app-server 启动失败：${error.message}`
              : 'Codex app-server 启动失败。'
          )
        );
      });
    });
  }

  const client = new CodexRpcClient();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await client.connect(url);
      await client.initialize();
      return { client, child };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Codex app-server 未知错误。');
      await sleep(500);
    }
  }

  child?.kill();
  throw lastError ?? new Error('Codex app-server 启动失败。');
}

async function readLoadedThreads(client: CodexRpcClient, cwd: string | null) {
  const listed = await client.request<{ data: string[] }>('thread/loaded/list', {
    limit: 20
  });
  const threads: CodexThread[] = [];
  for (const threadId of listed.data ?? []) {
    try {
      const response = await client.request<{ thread: CodexThread }>('thread/read', {
        threadId,
        includeTurns: false
      });
      if (!cwd || response.thread.cwd === cwd) {
        threads.push(response.thread);
      }
    } catch (error) {
      if (!isCodexThreadReadDeferredError(error)) {
        throw error;
      }
    }
  }
  return threads;
}

async function chooseThread(client: CodexRpcClient, preferredThreadId: string | null, cwd: string | null, allowCreateThread: boolean) {
  if (!preferredThreadId) {
    const loaded = await readLoadedThreads(client, cwd);
    const current = pickCodexCompanionThread(loaded, null);
    if (current) {
      return current.id;
    }
    throw new Error(
      cwd
        ? `没有找到已打开的 Codex thread（cwd=${cwd}）。先在 Codex 桌面打开目标线程，再启动 bridge；如果你确实想开隐藏 app-server，请加 --spawn-app-server。`
        : '没有找到已打开的 Codex thread。先在 Codex 桌面打开目标线程，再启动 bridge；如果你确实想开隐藏 app-server，请加 --spawn-app-server。'
    );
  }

  const listed = await client.request<{ data: CodexThread[] }>('thread/list', {
    limit: 20,
    sortKey: 'updated_at',
    archived: false,
    cwd: cwd || null
  });
  const existing = pickCodexCompanionThread(listed.data ?? [], preferredThreadId);
  if (existing) {
    if (isCodexThreadLoaded(existing)) {
      return existing.id;
    }
    if (!allowCreateThread) {
      throw new Error(`Codex thread ${existing.id} 还没有在桌面端加载。先在 Codex 桌面打开它，再启动 bridge。`);
    }
    try {
      const resumed = await client.request<{ thread: CodexThread }>('thread/resume', {
        threadId: existing.id
      });
      return resumed.thread.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (!message.includes('thread not found')) {
        throw error;
      }
    }
  }

  if (!allowCreateThread) {
    throw new Error(`没有找到 Codex thread：${preferredThreadId}`);
  }

  const created = await client.request<{ thread: CodexThread }>('thread/start', {
    cwd,
    experimentalRawEvents: false,
    persistExtendedHistory: true
  });
  return created.thread.id;
}

async function readThread(client: CodexRpcClient, threadId: string) {
  const response = await client.request<{ thread: CodexThread }>('thread/read', {
    threadId,
    includeTurns: true
  });
  return response.thread;
}

async function main() {
  const argv = normalizeCliArgv(process.argv.slice(2));

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      relayUrl: { type: 'string' },
      codexUrl: { type: 'string' },
      threadId: { type: 'string' },
      label: { type: 'string' },
      cwd: { type: 'string' },
      spawnAppServer: { type: 'boolean', default: false },
      noSpawn: { type: 'boolean', default: false }
    }
  });

  const relayUrl = normalizeRelayUrl(values.relayUrl);
  const codexUrl = values.codexUrl?.trim() || DEFAULT_CODEX_URL;
  const label = values.label?.trim() || `Codex · ${hostname()}`;
  const cwd = values.cwd?.trim() || null;
  const spawnAppServer = Boolean(values.spawnAppServer) && !values.noSpawn;

  const { client, child } = await ensureCodexServer(codexUrl, spawnAppServer);
  const pinnedThreadId = values.threadId?.trim() || null;
  let threadId = await chooseThread(client, pinnedThreadId, cwd, spawnAppServer);

  let hostId: string | null = null;
  let hostSecret: string | null = null;
  let lastPairCode: string | null = null;
  let shuttingDown = false;
  const queuedCommands: CodexCompanionPendingCommand[] = [];
  let threadBusy = false;
  let lastReadableThread: CodexThread | null = null;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (hostId && hostSecret) {
      try {
        await unregisterCompanionHost({
          relayUrl,
          hostId,
          hostSecret
        });
      } catch {}
    }
    client.close();
    child?.kill();
  };

  process.on('SIGINT', () => { void shutdown().finally(() => process.exit(0)); });
  process.on('SIGTERM', () => { void shutdown().finally(() => process.exit(0)); });

  const removeNotificationListener = client.onNotification((method, params) => {
    if (!params || typeof params !== 'object') return;
    const payload = params as {
      threadId?: string;
      status?: CodexThread['status'] | null;
      turn?: { status?: string | null };
      willRetry?: boolean;
    };
    if (payload.threadId && payload.threadId !== threadId) return;
    if (method === 'turn/started') {
      threadBusy = true;
      return;
    }
    if (method === 'turn/completed') {
      threadBusy = false;
      return;
    }
    if (method === 'thread/status/changed') {
      threadBusy = isCodexThreadStatusBusy(payload.status ?? '');
      return;
    }
    if (method === 'error' && payload.willRetry === false) {
      threadBusy = false;
    }
  });

  console.log(
    pinnedThreadId
      ? `Polaris Codex bridge 正在接管固定 thread ${threadId}。`
      : `Polaris Codex bridge 正在跟随最新 Codex thread，当前是 ${threadId}。`
  );

  try {
    while (true) {
      if (!pinnedThreadId) {
        const nextThreadId = await chooseThread(client, null, cwd, spawnAppServer);
        if (nextThreadId !== threadId) {
          threadId = nextThreadId;
          threadBusy = false;
          lastReadableThread = null;
          console.log(`Codex 当前活动 thread 已切到 ${threadId}。`);
        }
      }

      const registration = await registerCompanionHost({
        relayUrl,
        source: 'codex',
        label,
        hostId,
        hostSecret
      });
      hostId = registration.hostId;
      hostSecret = registration.hostSecret;

      try {
        const thread = await readThread(client, threadId);
        lastReadableThread = thread;
        threadBusy = isCodexThreadBusy(thread);
        const unresolvedCommands = reconcileCodexPendingCommands(thread, queuedCommands);
        queuedCommands.splice(0, queuedCommands.length, ...unresolvedCommands);
      } catch (error) {
        if (!isCodexThreadReadDeferredError(error)) {
          console.error(error instanceof Error ? error.message : 'Codex thread 读取失败。');
        }
      }

      if (lastReadableThread) {
        await publishCompanionSnapshot({
          relayUrl,
          hostId,
          hostSecret,
          snapshot: createCodexCompanionSnapshot({
            hostId,
            hostLabel: registration.label,
            thread: lastReadableThread,
            pendingCommands: queuedCommands
          })
        });
      }

      if (registration.pairCode && registration.pairCode !== lastPairCode) {
        lastPairCode = registration.pairCode;
        console.log(`配对码：${registration.pairCode}  来源：Codex  Relay：${relayUrl}`);
      }

      const pending = await pullCompanionHostCommands({
        relayUrl,
        hostId,
        hostSecret
      });
      queuedCommands.push(
        ...pending.commands.map((command) => ({
          ...command,
          userMessageCountBase: null
        }))
      );

      if (lastReadableThread && pending.commands.length > 0) {
        await publishCompanionSnapshot({
          relayUrl,
          hostId,
          hostSecret,
          snapshot: createCodexCompanionSnapshot({
            hostId,
            hostLabel: registration.label,
            thread: lastReadableThread,
            pendingCommands: queuedCommands
          })
        });
      }

      if (!threadBusy) {
        const command = queuedCommands.find((entry) => entry.userMessageCountBase === null);
        if (command) {
          try {
            command.userMessageCountBase = lastReadableThread ? countCodexUserMessages(lastReadableThread) : 0;
            await client.request('turn/start', {
              threadId,
              input: [
                {
                  type: 'text',
                  text: command.text,
                  text_elements: []
                }
              ]
            });
            threadBusy = true;
          } catch (error) {
            command.userMessageCountBase = null;
            console.error(error instanceof Error ? error.message : 'Codex companion 发话失败。');
          }
        }
      }
      await sleep(threadBusy || queuedCommands.length > 0 ? ACTIVE_SYNC_INTERVAL_MS : IDLE_SYNC_INTERVAL_MS);
    }
  } finally {
    removeNotificationListener();
    await shutdown();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Codex companion bridge 失败。');
  process.exit(1);
});
