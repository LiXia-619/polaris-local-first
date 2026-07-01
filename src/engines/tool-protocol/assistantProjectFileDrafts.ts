import type { AssistantToolAction } from './assistantToolProtocolTypes';
import { parseToolPayload } from './assistantToolProtocolPayload';
import { normalizeCodeCardFilePath } from '../roomProjects';
import type { CodeCardFileRole } from '../../types/domain';

type ProjectFileDraftBlock = {
  raw: string;
  header: string;
  body: string;
};

const PROJECT_FILE_FENCE = '```polaris-project-file';

type ProjectFileDraftDisplayMode = 'strip-body' | 'project-body-as-code';

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeFileRole(value: unknown): CodeCardFileRole | undefined {
  switch (value) {
    case 'entry':
    case 'style':
    case 'logic':
    case 'content':
    case 'note':
    case 'asset-manifest':
      return value;
    default:
      return undefined;
  }
}

function inferLanguageFromPath(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'jsx':
      return 'jsx';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'txt':
      return 'text';
    default:
      return undefined;
  }
}

function asHeaderObject(header: string): Record<string, unknown> {
  const trimmed = header.trim();
  if (!trimmed) return {};
  const parsed = parseToolPayload(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('工作区文件头必须是对象。');
  }
  return parsed as Record<string, unknown>;
}

function extractProjectFileDraftBlocks(
  content: string,
  displayMode: ProjectFileDraftDisplayMode
) {
  const blocks: ProjectFileDraftBlock[] = [];
  let displayContent = '';
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf(PROJECT_FILE_FENCE, cursor);
    if (start === -1) {
      displayContent += content.slice(cursor);
      break;
    }

    displayContent += content.slice(cursor, start);
    const headerStart = start + PROJECT_FILE_FENCE.length;
    const lineEnd = content.indexOf('\n', headerStart);
    const bodyStart = lineEnd === -1 ? content.length : lineEnd + 1;
    const header = lineEnd === -1 ? content.slice(headerStart) : content.slice(headerStart, lineEnd);
    const fenceEnd = content.indexOf('```', bodyStart);
    const closed = fenceEnd !== -1;
    const bodyEnd = closed ? fenceEnd : content.length;
    const body = content.slice(bodyStart, bodyEnd);
    const raw = content.slice(start, closed ? fenceEnd + 3 : content.length);

    blocks.push({ raw, header, body });
    cursor = closed ? fenceEnd + 3 : content.length;
    if (displayMode === 'project-body-as-code') {
      displayContent += rawToVisibleCodeBlock(header, body);
    }
  }

  return { displayContent, blocks };
}

function rawToVisibleCodeBlock(header: string, body: string) {
  let language = '';
  try {
    const parsed = asHeaderObject(header);
    language = normalizeOptionalString(parsed.language)
      ?? inferLanguageFromPath(normalizeOptionalString(parsed.filePath) ?? '')
      ?? '';
  } catch {
    language = '';
  }

  return `\`\`\`${language}\n${body}${body.endsWith('\n') ? '' : '\n'}\`\`\``;
}

function buildActionsForBlock(block: ProjectFileDraftBlock): {
  actions: AssistantToolAction[];
  issue?: string;
} {
  let header: Record<string, unknown>;
  try {
    header = asHeaderObject(block.header);
  } catch (error) {
    return {
      actions: [],
      issue: `工作区文件块解析失败：${error instanceof Error ? error.message : '未知错误'}`
    };
  }

  const projectId =
    normalizeOptionalString(header.projectId)
    ?? normalizeOptionalString(header.project_id);
  const filePath = normalizeCodeCardFilePath(
    normalizeOptionalString(header.filePath)
    ?? normalizeOptionalString(header.file_path)
  );
  if (!projectId) return { actions: [], issue: '工作区文件块缺少 projectId。' };
  if (!filePath) return { actions: [], issue: '工作区文件块缺少 filePath。' };

  const mode = normalizeOptionalString(header.mode);
  const language = normalizeOptionalString(header.language) ?? inferLanguageFromPath(filePath);
  const fileRole = normalizeFileRole(header.fileRole ?? header.file_role);
  const code = block.body;
  const appendMode = mode === 'append';

  if (!appendMode) {
    return {
      actions: [{
        kind: 'writeProjectFiles',
        projectId,
        files: [{
          filePath,
          fileRole,
          language,
          code,
          replaceContent: true
        }],
        openInCollection: false
      }]
    };
  }

  const actions: AssistantToolAction[] = [{
    kind: 'createProjectFile',
    file: {
      projectId,
      filePath,
      fileRole,
      language,
      code: '',
      replaceContent: false
    },
    openInCollection: false
  }];

  if (code.length > 0) {
    actions.push({
      kind: 'appendProjectFile',
      projectId,
      filePath,
      code,
      openInCollection: false
    });
  }

  return { actions };
}

export function extractProjectFileDraftActions(
  content: string,
  options: {
    preserveDraftBodyInDisplay?: boolean;
  } = {}
): {
  displayContent: string;
  actions: AssistantToolAction[];
  issues: string[];
} {
  const { displayContent, blocks } = extractProjectFileDraftBlocks(
    content,
    options.preserveDraftBodyInDisplay ? 'project-body-as-code' : 'strip-body'
  );
  const actions: AssistantToolAction[] = [];
  const issues: string[] = [];

  for (const block of blocks) {
    const result = buildActionsForBlock(block);
    actions.push(...result.actions);
    if (result.issue) issues.push(result.issue);
  }

  return {
    displayContent,
    actions,
    issues
  };
}
