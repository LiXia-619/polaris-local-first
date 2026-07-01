import type { ProjectFile, RoomProject } from '../types/domain';
import { normalizeCodeLanguage } from './codeCardLanguage';
import {
  resolveRoomProjectFiles,
  resolveRunnableRoomProjectEntryFile,
  type ResolvedRoomProjectFile
} from './roomProjects';

type RoomProjectPreview = {
  entryFileId: string | null;
  entryFilePath?: string;
  language: string;
  srcDoc: string | null;
  content: string;
  presentation: 'code' | 'text';
};

export type RoomProjectPreviewCheck = {
  runnable: boolean;
  entryFileId: string | null;
  entryFilePath?: string;
  fileCount: number;
  inlinedLocalAssets: string[];
  missingLocalAssets: string[];
  externalAssets: string[];
  diagnostics: RoomProjectPreviewDiagnostic[];
};

export type RoomProjectPreviewDiagnostic = {
  severity: 'info' | 'warning' | 'error';
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
  message: string;
  excerpt?: string;
};

function escapeForScriptTag(value: string) {
  return value.replace(/<\/script/gi, '<\\/script');
}

function isExternalResourcePath(value: string) {
  return /^(?:[a-z]+:|\/\/|#)/i.test(value);
}

function normalizeProjectPath(value: string) {
  const output: string[] = [];
  for (const rawSegment of value.split('/')) {
    const segment = rawSegment.trim();
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      output.pop();
      continue;
    }
    output.push(segment);
  }
  return output.join('/');
}

function dirname(value: string) {
  const segments = normalizeProjectPath(value).split('/');
  segments.pop();
  return segments.join('/');
}

function resolveRelativeProjectPath(basePath: string, targetPath: string) {
  if (isExternalResourcePath(targetPath)) return null;
  if (targetPath.startsWith('/')) {
    return normalizeProjectPath(targetPath);
  }
  const baseDir = dirname(basePath);
  return normalizeProjectPath(baseDir ? `${baseDir}/${targetPath}` : targetPath);
}

