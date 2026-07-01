import {
  getRunCodeSandboxProfile,
  type RunCodeSandboxProfile
} from '../infrastructure/runCodeSandboxMode';

const SAFE_SANDBOX_TIMEOUT_MS = 30_000;
const EXPERIMENTAL_SANDBOX_TIMEOUT_MS = 60_000;
export const RUN_CODE_SANDBOX_SAFE_CSP =
  "default-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'";
export const RUN_CODE_SANDBOX_EXPERIMENTAL_CSP =
  "default-src 'none'; connect-src http: https:; img-src data: blob: http: https:; media-src data: blob: http: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:";
export const RUN_CODE_SANDBOX_CSP = RUN_CODE_SANDBOX_SAFE_CSP;
const RUN_CODE_SANDBOX_SAFE_IFRAME_SANDBOX = 'allow-scripts';
const RUN_CODE_SANDBOX_EXPERIMENTAL_IFRAME_SANDBOX =
  'allow-scripts allow-modals allow-popups allow-downloads';

function buildSandboxHtml(profile: RunCodeSandboxProfile) {
  const csp = profile === 'experimental' ? RUN_CODE_SANDBOX_EXPERIMENTAL_CSP : RUN_CODE_SANDBOX_SAFE_CSP;
  const shouldBlockNetworkApis = profile === 'safe';

  return String.raw`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="${csp}"
    >
  </head>
  <body>
    <script>
      var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      var shouldBlockNetworkApis = ${JSON.stringify(shouldBlockNetworkApis)};

      function formatLogArgs(args) {
        return Array.prototype.map.call(args, function (value) {
          if (typeof value === 'string') return value;
          try {
            return JSON.stringify(value);
          } catch (_error) {
            return String(value);
          }
        });
      }

      function createBlockedApi(name) {
        return function () {
          throw new Error(name + ' is disabled in the runCode sandbox.');
        };
      }

      function blockNetworkApis() {
        var restore = [];

        function replace(target, key, replacement) {
          if (!target || !(key in target)) return;
          var original = target[key];
          restore.push(function () {
            target[key] = original;
          });
          target[key] = replacement;
        }

        replace(window, 'fetch', createBlockedApi('fetch'));
        replace(window, 'XMLHttpRequest', function () {
          throw new Error('XMLHttpRequest is disabled in the runCode sandbox.');
        });
        replace(window, 'WebSocket', function () {
          throw new Error('WebSocket is disabled in the runCode sandbox.');
        });
        replace(window, 'EventSource', function () {
          throw new Error('EventSource is disabled in the runCode sandbox.');
        });

        if (typeof navigator !== 'undefined' && navigator) {
          try {
            replace(navigator, 'sendBeacon', createBlockedApi('navigator.sendBeacon'));
          } catch (_error) {
          }
        }

        return function () {
          for (var index = restore.length - 1; index >= 0; index -= 1) {
            restore[index]();
          }
        };
      }

      window.addEventListener('message', async function handler(event) {
        var port = event.ports[0];
        if (!port) return;
        var code = event.data && event.data.code;
        if (typeof code !== 'string') {
          port.postMessage({ ok: false, error: 'No code provided.' });
          return;
        }

        var logs = [];
        var originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
          info: console.info
        };
        var restoreNetwork = shouldBlockNetworkApis ? blockNetworkApis() : function () {};

        console.log = function () {
          logs.push({ level: 'log', args: formatLogArgs(arguments) });
        };
        console.warn = function () {
          logs.push({ level: 'warn', args: formatLogArgs(arguments) });
        };
        console.error = function () {
          logs.push({ level: 'error', args: formatLogArgs(arguments) });
        };
        console.info = function () {
          logs.push({ level: 'info', args: formatLogArgs(arguments) });
        };

        try {
          var run = new AsyncFunction('"use strict";\n' + code);
          var result = await run();
          port.postMessage({
            ok: true,
            returnValue: result === undefined ? undefined : String(result),
            logs: logs
          });
        } catch (err) {
          port.postMessage({
            ok: false,
            error: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : undefined,
            logs: logs
          });
        } finally {
          restoreNetwork();
          console.log = originalConsole.log;
          console.warn = originalConsole.warn;
          console.error = originalConsole.error;
          console.info = originalConsole.info;
        }
      });
    </script>
  </body>
</html>`;
}

