import type { ProjectFile, RoomProject } from '../types/domain';
import { buildRoomProjectPreview } from './roomProjectPreview';

const RUNTIME_INSPECTOR_SOURCE = 'polaris-project-runtime-inspector';
const DEFAULT_RUNTIME_SETTLE_MS = 1_000;
const FALLBACK_TIMEOUT_BUFFER_MS = 1_500;
const INSPECTION_VIEWPORT_WIDTH = 390;
const INSPECTION_VIEWPORT_HEIGHT = 844;

export type RoomProjectRuntimeLogEntry = {
  level: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  kind?: 'console' | 'runtime-error' | 'unhandled-rejection' | 'resource-error';
  filePath?: string;
  filename?: string;
  lineNumber?: number;
  columnNumber?: number;
  stack?: string;
  resourceUrl?: string;
  tagName?: string;
};

export type RoomProjectRuntimeBodySnapshot = {
  readyState?: string;
  title?: string;
  bodyChildCount: number;
  bodyTextLength: number;
  visibleElementCount: number;
  interactiveElementCount: number;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  maxElementWidth: number;
  maxElementHeight: number;
  resourceErrorCount: number;
};

export type RoomProjectRuntimeInspection = {
  runnable: boolean;
  entryFileId: string | null;
  entryFilePath?: string;
  status: 'loaded' | 'not-runnable' | 'unavailable' | 'timeout';
  logs: RoomProjectRuntimeLogEntry[];
  body?: RoomProjectRuntimeBodySnapshot;
  error?: string;
};

type RuntimeInspectorMessage = {
  source?: string;
  runId?: string;
  status?: string;
  logs?: RoomProjectRuntimeLogEntry[];
  body?: RoomProjectRuntimeBodySnapshot;
};

function normalizeRuntimeWaitMs(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_RUNTIME_SETTLE_MS;
  return Math.max(0, Math.floor(value));
}

function escapeInlineScriptJson(value: string) {
  return JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
}

function buildRuntimeInspectorScript(runId: string, settleMs: number) {
  return `<script>
(function () {
  var runId = ${escapeInlineScriptJson(runId)};
  var settleMs = ${settleMs};
  var logs = [];
  var finished = false;
  function compactText(value, maxLength) {
    if (typeof value !== 'string') return value;
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength - 1) + '…';
  }
  function format(value) {
    if (value instanceof Error) return compactText(value.stack || value.message || String(value), 3000);
    if (typeof value === 'string') return value;
    try { return compactText(JSON.stringify(value), 3000); } catch (_error) { return String(value); }
  }
  function decodeProjectSourceUrl(value) {
    if (!value || typeof value !== 'string') return '';
    var marker = 'polaris-project:///';
    var index = value.indexOf(marker);
    if (index < 0) return '';
    var encodedPath = value.slice(index + marker.length).split(/[?#]/)[0];
    try { return decodeURI(encodedPath); } catch (_error) { return encodedPath; }
  }
  function currentProjectScriptProbe() {
    var probe = window.__polarisRuntimeScriptProbe;
    if (!probe || typeof probe !== 'object') return null;
    return probe;
  }
  function numberOrUndefined(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  }
  function push(level, args, meta) {
    var entry = Object.assign({ level: level, args: Array.prototype.map.call(args, format) }, meta || {});
    logs.push(entry);
  }
  var resourceErrors = [];
  ['log', 'warn', 'error', 'info'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      push(level, arguments);
      if (typeof original === 'function') {
        try { original.apply(console, arguments); } catch (_error) {}
      }
    };
  });
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window) {
      var tagName = target.tagName ? String(target.tagName).toLowerCase() : 'resource';
      var url = target.currentSrc || target.src || target.href || '';
      var label = tagName + (url ? ' ' + url : '');
      resourceErrors.push(label);
      push('error', ['Resource failed: ' + label], {
        kind: 'resource-error',
        tagName: tagName,
        resourceUrl: url || undefined
      });
      return;
    }
    var probe = currentProjectScriptProbe();
    var filename = event.filename || '';
    var filePath = decodeProjectSourceUrl(filename) || (probe && probe.filePath ? String(probe.filePath) : '');
    var lineNumber = numberOrUndefined(event.lineno);
    if (filePath && probe && typeof probe.lineOffset === 'number' && (!filename || filename.indexOf('polaris-project:///') < 0)) {
      lineNumber = lineNumber ? Math.max(1, lineNumber - probe.lineOffset) : undefined;
    }
    var columnNumber = numberOrUndefined(event.colno);
    var stack = event.error ? format(event.error) : '';
    var location = filePath
      ? filePath + (lineNumber ? ':' + lineNumber + (columnNumber ? ':' + columnNumber : '') : '')
      : filename
        ? filename + (lineNumber ? ':' + lineNumber + (columnNumber ? ':' + columnNumber : '') : '')
        : '';
    push('error', ['Uncaught ' + (event.message || 'Error') + (location ? ' at ' + location : '')], {
      kind: 'runtime-error',
      filename: filename || undefined,
      filePath: filePath || undefined,
      lineNumber: lineNumber,
      columnNumber: columnNumber,
      stack: stack || undefined
    });
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    push('error', ['Unhandled promise rejection: ' + format(reason)], {
      kind: 'unhandled-rejection',
      stack: reason instanceof Error ? format(reason) : undefined
    });
  });
  function bodySnapshot() {
    var body = document.body;
    var elements = body ? Array.prototype.slice.call(body.querySelectorAll('*')) : [];
    var visibleElementCount = 0;
    var interactiveElementCount = 0;
    var maxElementWidth = 0;
    var maxElementHeight = 0;
    elements.forEach(function (element) {
      var rect = element.getBoundingClientRect();
      var style = window.getComputedStyle(element);
      var visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      if (visible) {
        visibleElementCount += 1;
        maxElementWidth = Math.max(maxElementWidth, Math.round(rect.width));
        maxElementHeight = Math.max(maxElementHeight, Math.round(rect.height));
      }
      if (visible && (/^(a|button|input|select|textarea|summary)$/i.test(element.tagName || '') || element.getAttribute('role') === 'button')) {
        interactiveElementCount += 1;
      }
    });
    return {
      readyState: document.readyState,
      title: document.title || undefined,
      bodyChildCount: body ? body.children.length : 0,
      bodyTextLength: body && body.textContent ? body.textContent.trim().length : 0,
      visibleElementCount: visibleElementCount,
      interactiveElementCount: interactiveElementCount,
      viewportWidth: window.innerWidth || 0,
      viewportHeight: window.innerHeight || 0,
      documentWidth: Math.max(
        document.documentElement ? document.documentElement.scrollWidth : 0,
        body ? body.scrollWidth : 0
      ),
      documentHeight: Math.max(
        document.documentElement ? document.documentElement.scrollHeight : 0,
        body ? body.scrollHeight : 0
      ),
      maxElementWidth: maxElementWidth,
      maxElementHeight: maxElementHeight,
      resourceErrorCount: resourceErrors.length
    };
  }
  function finish(status) {
    if (finished) return;
    finished = true;
    parent.postMessage({
      source: '${RUNTIME_INSPECTOR_SOURCE}',
      runId: runId,
      status: status,
      logs: logs,
      body: bodySnapshot()
    }, '*');
  }
  window.addEventListener('load', function () {
    window.setTimeout(function () { finish('loaded'); }, settleMs);
  });
  window.setTimeout(function () { finish('loaded'); }, Math.max(settleMs + 1, 2000));
})();
</script>`;
}