function extractHtmlAssetReferences(html: string) {
  const references: Array<{ kind: 'style' | 'script'; path: string }> = [];

  html.replace(
    /<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi,
    (match, before, _quote, href, after) => {
      const attrs = `${before ?? ''} ${after ?? ''}`;
      if (/rel\s*=\s*["']?stylesheet["']?/i.test(attrs)) {
        references.push({ kind: 'style', path: href });
      }
      return match;
    }
  );

  html.replace(
    /<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi,
    (match, _before, _quote, src) => {
      references.push({ kind: 'script', path: src });
      return match;
    }
  );

  return references;
}

function lineNumberAtOffset(source: string, offset: number) {
  return source.slice(0, Math.max(0, offset)).split(/\r\n|\r|\n/).length;
}

function extractInlineScriptSources(entryFile: ResolvedRoomProjectFile): ProjectScriptSource[] {
  const sources: ProjectScriptSource[] = [];
  let inlineScriptIndex = 0;

  entryFile.content.replace(
    /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi,
    (match, scriptContent, offset) => {
      inlineScriptIndex += 1;
      sources.push({
        filePath: `${entryFile.path}#inline-script-${inlineScriptIndex}`,
        content: scriptContent,
        lineOffset: lineNumberAtOffset(entryFile.content, offset + match.indexOf('>') + 1) - 1
      });
      return match;
    }
  );

  return sources;
}

type ProjectScriptSource = {
  filePath: string;
  content: string;
  lineOffset: number;
};

function escapeInlineScriptJson(value: string) {
  return JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
}

function encodeSourceUrlPath(filePath: string) {
  return `polaris-project:///${encodeURI(filePath).replace(/#/g, '%23')}`;
}

function appendProjectSourceUrl(scriptContent: string, filePath: string) {
  if (/\bsourceURL\s*=/.test(scriptContent)) return scriptContent;
  return `${scriptContent.trimEnd()}\n//# sourceURL=${encodeSourceUrlPath(filePath)}`;
}

function readScriptAttribute(attrs: string, name: string) {
  const quoted = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(attrs);
  if (quoted) return quoted[2] ?? '';
  const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s"'=<>` + '`' + `]+)`, 'i').exec(attrs);
  return bare?.[1] ?? null;
}

function buildProjectScriptProbe(filePath: string, lineOffset: number, phase: 'start' | 'end') {
  const key = '__polarisRuntimeScriptProbe';
  if (phase === 'end') {
    return `<script data-room-project-probe="end">window.${key}=null;</script>`;
  }
  return [
    '<script data-room-project-probe="start">',
    `window.${key}={filePath:${escapeInlineScriptJson(filePath)},lineOffset:${lineOffset}};`,
    '</script>'
  ].join('');
}

function annotateInlineProjectScripts(html: string, entryPath: string) {
  let inlineScriptIndex = 0;
  return html.replace(
    /<script\b((?:(?!\bsrc\s*=)[^>])*)>([\s\S]*?)<\/script>/gi,
    (match, attrs, scriptContent, offset) => {
      if (/\bdata-room-project-probe\s*=/.test(attrs)) return match;
      const projectPath = readScriptAttribute(attrs, 'data-room-project-path');
      const filePath = projectPath || `${entryPath}#inline-script-${inlineScriptIndex + 1}`;
      const lineOffset = projectPath ? 0 : lineNumberAtOffset(html, offset + match.indexOf('>') + 1) - 1;
      inlineScriptIndex += 1;
      const annotatedContent = appendProjectSourceUrl(scriptContent, filePath);
      return [
        buildProjectScriptProbe(filePath, lineOffset, 'start'),
        `<script${attrs}>${annotatedContent}</script>`,
        buildProjectScriptProbe(filePath, lineOffset, 'end')
      ].join('');
    }
  );
}

function collectDeclaredNames(source: string) {
  const declarations = new Map<string, number[]>();
  const patterns = [
    /\b(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g
  ];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      const name = match[1]!;
      const lines = declarations.get(name) ?? [];
      lines.push(lineNumberAtOffset(source, match.index));
      declarations.set(name, lines);
    }
  });

  return declarations;
}

function sourceExcerpt(source: string, lineNumber: number, radius = 1) {
  const lines = source.split(/\r\n|\r|\n/);
  const start = Math.max(1, lineNumber - radius);
  const end = Math.min(lines.length, lineNumber + radius);
  const excerpt: string[] = [];
  for (let line = start; line <= end; line += 1) {
    const marker = line === lineNumber ? '>' : ' ';
    excerpt.push(`${marker} ${line}: ${lines[line - 1] ?? ''}`);
  }
  return excerpt.join('\n');
}

function formatSyntaxDiagnostic(
  source: ProjectScriptSource,
  lineNumber: number | undefined,
  columnNumber: number | undefined,
  message: string
): RoomProjectPreviewDiagnostic {
  const projectLineNumber = typeof lineNumber === 'number'
    ? Math.max(1, lineNumber + source.lineOffset)
    : undefined;
  return {
    severity: 'error',
    filePath: source.filePath,
    lineNumber: projectLineNumber,
    columnNumber,
    message,
    excerpt: typeof lineNumber === 'number'
      ? sourceExcerpt(source.content, lineNumber)
      : undefined
  };
}

