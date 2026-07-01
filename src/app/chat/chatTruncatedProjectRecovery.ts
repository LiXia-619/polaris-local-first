import type { AssistantNativeToolCall } from '../../engines/chatApi';
import type { AssistantToolAction } from '../../engines/assistantToolProtocol';
import { normalizeCodeCardFilePath } from '../../engines/roomProjects';
import type { CodeCardFileRole } from '../../types/domain';

function decodeDraftString(input: string, trim = true) {
  const decoded = input
    .replace(/\\\\/g, '\0')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\0/g, '\\');

  return trim ? decoded.trim() : decoded;
}

function extractDraftField(input: string, fields: string | string[], options: { trim?: boolean } = {}) {
  const fieldList = Array.isArray(fields) ? fields : [fields];
  for (const field of fieldList) {
    const match = new RegExp(`"${field}"\\s*:\\s*"`, 'i').exec(input);
    if (!match) continue;

    let value = '';
    let escaped = false;
    for (let index = match.index + match[0].length; index < input.length; index += 1) {
      const character = input[index];
      if (escaped) {
        value += `\\${character}`;
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return decodeDraftString(value, options.trim ?? true);
      }
      value += character;
    }

    return decodeDraftString(value, options.trim ?? true);
  }

  return undefined;
}

function extractDraftNumber(input: string, fields: string | string[]) {
  const fieldList = Array.isArray(fields) ? fields : [fields];
  for (const field of fieldList) {
    const match = new RegExp(`"${field}"\\s*:\\s*(\\d+)`, 'i').exec(input);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 1) return value;
  }
  return undefined;
}

function normalizeFileRole(value: string | undefined): CodeCardFileRole | undefined {
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
    default:
      return undefined;
  }
}

function buildProjectTitle(projectId: string) {
  return projectId
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    || '未命名工作区';
}

function recoverCreateRoomProject(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const projectId = extractDraftField(toolCall.argumentsText, ['projectId', 'project_id', 'id']);
  if (!projectId) return null;

  return {
    kind: 'createRoomProject',
    project: {
      projectId,
      title: extractDraftField(toolCall.argumentsText, 'title') ?? buildProjectTitle(projectId)
    },
    openInCollection: false
  };
}

function recoverCreateProjectFile(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const projectId = extractDraftField(toolCall.argumentsText, ['projectId', 'project_id']);
  const filePath = normalizeCodeCardFilePath(
    extractDraftField(toolCall.argumentsText, ['filePath', 'file_path'])
  );
  if (!projectId || !filePath) return null;

  const language = extractDraftField(toolCall.argumentsText, 'language') ?? inferLanguageFromPath(filePath);

  return {
    kind: 'createProjectFile',
    file: {
      projectId,
      filePath,
      fileRole: normalizeFileRole(extractDraftField(toolCall.argumentsText, ['fileRole', 'file_role'])),
      language,
      code: extractDraftField(toolCall.argumentsText, 'code', { trim: false }) ?? ''
    },
    openInCollection: false
  };
}

function recoverAppendProjectFile(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const code = extractDraftField(toolCall.argumentsText, 'code', { trim: false });
  const projectId = extractDraftField(toolCall.argumentsText, ['projectId', 'project_id']);
  const filePath = normalizeCodeCardFilePath(
    extractDraftField(toolCall.argumentsText, ['filePath', 'file_path'])
  );

  if (!projectId || !filePath || !code) return null;

  return {
    kind: 'appendProjectFile',
    projectId,
    filePath,
    code,
    openInCollection: false
  };
}