export function injectProjectRuntimeInspector(srcDoc: string, runId: string, settleMs = DEFAULT_RUNTIME_SETTLE_MS) {
  const script = buildRuntimeInspectorScript(runId, settleMs);
  if (/<head\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(/<head\b([^>]*)>/i, `<head$1>${script}`);
  }
  if (/<html\b[^>]*>/i.test(srcDoc)) {
    return srcDoc.replace(/<html\b([^>]*)>/i, `<html$1><head>${script}</head>`);
  }
  return `${script}${srcDoc}`;
}

function createRunId() {
  return `project-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function inspectRoomProjectRuntime(
  project: RoomProject,
  projectFiles: ProjectFile[],
  options: {
    settleMs?: number;
  } = {}
): Promise<RoomProjectRuntimeInspection> {
  const preview = buildRoomProjectPreview(project, projectFiles);
  if (!preview?.srcDoc || !preview.entryFileId) {
    return {
      runnable: false,
      entryFileId: null,
      status: 'not-runnable',
      logs: []
    };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      runnable: true,
      entryFileId: preview.entryFileId,
      entryFilePath: preview.entryFilePath,
      status: 'unavailable',
      logs: [],
      error: '运行预览检查只能在浏览器环境中执行。'
    };
  }

  const runId = createRunId();
  const entryFileId = preview.entryFileId;
  const entryFilePath = preview.entryFilePath;
  const settleMs = normalizeRuntimeWaitMs(options.settleMs);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('style', [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${INSPECTION_VIEWPORT_WIDTH}px`,
    `height:${INSPECTION_VIEWPORT_HEIGHT}px`,
    'border:none',
    'opacity:0',
    'pointer-events:none'
  ].join(';'));
  iframe.srcdoc = injectProjectRuntimeInspector(preview.srcDoc, runId, settleMs);

  return new Promise<RoomProjectRuntimeInspection>((resolve) => {
    const timeoutMs = Math.max(2_000, settleMs + FALLBACK_TIMEOUT_BUFFER_MS);
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      if (iframe.parentElement) {
        iframe.parentElement.removeChild(iframe);
      }
    };
    const finish = (inspection: RoomProjectRuntimeInspection) => {
      cleanup();
      resolve(inspection);
    };
    const timer = window.setTimeout(() => {
      finish({
        runnable: true,
        entryFileId,
        entryFilePath,
        status: 'timeout',
        logs: [],
        error: `运行预览检查超时（${timeoutMs}ms）。`
      });
    }, timeoutMs);

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as RuntimeInspectorMessage | null;
      if (!data || data.source !== RUNTIME_INSPECTOR_SOURCE || data.runId !== runId) return;
      window.clearTimeout(timer);
      finish({
        runnable: true,
        entryFileId,
        entryFilePath,
        status: 'loaded',
        logs: data.logs ?? [],
        body: data.body
      });
    }

    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);
  });
}