export type CodeSandboxLogEntry = {
  level: 'log' | 'warn' | 'error' | 'info';
  args: string[];
};

export type CodeSandboxResult =
  | {
      ok: true;
      returnValue: string | undefined;
      logs: CodeSandboxLogEntry[];
    }
  | {
      ok: false;
      error: string;
      stack?: string;
      logs: CodeSandboxLogEntry[];
    };

let cachedFrame: HTMLIFrameElement | null = null;
let cachedFrameProfile: RunCodeSandboxProfile | null = null;
let cachedFrameReady = false;
let cachedFrameReadyPromise: Promise<void> | null = null;

function ensureSandboxFrame(profile: RunCodeSandboxProfile): HTMLIFrameElement {
  if (cachedFrame?.parentElement && cachedFrameProfile === profile) {
    return cachedFrame;
  }

  if (cachedFrame?.parentElement) {
    cachedFrame.parentElement.removeChild(cachedFrame);
  }

  const iframe = document.createElement('iframe');
  cachedFrameReady = false;
  cachedFrameReadyPromise = new Promise((resolve) => {
    iframe.addEventListener('load', () => {
      cachedFrameReady = true;
      resolve();
    }, { once: true });
  });
  iframe.setAttribute(
    'sandbox',
    profile === 'experimental' ? RUN_CODE_SANDBOX_EXPERIMENTAL_IFRAME_SANDBOX : RUN_CODE_SANDBOX_SAFE_IFRAME_SANDBOX
  );
  iframe.setAttribute('style', 'display:none;width:0;height:0;border:none;position:absolute;');
  iframe.srcdoc = buildSandboxHtml(profile);
  document.body.appendChild(iframe);
  cachedFrame = iframe;
  cachedFrameProfile = profile;
  return iframe;
}

function waitForFrameReady(iframe: HTMLIFrameElement): Promise<void> {
  if (iframe !== cachedFrame) {
    return new Promise((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true });
    });
  }

  if (cachedFrameReady) {
    return Promise.resolve();
  }

  return cachedFrameReadyPromise ?? Promise.resolve();
}

export async function runCodeInSandbox(code: string): Promise<CodeSandboxResult> {
  if (typeof window === 'undefined') {
    return { ok: false, error: '代码执行仅在浏览器环境中可用。', logs: [] };
  }

  const profile = getRunCodeSandboxProfile();
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, error: '代码不能为空。', logs: [] };
  }

  const iframe = ensureSandboxFrame(profile);
  await waitForFrameReady(iframe);

  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    return { ok: false, error: '沙箱初始化失败。', logs: [] };
  }

  return new Promise<CodeSandboxResult>((resolve) => {
    const channel = new MessageChannel();
    const timeoutMs = profile === 'safe'
      ? SAFE_SANDBOX_TIMEOUT_MS
      : EXPERIMENTAL_SANDBOX_TIMEOUT_MS;
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve({ ok: false, error: `代码执行超时（${timeoutMs / 1000} 秒）。`, logs: [] });
    }, timeoutMs);

    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      channel.port1.close();
      const data = event.data as CodeSandboxResult;
      resolve(data);
    };

    contentWindow.postMessage({ code: trimmed }, '*', [channel.port2]);
  });
}

export async function prewarmRunCodeSandbox(): Promise<void> {
  if (typeof window === 'undefined') return;
  const profile = getRunCodeSandboxProfile();
  const iframe = ensureSandboxFrame(profile);
  await waitForFrameReady(iframe);
}

export function destroySandboxFrame() {
  if (cachedFrame?.parentElement) {
    cachedFrame.parentElement.removeChild(cachedFrame);
  }
  cachedFrame = null;
  cachedFrameProfile = null;
  cachedFrameReady = false;
  cachedFrameReadyPromise = null;
}