function scanProjectScriptStructure(source: ProjectScriptSource): RoomProjectPreviewDiagnostic | null {
  const stack: Array<{ token: string; lineNumber: number; columnNumber: number }> = [];
  const pairs: Record<string, string> = {
    ')': '(',
    ']': '[',
    '}': '{'
  };
  let mode: 'normal' | 'single' | 'double' | 'template' | 'line-comment' | 'block-comment' = 'normal';
  let lineNumber = 1;
  let columnNumber = 1;
  let tokenStart: { lineNumber: number; columnNumber: number; label: string } | null = null;
  let escaped = false;

  const current = () => source.content[index] ?? '';
  const next = () => source.content[index + 1] ?? '';
  const advance = (char: string) => {
    if (char === '\n') {
      lineNumber += 1;
      columnNumber = 1;
    } else {
      columnNumber += 1;
    }
  };

  for (var index = 0; index < source.content.length; index += 1) {
    const char = current();
    const upcoming = next();

    if (mode === 'line-comment') {
      if (char === '\n') mode = 'normal';
      advance(char);
      continue;
    }

    if (mode === 'block-comment') {
      if (char === '*' && upcoming === '/') {
        advance(char);
        index += 1;
        advance('/');
        mode = 'normal';
        tokenStart = null;
        continue;
      }
      advance(char);
      continue;
    }

    if (mode === 'single' || mode === 'double' || mode === 'template') {
      const closing = mode === 'single' ? '\'' : mode === 'double' ? '"' : '`';
      if (escaped) {
        escaped = false;
        advance(char);
        continue;
      }
      if (char === '\\') {
        escaped = true;
        advance(char);
        continue;
      }
      if (char === closing) {
        mode = 'normal';
        tokenStart = null;
        advance(char);
        continue;
      }
      if (char === '\n' && mode !== 'template') {
        return formatSyntaxDiagnostic(
          source,
          tokenStart?.lineNumber ?? lineNumber,
          tokenStart?.columnNumber ?? columnNumber,
          `${tokenStart?.label ?? '字符串'}没有闭合，脚本会在解析阶段中断。`
        );
      }
      advance(char);
      continue;
    }

    if (char === '/' && upcoming === '/') {
      mode = 'line-comment';
      advance(char);
      index += 1;
      advance('/');
      continue;
    }
    if (char === '/' && upcoming === '*') {
      mode = 'block-comment';
      tokenStart = { lineNumber, columnNumber, label: '块注释' };
      advance(char);
      index += 1;
      advance('*');
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      mode = char === '\'' ? 'single' : char === '"' ? 'double' : 'template';
      tokenStart = { lineNumber, columnNumber, label: char === '`' ? '模板字符串' : '字符串' };
      advance(char);
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      stack.push({ token: char, lineNumber, columnNumber });
      advance(char);
      continue;
    }
    if (char === ')' || char === ']' || char === '}') {
      const expected = pairs[char];
      const opening = stack.pop();
      if (!opening || opening.token !== expected) {
        return formatSyntaxDiagnostic(
          source,
          lineNumber,
          columnNumber,
          `多出的 ${char} 没有匹配的 ${expected}，脚本会在解析阶段中断。`
        );
      }
      advance(char);
      continue;
    }

    advance(char);
  }

  if (mode === 'block-comment') {
    return formatSyntaxDiagnostic(
      source,
      tokenStart?.lineNumber ?? lineNumber,
      tokenStart?.columnNumber ?? columnNumber,
      '块注释没有闭合，脚本会在解析阶段中断。'
    );
  }
  if (mode === 'single' || mode === 'double' || mode === 'template') {
    return formatSyntaxDiagnostic(
      source,
      tokenStart?.lineNumber ?? lineNumber,
      tokenStart?.columnNumber ?? columnNumber,
      `${tokenStart?.label ?? '字符串'}没有闭合，脚本会在解析阶段中断。`
    );
  }
  const opening = stack.pop();
  if (opening) {
    const closing = opening.token === '(' ? ')' : opening.token === '[' ? ']' : '}';
    return formatSyntaxDiagnostic(
      source,
      opening.lineNumber,
      opening.columnNumber,
      `${opening.token} 没有对应的 ${closing}，脚本会在解析阶段中断。`
    );
  }

  return null;
}