function recoverInsertProjectFile(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const code = extractDraftField(toolCall.argumentsText, 'code', { trim: false });
  const projectId = extractDraftField(toolCall.argumentsText, ['projectId', 'project_id']);
  const filePath = normalizeCodeCardFilePath(
    extractDraftField(toolCall.argumentsText, ['filePath', 'file_path'])
  );
  const beforeString = extractDraftField(toolCall.argumentsText, ['beforeString', 'before_string', 'beforeSelector', 'before_selector'], { trim: false });
  const afterString = extractDraftField(toolCall.argumentsText, ['afterString', 'after_string', 'afterSelector', 'after_selector'], { trim: false });

  if (!projectId || !filePath || !code || (!beforeString && !afterString)) return null;

  return {
    kind: 'insertProjectFile',
    projectId,
    filePath,
    beforeString: beforeString || undefined,
    afterString: beforeString ? undefined : afterString,
    code,
    openInCollection: false
  };
}

function recoverAppendCodeCard(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const code = extractDraftField(toolCall.argumentsText, 'code', { trim: false });
  if (!code) return null;

  return {
    kind: 'appendCodeCard',
    target: extractDraftField(toolCall.argumentsText, 'target'),
    code,
    openInCollection: false
  };
}

function recoverEditCodeCardText(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const oldString = extractDraftField(toolCall.argumentsText, ['oldString', 'old_string'], { trim: false });
  const newString = extractDraftField(toolCall.argumentsText, ['newString', 'new_string'], { trim: false });

  if (!oldString || newString === undefined) return null;

  return {
    kind: 'editCodeCardText',
    target: extractDraftField(toolCall.argumentsText, 'target'),
    oldString,
    newString,
    openInCollection: false
  };
}

function recoverEditProjectFileText(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const projectId = extractDraftField(toolCall.argumentsText, ['projectId', 'project_id']);
  const filePath = normalizeCodeCardFilePath(
    extractDraftField(toolCall.argumentsText, ['filePath', 'file_path'])
  );
  const oldString = extractDraftField(toolCall.argumentsText, ['oldString', 'old_string'], { trim: false });
  const newString = extractDraftField(toolCall.argumentsText, ['newString', 'new_string'], { trim: false });

  if (!projectId || !filePath || !oldString || newString === undefined) return null;

  return {
    kind: 'editProjectFileText',
    projectId,
    filePath,
    oldString,
    newString,
    openInCollection: false
  };
}

function recoverReplaceProjectFileLines(toolCall: AssistantNativeToolCall): AssistantToolAction | null {
  const projectId = extractDraftField(toolCall.argumentsText, ['projectId', 'project_id']);
  const filePath = normalizeCodeCardFilePath(
    extractDraftField(toolCall.argumentsText, ['filePath', 'file_path'])
  );
  const startLine = extractDraftNumber(toolCall.argumentsText, ['startLine', 'start_line']);
  const endLine = extractDraftNumber(toolCall.argumentsText, ['endLine', 'end_line']);
  const code = extractDraftField(toolCall.argumentsText, ['code', 'content', 'replacement'], { trim: false });

  if (!projectId || !filePath || !startLine || code === undefined) return null;

  return {
    kind: 'replaceProjectFileLines',
    projectId,
    filePath,
    startLine,
    endLine,
    code,
    openInCollection: false
  };
}

export function recoverTruncatedNativeProjectActions(
  toolCalls: AssistantNativeToolCall[] = []
): AssistantToolAction[] {
  const recovered: AssistantToolAction[] = [];

  for (const toolCall of toolCalls) {
    const name = toolCall.name.trim();
    const action =
      name === 'createRoomProject'
        ? recoverCreateRoomProject(toolCall)
        : name === 'createProjectFile'
          ? recoverCreateProjectFile(toolCall)
          : name === 'appendProjectFile'
            ? recoverAppendProjectFile(toolCall)
            : name === 'insertProjectFile'
              ? recoverInsertProjectFile(toolCall)
              : name === 'replaceProjectFileLines'
                ? recoverReplaceProjectFileLines(toolCall)
                : name === 'appendCodeCard'
                  ? recoverAppendCodeCard(toolCall)
                  : name === 'editProjectFileText'
                    ? recoverEditProjectFileText(toolCall)
                    : name === 'editCodeCardText'
                      ? recoverEditCodeCardText(toolCall)
            : null;

    if (action) recovered.push(action);
  }

  return recovered;
}
