import { describe, expect, it } from 'vitest';
import {
  buildPreviewDiagnosticEvidence,
  buildProjectPreviewRunnable,
  buildProjectPreviewSummary,
  buildProjectRuntimeRunnable,
  buildProjectRuntimeSummary,
  buildRuntimeDiagnosticEvidence,
  formatProjectPreviewCheck,
  formatProjectRuntimeInspection,
  isRuntimeBodyEmpty
} from './toolExecutorCollectionDiagnostics';
import type { RoomProjectPreviewCheck } from './roomProjectPreview';
import type { RoomProjectRuntimeInspection } from './roomProjectRuntimeInspection';

function makePreviewCheck(patch: Partial<RoomProjectPreviewCheck> = {}): RoomProjectPreviewCheck {
  return {
    runnable: true,
    entryFileId: 'file-1',
    entryFilePath: 'index.html',
    fileCount: 2,
    inlinedLocalAssets: ['style.css'],
    missingLocalAssets: [],
    externalAssets: [],
    diagnostics: [],
    ...patch
  };
}

function makeRuntimeInspection(patch: Partial<RoomProjectRuntimeInspection> = {}): RoomProjectRuntimeInspection {
  return {
    runnable: true,
    entryFileId: 'file-1',
    entryFilePath: 'index.html',
    status: 'loaded',
    logs: [],
    body: {
      readyState: 'complete',
      bodyChildCount: 1,
      bodyTextLength: 12,
      visibleElementCount: 2,
      interactiveElementCount: 1,
      viewportWidth: 390,
      viewportHeight: 844,
      documentWidth: 390,
      documentHeight: 844,
      maxElementWidth: 200,
      maxElementHeight: 80,
      resourceErrorCount: 0
    },
    ...patch
  };
}

describe('project preview diagnostics', () => {
  it('summarizes runnable preview checks and projects evidence', () => {
    const check = makePreviewCheck();

    expect(buildProjectPreviewSummary('手机', check)).toBe('预览检查通过 · index.html');
    expect(buildProjectPreviewRunnable(check)).toBe(true);
    expect(buildPreviewDiagnosticEvidence('project-1', check)).toMatchObject({
      tool: 'checkProjectPreview',
      projectId: 'project-1',
      reason: 'ok',
      errorsCount: 0,
      warningsCount: 0,
      inlinedLocalAssets: ['style.css']
    });
    expect(formatProjectPreviewCheck('project-1', check)).toContain('状态：可预览');
  });

  it('summarizes syntax errors and marks preview as not runnable', () => {
    const check = makePreviewCheck({
      diagnostics: [{
        severity: 'error',
        filePath: 'app.js',
        lineNumber: 3,
        columnNumber: 5,
        message: 'Unexpected token',
        excerpt: '> 3: const ='
      }]
    });

    expect(buildProjectPreviewSummary('手机', check)).toBe('预览检查完成 · 脚本语法错误 1 条 · app.js:3');
    expect(buildProjectPreviewRunnable(check)).toBe(false);
    expect(buildPreviewDiagnosticEvidence('project-1', check)).toMatchObject({
      reason: 'syntax-error',
      firstErrorMessage: 'Unexpected token',
      firstErrorFilePath: 'app.js',
      firstErrorLineNumber: 3,
      firstErrorColumnNumber: 5
    });
    expect(formatProjectPreviewCheck('project-1', check)).toContain('错误 · app.js:3:5 · Unexpected token');
  });
});

describe('project runtime diagnostics', () => {
  it('summarizes a healthy runtime inspection', () => {
    const inspection = makeRuntimeInspection();

    expect(isRuntimeBodyEmpty(inspection)).toBe(false);
    expect(buildProjectRuntimeSummary(inspection)).toBe('运行检查通过 · 可见节点 2 个');
    expect(buildProjectRuntimeRunnable(inspection)).toBe(true);
    expect(buildRuntimeDiagnosticEvidence('project-1', inspection)).toMatchObject({
      tool: 'inspectProjectRuntime',
      reason: 'ok',
      bodyTextLength: 12,
      visibleElementCount: 2
    });
    expect(formatProjectRuntimeInspection('project-1', inspection)).toContain('console：无输出');
  });

  it('summarizes blank pages and console errors with stable evidence', () => {
    const blank = makeRuntimeInspection({
      body: {
        readyState: 'complete',
        bodyChildCount: 0,
        bodyTextLength: 0,
        visibleElementCount: 0,
        interactiveElementCount: 0,
        viewportWidth: 390,
        viewportHeight: 844,
        documentWidth: 390,
        documentHeight: 844,
        maxElementWidth: 0,
        maxElementHeight: 0,
        resourceErrorCount: 0
      }
    });
    expect(isRuntimeBodyEmpty(blank)).toBe(true);
    expect(buildProjectRuntimeSummary(blank)).toBe('运行检查完成 · 页面疑似空白');
    expect(buildProjectRuntimeRunnable(blank)).toBe(false);
    expect(buildRuntimeDiagnosticEvidence('project-1', blank)).toMatchObject({
      reason: 'blank-page',
      bodyEmpty: true
    });

    const errored = makeRuntimeInspection({
      logs: [{
        level: 'error',
        args: ['Uncaught ReferenceError'],
        kind: 'runtime-error',
        filePath: 'app.js',
        lineNumber: 7,
        columnNumber: 3,
        stack: 'ReferenceError stack'
      }]
    });
    expect(buildProjectRuntimeSummary(errored)).toBe('运行检查完成 · console error 1 条 · app.js:7');
    expect(buildProjectRuntimeRunnable(errored)).toBe(false);
    expect(buildRuntimeDiagnosticEvidence('project-1', errored)).toMatchObject({
      reason: 'console-error',
      firstErrorMessage: 'Uncaught ReferenceError',
      firstErrorFilePath: 'app.js',
      firstErrorLineNumber: 7
    });
    expect(formatProjectRuntimeInspection('project-1', errored)).toContain('[error] app.js:7:3 · Uncaught ReferenceError');
  });
});