function parseProjectScriptWithBrowser(source: ProjectScriptSource): RoomProjectPreviewDiagnostic | null {
  try {
    new Function(source.content);
    return null;
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : String(error);
    return formatSyntaxDiagnostic(
      source,
      undefined,
      undefined,
      `浏览器语法解析失败：${message}`
    );
  }
}

function checkProjectScriptSyntax(source: ProjectScriptSource): RoomProjectPreviewDiagnostic | null {
  return scanProjectScriptStructure(source) ?? parseProjectScriptWithBrowser(source);
}

function checkProjectJavaScriptDiagnostics(
  entryFile: ResolvedRoomProjectFile,
  filesByPath: Map<string, ResolvedRoomProjectFile>
): RoomProjectPreviewDiagnostic[] {
  const diagnostics: RoomProjectPreviewDiagnostic[] = [];
  const scriptSources = extractInlineScriptSources(entryFile);

  extractHtmlAssetReferences(entryFile.content).forEach((reference) => {
    if (reference.kind !== 'script') return;
    const resolvedPath = resolveRelativeProjectPath(entryFile.path, reference.path);
    const file = resolvedPath ? filesByPath.get(resolvedPath) : undefined;
    if (!file) return;
    scriptSources.push({
      filePath: file.path,
      content: file.content,
      lineOffset: 0
    });
  });

  const declaredNames = new Map<string, Array<{ filePath: string; lineNumber: number }>>();
  scriptSources.forEach((source) => {
    collectDeclaredNames(source.content).forEach((lines, name) => {
      const entries = declaredNames.get(name) ?? [];
      lines.forEach((lineNumber) => {
        entries.push({
          filePath: source.filePath,
          lineNumber: lineNumber + source.lineOffset
        });
      });
      declaredNames.set(name, entries);
    });
  });

  scriptSources.forEach((source) => {
    const syntaxDiagnostic = checkProjectScriptSyntax(source);
    if (syntaxDiagnostic) diagnostics.push(syntaxDiagnostic);
  });

  declaredNames.forEach((entries, name) => {
    if (entries.length <= 1) return;
    const first = entries[0]!;
    diagnostics.push({
      severity: 'warning',
      filePath: first.filePath,
      lineNumber: first.lineNumber,
      message: `重复声明 ${name}，可能会覆盖前一个定义。`
    });
  });

  const domReadyListeners = scriptSources.reduce(
    (count, source) => count + (source.content.match(/DOMContentLoaded/g) ?? []).length,
    0
  );
  if (domReadyListeners > 1) {
    diagnostics.push({
      severity: 'info',
      filePath: entryFile.path,
      message: `发现 ${domReadyListeners} 处 DOMContentLoaded 监听，注意不要重复初始化同一组组件。`
    });
  }

  return diagnostics;
}

function projectAssetMatchesReference(
  reference: { kind: 'style' | 'script' },
  file: Pick<ProjectFile, 'language'>
) {
  const language = normalizeCodeLanguage(file.language);
  if (reference.kind === 'style') return language === 'css';
  return language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts';
}

function buildProjectManifest(project: RoomProject, projectFiles: ProjectFile[]) {
  const files = resolveRoomProjectFiles(project, projectFiles);
  return files
    .map((file) => `// ${file.path}${file.isEntry ? ' [entry]' : ''}\n${file.content}`)
    .join('\n\n');
}

