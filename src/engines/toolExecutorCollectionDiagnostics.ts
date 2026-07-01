import type { RoomProjectPreviewCheck } from './roomProjectPreview';
import type { RoomProjectRuntimeInspection } from './roomProjectRuntimeInspection';
import type { ProjectDiagnosticEvidence } from '../types/domain';

export function isRuntimeBodyEmpty(inspection: RoomProjectRuntimeInspection) {
  const body = inspection.body;
  if (!body) return false;
  return body.bodyTextLength === 0 && body.visibleElementCount === 0;
}

export function buildProjectPreviewSummary(projectTitle: string, check: RoomProjectPreviewCheck) {
  const syntaxErrorCount = check.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const firstSyntaxError = check.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  return check.runnable
    ? syntaxErrorCount
      ? `预览检查完成 · 脚本语法错误 ${syntaxErrorCount} 条${firstSyntaxError?.filePath ? ` · ${firstSyntaxError.filePath}${firstSyntaxError.lineNumber ? `:${firstSyntaxError.lineNumber}` : ''}` : ''}`
      : `预览检查通过 · ${check.entryFilePath ?? projectTitle}`
    : '预览检查完成 · 没有 HTML 入口';
}

export function buildProjectPreviewRunnable(check: RoomProjectPreviewCheck) {
  return check.runnable && !check.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

export function buildPreviewDiagnosticEvidence(
  projectId: string,
  check: RoomProjectPreviewCheck
): ProjectDiagnosticEvidence {
  const errorsCount = check.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warningsCount = check.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  const firstError = check.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  return {
    tool: 'checkProjectPreview',
    projectId,
    runnable: check.runnable,
    reason: check.runnable ? errorsCount > 0 ? 'syntax-error' : 'ok' : 'missing-entry',
    entryFileId: check.entryFileId ?? undefined,
    entryFilePath: check.entryFilePath,
    fileCount: check.fileCount,
    inlinedLocalAssets: check.inlinedLocalAssets,
    missingLocalAssets: check.missingLocalAssets,
    externalAssets: check.externalAssets,
    diagnostics: check.diagnostics,
    errorsCount,
    warningsCount,
    firstErrorMessage: firstError?.message,
    firstErrorFilePath: firstError?.filePath,
    firstErrorLineNumber: firstError?.lineNumber,
    firstErrorColumnNumber: firstError?.columnNumber
  };
}

export function formatProjectPreviewCheck(projectId: string, check: RoomProjectPreviewCheck) {
  return [
    `工作区：${projectId}`,
    check.runnable ? '状态：可预览' : '状态：没有可运行 HTML 入口',
    check.entryFilePath ? `入口：${check.entryFilePath}` : null,
    `文件数：${check.fileCount}`,
    check.inlinedLocalAssets.length ? `已找到本地资源：${check.inlinedLocalAssets.join('、')}` : '已找到本地资源：无',
    check.missingLocalAssets.length ? `缺失本地资源：${check.missingLocalAssets.join('、')}` : '缺失本地资源：无',
    check.externalAssets.length ? `外部资源：${check.externalAssets.join('、')}` : null,
    '',
    check.diagnostics.length
      ? [
          '静态诊断：',
          ...check.diagnostics.map((diagnostic) => {
            const location = diagnostic.lineNumber
              ? `${diagnostic.filePath}:${diagnostic.lineNumber}${diagnostic.columnNumber ? `:${diagnostic.columnNumber}` : ''}`
              : diagnostic.filePath;
            const label = diagnostic.severity === 'error'
              ? '错误'
              : diagnostic.severity === 'warning'
                ? '警告'
                : '提示';
            return [
              `${label} · ${location} · ${diagnostic.message}`,
              diagnostic.excerpt
            ].filter(Boolean).join('\n');
          })
        ].join('\n')
      : '静态诊断：入口结构和资源引用未发现问题'
  ].filter(Boolean).join('\n');
}

export function buildProjectRuntimeSummary(inspection: RoomProjectRuntimeInspection) {
  const hasErrors = inspection.logs.some((log) => log.level === 'error');
  const firstError = inspection.logs.find((log) => log.level === 'error');
  const firstErrorLocation = firstError?.filePath
    ? `${firstError.filePath}${firstError.lineNumber ? `:${firstError.lineNumber}` : ''}`
    : firstError?.filename
      ? `${firstError.filename}${firstError.lineNumber ? `:${firstError.lineNumber}` : ''}`
      : '';
  const bodyEmpty = isRuntimeBodyEmpty(inspection);
  const resourceErrorCount = inspection.body?.resourceErrorCount ?? 0;
  return inspection.status === 'loaded'
    ? hasErrors
      ? resourceErrorCount > 0
        ? `运行检查完成 · 资源错误 ${resourceErrorCount} 条`
        : `运行检查完成 · console error ${inspection.logs.filter((log) => log.level === 'error').length} 条${firstErrorLocation ? ` · ${firstErrorLocation}` : ''}`
      : bodyEmpty
        ? '运行检查完成 · 页面疑似空白'
        : `运行检查通过 · 可见节点 ${inspection.body?.visibleElementCount ?? 0} 个`
    : inspection.status === 'not-runnable'
      ? '运行检查完成 · 没有 HTML 入口'
      : `运行检查完成 · ${inspection.status}`;
}

export function buildProjectRuntimeRunnable(inspection: RoomProjectRuntimeInspection) {
  const hasErrors = inspection.logs.some((log) => log.level === 'error');
  return inspection.runnable && inspection.status === 'loaded' && !hasErrors && !isRuntimeBodyEmpty(inspection);
}

export function buildRuntimeDiagnosticEvidence(
  projectId: string,
  inspection: RoomProjectRuntimeInspection
): ProjectDiagnosticEvidence {
  const errorsCount = inspection.logs.filter((log) => log.level === 'error').length;
  const warningsCount = inspection.logs.filter((log) => log.level === 'warn').length;
  const bodyEmpty = isRuntimeBodyEmpty(inspection);
  const resourceErrorCount = inspection.body?.resourceErrorCount ?? 0;
  const firstError = inspection.logs.find((log) => log.level === 'error');
  return {
    tool: 'inspectProjectRuntime',
    projectId,
    runnable: inspection.runnable,
    reason:
      inspection.status === 'loaded'
        ? errorsCount > 0
          ? resourceErrorCount > 0 ? 'resource-error' : 'console-error'
          : bodyEmpty ? 'blank-page' : 'ok'
        : inspection.status === 'not-runnable'
          ? 'not-runnable'
          : inspection.status,
    entryFileId: inspection.entryFileId ?? undefined,
    entryFilePath: inspection.entryFilePath,
    status: inspection.status,
    logs: inspection.logs.map((log) => ({
      level: log.level,
      message: log.args.join(' '),
      kind: log.kind,
      filePath: log.filePath,
      filename: log.filename,
      lineNumber: log.lineNumber,
      columnNumber: log.columnNumber,
      stack: log.stack,
      resourceUrl: log.resourceUrl,
      tagName: log.tagName
    })),
    firstErrorMessage: firstError?.args.join(' '),
    firstErrorFilePath: firstError?.filePath,
    firstErrorLineNumber: firstError?.lineNumber,
    firstErrorColumnNumber: firstError?.columnNumber,
    errorsCount,
    warningsCount,
    bodyEmpty: inspection.body ? bodyEmpty : undefined,
    bodyTextLength: inspection.body?.bodyTextLength,
    visibleElementCount: inspection.body?.visibleElementCount,
    interactiveElementCount: inspection.body?.interactiveElementCount,
    resourceErrorCount: inspection.body?.resourceErrorCount,
    viewportWidth: inspection.body?.viewportWidth,
    viewportHeight: inspection.body?.viewportHeight,
    documentWidth: inspection.body?.documentWidth,
    documentHeight: inspection.body?.documentHeight
  };
}

export function formatProjectRuntimeInspection(projectId: string, inspection: RoomProjectRuntimeInspection) {
  const errorLogs = inspection.logs.filter((log) => log.level === 'error');
  const bodyEmpty = isRuntimeBodyEmpty(inspection);
  const formatLogLocation = (log: RoomProjectRuntimeInspection['logs'][number]) => {
    const location = log.filePath ?? log.filename;
    if (!location) return '';
    return `${location}${log.lineNumber ? `:${log.lineNumber}${log.columnNumber ? `:${log.columnNumber}` : ''}` : ''} · `;
  };
  return [
    `工作区：${projectId}`,
    inspection.entryFilePath ? `入口：${inspection.entryFilePath}` : null,
    `状态：${
      inspection.status === 'loaded'
        ? '已运行'
        : inspection.status === 'timeout'
          ? '超时'
          : inspection.status === 'unavailable'
            ? '当前环境不可运行'
            : '没有可运行入口'
    }`,
    inspection.body
      ? [
          `页面：${bodyEmpty ? '疑似空白' : '有可见内容'} · readyState=${inspection.body.readyState ?? 'unknown'}`,
          `body 子节点 ${inspection.body.bodyChildCount} · 可见节点 ${inspection.body.visibleElementCount} · 可交互节点 ${inspection.body.interactiveElementCount} · 文本长度 ${inspection.body.bodyTextLength}`,
          `视口 ${inspection.body.viewportWidth}×${inspection.body.viewportHeight} · 文档 ${inspection.body.documentWidth}×${inspection.body.documentHeight} · 最大元素 ${inspection.body.maxElementWidth}×${inspection.body.maxElementHeight}`,
          inspection.body.resourceErrorCount ? `资源加载失败：${inspection.body.resourceErrorCount} 条` : null
        ].filter(Boolean).join('\n')
      : null,
    inspection.error ? `错误：${inspection.error}` : null,
    '',
    inspection.logs.length
      ? [
          `console：${inspection.logs.length} 条${errorLogs.length ? ` · error ${errorLogs.length} 条` : ''}`,
          ...inspection.logs.map((log) => [
            `[${log.level}] ${formatLogLocation(log)}${log.args.join(' ')}`,
            log.stack && !log.args.some((arg) => arg.includes(log.stack ?? '')) ? log.stack : ''
          ].filter(Boolean).join('\n'))
        ].join('\n')
      : 'console：无输出'
  ].filter(Boolean).join('\n');
}