function inlineProjectAssets(
  entryPath: string,
  html: string,
  filesByPath: Map<string, Pick<ProjectFile, 'content' | 'language'>>
) {
  const withStyles = html.replace(
    /<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi,
    (match, before, _quote, href, after) => {
      const attrs = `${before ?? ''} ${after ?? ''}`;
      if (!/rel\s*=\s*["']?stylesheet["']?/i.test(attrs)) return match;
      const resolvedPath = resolveRelativeProjectPath(entryPath, href);
      if (!resolvedPath) return match;
      const target = filesByPath.get(resolvedPath);
      if (!target || normalizeCodeLanguage(target.language) !== 'css') return match;
      return `<style data-room-project-path="${resolvedPath}">\n${target.content}\n</style>`;
    }
  );

  return withStyles.replace(
    /<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi,
    (match, before, _quote, src, after) => {
      const resolvedPath = resolveRelativeProjectPath(entryPath, src);
      if (!resolvedPath) return match;
      const target = filesByPath.get(resolvedPath);
      if (!target) return match;
      const language = normalizeCodeLanguage(target.language);
      if (language !== 'javascript' && language !== 'js' && language !== 'typescript' && language !== 'ts') return match;
      const attrs = `${before ?? ''} ${after ?? ''}`.replace(/\s+src=(["']).*?\1/i, '');
      return `<script${attrs} data-room-project-path="${resolvedPath}">\n${escapeForScriptTag(target.content)}\n</script>`;
    }
  );
}

export function buildRoomProjectPreview(
  project: RoomProject,
  projectFiles: ProjectFile[] = []
): RoomProjectPreview | null {
  const files = resolveRoomProjectFiles(project, projectFiles);
  if (files.length === 0) return null;

  const content = buildProjectManifest(project, projectFiles);
  const entryFile = resolveRunnableRoomProjectEntryFile(project, files);

  if (entryFile) {
    const filesByPath = new Map(
      files.map((file) => [file.path, { content: file.content, language: file.language }] as const)
    );
    return {
      entryFileId: entryFile.fileId,
      entryFilePath: entryFile.path,
      language: 'html',
      srcDoc: annotateInlineProjectScripts(inlineProjectAssets(entryFile.path, entryFile.content, filesByPath), entryFile.path),
      content,
      presentation: 'code'
    };
  }

  return {
    entryFileId: null,
    language: 'text',
    srcDoc: null,
    content: [
      '这个工作区现在还没有可运行的 HTML 入口。',
      '工作区运行只会渲染真实入口页面，不会再退回到按钮/气泡样例预览。',
      '',
      '你可以补一个 `index.html` 或标成 `entry` 的 HTML 文件，再点运行。',
      '',
      '当前工作区文件：',
      '',
      content
    ].join('\n'),
    presentation: 'text'
  };
}

export function checkRoomProjectPreview(
  project: RoomProject,
  projectFiles: ProjectFile[] = []
): RoomProjectPreviewCheck {
  const files = resolveRoomProjectFiles(project, projectFiles);
  const entryFile = resolveRunnableRoomProjectEntryFile(project, files);
  if (!entryFile) {
    return {
      runnable: false,
      entryFileId: null,
      fileCount: files.length,
      inlinedLocalAssets: [],
      missingLocalAssets: [],
      externalAssets: [],
      diagnostics: []
    };
  }

  const filesByPath = new Map(files.map((file) => [file.path, file] as const));
  const inlinedLocalAssets: string[] = [];
  const missingLocalAssets: string[] = [];
  const externalAssets: string[] = [];

  extractHtmlAssetReferences(entryFile.content).forEach((reference) => {
    if (isExternalResourcePath(reference.path)) {
      externalAssets.push(reference.path);
      return;
    }
    const resolvedPath = resolveRelativeProjectPath(entryFile.path, reference.path);
    const targetFile = resolvedPath ? filesByPath.get(resolvedPath) : undefined;
    if (!resolvedPath || !targetFile || !projectAssetMatchesReference(reference, targetFile)) {
      missingLocalAssets.push(reference.path);
      return;
    }
    inlinedLocalAssets.push(resolvedPath);
  });

  return {
    runnable: true,
    entryFileId: entryFile.fileId,
    entryFilePath: entryFile.path,
    fileCount: files.length,
    inlinedLocalAssets: [...new Set(inlinedLocalAssets)],
    missingLocalAssets: [...new Set(missingLocalAssets)],
    externalAssets: [...new Set(externalAssets)],
    diagnostics: checkProjectJavaScriptDiagnostics(entryFile, filesByPath)
  };
}
