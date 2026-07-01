import type { ToolAction } from '../../engines/toolExecutor';
import type { AssistantToolAction } from '../../engines/assistantToolProtocol';
import type { McpResolvedToolDefinition } from '../../engines/mcpRuntime';
import { parseToolPayload } from '../../engines/tool-protocol/assistantToolProtocolPayload';
import type {
  AssistantToolContext,
  AssistantToolEnforcementScope,
  PolarisToolPromptGroup,
  PolarisToolPromptPreferences
} from '../../engines/tool-protocol/assistantToolProtocolTypes';
import { POLARIS_TOOL_PROMPT_GROUP_LABELS } from '../../engines/tool-protocol/toolPromptPreferences';
import { isPolarisToolPromptGroupEnabled } from '../../engines/tool-protocol/toolPromptPreferences';
import type { ProjectFile, ThemeToolMode } from '../../types/domain';
import { resolveAssistantActionAccess } from '../../engines/tool-protocol/toolActionAccess';
import type { ChatNativeToolCall, CodeCard } from '../../types/domain';
import { normalizeForMatch } from '../../engines/stringMatch';
import { findPreferredProjectFile, normalizeCodeCardFilePath } from '../../engines/roomProjects';
import type { RoomProjectTreeSnapshot } from '../../engines/roomProjects';
import { buildToolCardFunctionName, isRunnableToolCodeCard } from '../../engines/toolCardRuntime';
import {
  assertNeverToolAction,
  isDirectAssistantToolAction
} from '../../engines/toolActionKinds';

type ResolveAssistantToolActionsArgs = {
  actions: AssistantToolAction[];
  cards: CodeCard[];
  projectFiles?: ProjectFile[];
  projectScopes?: Pick<RoomProjectTreeSnapshot, 'id' | 'title' | 'slug'>[];
  activeCardId: string | null;
  activeProjectId?: string | null;
  enabledToolGroups?: PolarisToolPromptPreferences;
  toolEnforcementScope?: AssistantToolEnforcementScope;
  themeToolMode?: ThemeToolMode;
  availableToolNames?: ReadonlySet<string>;
  desktopLocalHost?: AssistantToolContext['desktopLocalHost'];
  imageGenerationAvailable?: boolean;
  memorySearchAvailable?: boolean;
  attachmentSnapshot?: AssistantToolContext['attachmentSnapshot'];
  imageAssetSnapshot?: AssistantToolContext['imageAssetSnapshot'];
  personalData?: AssistantToolContext['personalData'];
};

type CardTargetMatch =
  | { ok: true; card: CodeCard; note?: string }
  | { ok: false; error: string };

function unavailableToolActionError(group: PolarisToolPromptGroup) {
  return `当前没有“${POLARIS_TOOL_PROMPT_GROUP_LABELS[group]}”能力。`;
}

type ProjectFileTargetMatch =
  | { ok: true; file: ProjectFile; note?: string }
  | { ok: false; error: string };

function findCardByTarget(
  cards: CodeCard[],
  activeCardId: string | null,
  target?: string
): CardTargetMatch {
  if (!target || target === 'active') {
    const activeCard = cards.find((card) => card.id === activeCardId) ?? null;
    return activeCard ? { ok: true, card: activeCard } : { ok: false, error: '当前没有可用的活动房间。' };
  }

  const byId = cards.find((card) => card.id === target) ?? null;
  if (byId) return { ok: true, card: byId };

  const normalized = normalizeForMatch(target, { stripQuotes: true });
  const exact = cards.find((card) => normalizeForMatch(card.title, { stripQuotes: true }) === normalized) ?? null;
  if (exact) return { ok: true, card: exact };

  const fuzzyMatches = cards.filter((card) => {
    const title = normalizeForMatch(card.title, { stripQuotes: true });
    return title.includes(normalized) || normalized.includes(title);
  });

  if (fuzzyMatches.length === 1) {
    return { ok: true, card: fuzzyMatches[0] };
  }
  if (fuzzyMatches.length > 1) {
    return {
      ok: false,
      error: `“${target}”匹配到多个房间：${fuzzyMatches.slice(0, 3).map((card) => card.title).join('、')}。请说更具体一点。`
    };
  }

  return { ok: false, error: `没有找到名为“${target}”的房间。` };
}

function findProjectFileByTarget(
  projectFiles: ProjectFile[],
  target: string | undefined,
  activeProjectId: string | null | undefined
): ProjectFileTargetMatch | null {
  void projectFiles;
  void activeProjectId;
  if (!target) return null;
  return {
    ok: false,
    error: buildFreeTextProjectTargetError()
  };
}

function findProjectFileByProjectPath(
  projectFiles: ProjectFile[],
  projectScopes: Pick<RoomProjectTreeSnapshot, 'id' | 'title' | 'slug'>[],
  projectId?: string,
  filePath?: string,
  activeProjectId?: string | null
): ProjectFileTargetMatch | null {
  if (!filePath) return null;
  const normalizedFilePath = normalizeCodeCardFilePath(filePath);
  if (!normalizedFilePath) return null;

  const scopedProjectIds = new Set(projectFiles.map((file) => file.projectId).filter(Boolean));
  const resolveProjectScopeId = (value: string | undefined) => {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
      return activeProjectId?.trim() || undefined;
    }
    if (scopedProjectIds.has(normalizedValue)) {
      return normalizedValue;
    }

    const normalizedReference = normalizeForMatch(normalizedValue, { stripQuotes: true });
    const exactMatch = projectScopes.find((project) =>
      normalizeForMatch(project.id, { stripQuotes: true }) === normalizedReference
      || normalizeForMatch(project.slug, { stripQuotes: true }) === normalizedReference
      || normalizeForMatch(project.title, { stripQuotes: true }) === normalizedReference
    ) ?? null;
    return exactMatch?.id;
  };

  const normalizedProjectId = resolveProjectScopeId(projectId);
  if (!normalizedProjectId) {
    if (projectId?.trim()) {
      return {
        ok: false,
        error: `没有找到工作区“${projectId.trim()}”。如果你说的是当前工作区里的文件，直接传 filePath 就行。`
      };
    }
    return null;
  }

  const match = findPreferredProjectFile({
    projectFiles,
    projectId: normalizedProjectId,
    filePath: normalizedFilePath
  });
  if (match.file) {
    if (match.duplicateCount > 1 && !match.usedPreferredFile) {
      return {
        ok: false,
        error: buildDuplicateProjectFilePathError(normalizedProjectId, normalizedFilePath, match.duplicateCount)
      };
    }
    return {
      ok: true,
      file: match.file
    };
  }

  return {
    ok: false,
    error: `工作区 ${normalizedProjectId} 里没有找到 ${normalizedFilePath}。`
  };
}

function formatResolvedTargetLabel(
  target: Extract<CardTargetMatch, { ok: true }> | Extract<ProjectFileTargetMatch, { ok: true }>,
  fallbackLabel: string
) {
  return target.note ? `${fallbackLabel}（${target.note}）` : fallbackLabel;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildMissingProjectFileTargetError() {
  return '工作区文件动作需要明确 filePath；入口文件也传 filePath="index.html"，不要用 target=active。';
}

function buildMissingProjectTargetError() {
  return '当前没有可用的工作区。请先由用户打开一个工作区对话；进入工作区后再修改工作区封面或文件。';
}

function buildFreeTextProjectTargetError() {
  return '工作区文件动作不再支持 target；请直接传当前工作区里的 filePath，例如 index.html 或 script.js。';
}

function buildDuplicateProjectFilePathError(projectId: string, filePath: string, duplicateCount: number) {
  return `工作区 ${projectId} 里有 ${duplicateCount} 个 ${filePath}，不能猜要写哪一个。请先整理重复文件后再继续。`;
}

function buildProjectBoundaryError(actionProjectId: string | undefined, activeProjectId: string | null | undefined) {
  if (!activeProjectId) {
    return '这条对话还没有绑定工作区。工作区必须先由用户打开；模型不能在普通对话里创建或切换工作区。';
  }
  const requestedProjectId = actionProjectId?.trim();
  if (requestedProjectId && requestedProjectId !== activeProjectId) {
    return `这条对话已绑定工作区 ${activeProjectId}，不能写到 ${requestedProjectId}。需要切换工作区时，请由用户从目标工作区打开对话。`;
  }
  return null;
}

function resolveProjectActionBoundaryId(action: AssistantToolAction) {
  switch (action.kind) {
    case 'createProjectFile':
      return action.file.projectId;
    case 'writeProjectFiles':
    case 'patchRoomProject':
      return action.projectId;
    case 'listProjectFiles':
    case 'searchProjectFiles':
    case 'readWorkspacePreviewState':
    case 'listWorkspaceReferences':
    case 'searchWorkspaceReferences':
    case 'readWorkspaceReference':
    case 'promoteWorkspaceReferenceToProjectFile':
    case 'pinProjectFileAsReference':
    case 'checkProjectPreview':
    case 'inspectProjectRuntime':
      return action.projectId;
    case 'appendProjectFile':
    case 'insertProjectFile':
    case 'replaceProjectFileLines':
    case 'editProjectFileText':
    case 'deleteProjectFile':
    case 'readProjectFile':
    case 'readProjectFileContext':
      return action.projectId;
    case 'searchReadableContext':
      return action.projectId;
    default:
      return undefined;
  }
}

function isModelWorkspaceAction(action: AssistantToolAction) {
  return action.kind === 'createProjectFile'
    || action.kind === 'writeProjectFiles'
    || action.kind === 'patchRoomProject'
    || action.kind === 'listProjectFiles'
    || action.kind === 'searchProjectFiles'
    || action.kind === 'readWorkspacePreviewState'
    || action.kind === 'listWorkspaceReferences'
    || action.kind === 'searchWorkspaceReferences'
    || action.kind === 'readWorkspaceReference'
    || action.kind === 'promoteWorkspaceReferenceToProjectFile'
    || action.kind === 'pinProjectFileAsReference'
    || action.kind === 'searchReadableContext'
    || action.kind === 'checkProjectPreview'
    || action.kind === 'inspectProjectRuntime'
    || action.kind === 'appendProjectFile'
    || action.kind === 'insertProjectFile'
    || action.kind === 'replaceProjectFileLines'
    || action.kind === 'editProjectFileText'
    || action.kind === 'deleteProjectFile'
    || action.kind === 'readProjectFile'
    || action.kind === 'readProjectFileContext';
}

function normalizeStructuredArgs(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function findDuplicateWriteTargetError(args: {
  action: AssistantToolAction;
  projectFiles: ProjectFile[];
  activeProjectId?: string | null;
}) {
  const findDuplicateCount = (projectId: string, filePath: string) =>
    args.projectFiles.filter((file) =>
      file.projectId === projectId
      && normalizeCodeCardFilePath(file.filePath) === filePath
    ).length;

  if (args.action.kind === 'createProjectFile') {
    const projectId = args.action.file.projectId?.trim() || args.activeProjectId?.trim();
    const filePath = normalizeCodeCardFilePath(args.action.file.filePath);
    if (!projectId || !filePath) return null;
    const duplicateCount = findDuplicateCount(projectId, filePath);
    return duplicateCount > 1 ? buildDuplicateProjectFilePathError(projectId, filePath, duplicateCount) : null;
  }

  if (args.action.kind === 'promoteWorkspaceReferenceToProjectFile') {
    const projectId = args.action.projectId?.trim() || args.activeProjectId?.trim();
    const filePath = normalizeCodeCardFilePath(args.action.filePath);
    if (!projectId || !filePath) return null;
    const duplicateCount = findDuplicateCount(projectId, filePath);
    return duplicateCount > 1 ? buildDuplicateProjectFilePathError(projectId, filePath, duplicateCount) : null;
  }

  if (args.action.kind !== 'writeProjectFiles') return null;

  const projectId = args.activeProjectId?.trim();
  if (!projectId) return null;

  const seenFilePaths = new Set<string>();
  for (const file of args.action.files) {
    const normalizedFilePath = normalizeCodeCardFilePath(file.filePath);
    if (!normalizedFilePath) continue;
    if (seenFilePaths.has(normalizedFilePath)) {
      return `这次写入里重复出现 ${normalizedFilePath}，不能猜哪一份是最终内容。请把同一路径合成一次写入。`;
    }
    seenFilePaths.add(normalizedFilePath);

    const duplicateCount = findDuplicateCount(projectId, normalizedFilePath);
    if (duplicateCount > 1) {
      return buildDuplicateProjectFilePathError(projectId, normalizedFilePath, duplicateCount);
    }
  }

  return null;
}

function parseNativeArgumentsObject(argumentsText: string): Record<string, unknown> {
  const trimmed = argumentsText.trim();
  if (!trimmed) return {};

  const parsed = parseToolPayload(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('参数必须是对象。');
  }

  return parsed as Record<string, unknown>;
}

function parseToolCardPayload(argumentsText: string): {
  input?: string;
  args?: Record<string, unknown>;
  targetLabel?: string;
} {
  const parsed = parseToolPayload(argumentsText.trim() || '{}');

  if (typeof parsed === 'string') {
    return { input: parsed.trim() || undefined };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const asRecord = parsed as Record<string, unknown>;
  const directArgs = normalizeStructuredArgs(asRecord.args);
  const extraArgs = Object.fromEntries(
    Object.entries(asRecord).filter(([key]) => key !== 'input' && key !== 'args' && key !== 'targetLabel')
  );

  return {
    input: normalizeOptionalString(asRecord.input),
    args: directArgs ?? (Object.keys(extraArgs).length > 0 ? extraArgs : undefined),
    targetLabel: normalizeOptionalString(asRecord.targetLabel)
  };
}

export function resolveAssistantToolActions({
  actions,
  cards,
  projectFiles = [],
  projectScopes = [],
  activeCardId,
  activeProjectId,
  enabledToolGroups,
  toolEnforcementScope,
  themeToolMode,
  availableToolNames,
  desktopLocalHost,
  imageGenerationAvailable,
  memorySearchAvailable,
  attachmentSnapshot,
  imageAssetSnapshot,
  personalData
}: ResolveAssistantToolActionsArgs): {
  resolved: ToolAction[];
  errors: string[];
} {
  const resolved: ToolAction[] = [];
  const errors: string[] = [];

  for (const action of actions) {
    if (action.kind === 'createRoomProject' || action.kind === 'promoteCardToProject') {
      errors.push('工作区边界由用户决定。请让用户先新建、进入或切换工作区；模型不能直接创建、升格或切换工作区。');
      continue;
    }

    const workspaceBoundaryError = isModelWorkspaceAction(action)
      ? buildProjectBoundaryError(resolveProjectActionBoundaryId(action), activeProjectId)
      : null;
    if (workspaceBoundaryError) {
      errors.push(workspaceBoundaryError);
      continue;
    }

    if (action.kind === 'invokeMcpTool') {
      const isVisibleMcpTool =
        action.schemaName
          ? argsIncludesToolName(availableToolNames, action.schemaName)
          : true;
      if (toolEnforcementScope === 'theme-only' || !isVisibleMcpTool) {
        errors.push('当前没有“MCP”能力。');
        continue;
      }
      resolved.push(action);
      continue;
    }

    const access = resolveAssistantActionAccess(action, {
      activeProjectId,
      enabledToolGroups,
      toolEnforcementScope,
      themeToolMode,
      availableToolNames,
      desktopLocalHost,
      imageGenerationAvailable,
      memorySearchAvailable,
      attachmentSnapshot,
      imageAssetSnapshot,
      personalData
    });
    if (!access.visible) {
      if (access.promptGroup === 'theme' && activeProjectId) {
        errors.push('当前是工作区对话，界面换肤工具不会在这里执行。要写 CSS，请写入当前工作区的样式文件；要改 Polaris 外观，请离开工作区后再打开换肤工具。');
        continue;
      }
      errors.push(unavailableToolActionError(access.promptGroup));
      continue;
    }

    if (isModelWorkspaceAction(action)) {
      const duplicateWriteTargetError = findDuplicateWriteTargetError({
        action,
        projectFiles,
        activeProjectId
      });
      if (duplicateWriteTargetError) {
        errors.push(duplicateWriteTargetError);
        continue;
      }
    }

    if (isDirectAssistantToolAction(action)) {
      resolved.push(action);
      continue;
    }

    switch (action.kind) {
      case 'listCodeCards': {
        resolved.push({
          kind: 'listCodeCards',
          targetLabel: action.targetLabel
        });
        break;
      }
      case 'patchCodeCard': {
        const targetCard = findCardByTarget(cards, activeCardId, action.target);
        if (!targetCard.ok) {
          errors.push(targetCard.error);
          break;
        }
        resolved.push({
          kind: 'patchCodeCard',
          cardId: targetCard.card.id,
          patch: action.patch,
          targetLabel: action.patch.title?.trim() || action.targetLabel || targetCard.card.title,
          openInCollection: action.openInCollection
        });
        break;
      }
      case 'appendProjectFile': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'appendProjectFile',
            fileId: targetFile.file.id,
            code: action.code,
            targetLabel: formatResolvedTargetLabel(
              targetFile,
              action.targetLabel || targetFile.file.filePath
            ),
            openInCollection: action.openInCollection ?? false
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'insertProjectFile': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'insertProjectFile',
            fileId: targetFile.file.id,
            beforeString: action.beforeString,
            afterString: action.beforeString || action.lineNumber ? undefined : action.afterString,
            lineNumber: action.lineNumber,
            linePosition: action.linePosition,
            code: action.code,
            targetLabel: formatResolvedTargetLabel(
              targetFile,
              action.targetLabel || targetFile.file.filePath
            ),
            openInCollection: action.openInCollection ?? false
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'replaceProjectFileLines': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'replaceProjectFileLines',
            fileId: targetFile.file.id,
            startLine: action.startLine,
            endLine: action.endLine,
            code: action.code,
            targetLabel: formatResolvedTargetLabel(
              targetFile,
              action.targetLabel || targetFile.file.filePath
            ),
            openInCollection: action.openInCollection ?? false
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'writeProjectFiles': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'writeProjectFiles',
          projectId,
          files: action.files.map((file) => ({
            ...file,
            projectId,
            replaceContent: file.replaceContent ?? true
          })),
          targetLabel: action.targetLabel,
          openInCollection: action.openInCollection ?? false
        });
        break;
      }
      case 'patchRoomProject': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectTargetError());
          break;
        }
        resolved.push({
          kind: 'patchRoomProject',
          projectId,
          patch: action.patch,
          targetLabel: action.targetLabel,
          openInCollection: action.openInCollection ?? true
        });
        break;
      }
      case 'listProjectFiles':
      case 'listWorkspaceReferences':
      case 'checkProjectPreview': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: action.kind,
          projectId,
          targetLabel: action.targetLabel
        });
        break;
      }
      case 'searchWorkspaceReferences': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'searchWorkspaceReferences',
          projectId,
          query: action.query,
          maxResults: action.maxResults,
          targetLabel: action.targetLabel
        });
        break;
      }
      case 'readWorkspaceReference': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'readWorkspaceReference',
          projectId,
          docId: action.docId,
          title: action.title,
          targetLabel: action.targetLabel || action.title || action.docId
        });
        break;
      }
      case 'promoteWorkspaceReferenceToProjectFile': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'promoteWorkspaceReferenceToProjectFile',
          projectId,
          docId: action.docId,
          title: action.title,
          filePath: action.filePath,
          fileRole: action.fileRole,
          language: action.language,
          replaceContent: action.replaceContent ?? true,
          targetLabel: action.targetLabel || action.title || action.docId || action.filePath,
          openInCollection: action.openInCollection ?? false
        });
        break;
      }
      case 'pinProjectFileAsReference': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'pinProjectFileAsReference',
            fileId: targetFile.file.id,
            projectId: targetFile.file.projectId,
            title: action.title,
            summary: action.summary,
            targetLabel: formatResolvedTargetLabel(
              targetFile,
              action.targetLabel || action.title || targetFile.file.filePath
            ),
            openInCollection: action.openInCollection ?? false
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'inspectProjectRuntime': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'inspectProjectRuntime',
          projectId,
          settleMs: action.settleMs,
          targetLabel: action.targetLabel
        });
        break;
      }
      case 'searchProjectFiles': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'searchProjectFiles',
          projectId,
          query: action.query,
          maxResults: action.maxResults,
          targetLabel: action.targetLabel
        });
        break;
      }
      case 'readWorkspacePreviewState': {
        const projectId = activeProjectId?.trim() || '';
        if (!projectId) {
          errors.push(buildMissingProjectFileTargetError());
          break;
        }
        resolved.push({
          kind: 'readWorkspacePreviewState',
          projectId,
          targetLabel: action.targetLabel
        });
        break;
      }
      case 'appendCodeCard': {
        const targetCard = findCardByTarget(cards, activeCardId, action.target);
        if (!targetCard.ok) {
          errors.push(targetCard.error);
          break;
        }
        resolved.push({
          kind: 'appendCodeCard',
          cardId: targetCard.card.id,
          code: action.code,
          targetLabel: formatResolvedTargetLabel(
            targetCard,
            action.targetLabel || targetCard.card.title
          ),
          openInCollection: action.openInCollection ?? true
        });
        break;
      }
      case 'editProjectFileText': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'editProjectFileText',
            fileId: targetFile.file.id,
            oldString: action.oldString,
            newString: action.newString,
            targetLabel: formatResolvedTargetLabel(
              targetFile,
              action.targetLabel || targetFile.file.filePath
            ),
            openInCollection: action.openInCollection ?? false
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'deleteProjectFile': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'deleteProjectFile',
            fileId: targetFile.file.id,
            targetLabel: formatResolvedTargetLabel(
              targetFile,
              action.targetLabel || targetFile.file.filePath
            ),
            openInCollection: action.openInCollection ?? false
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'editCodeCardText': {
        const targetCard = findCardByTarget(cards, activeCardId, action.target);
        if (!targetCard.ok) {
          errors.push(targetCard.error);
          break;
        }
        resolved.push({
          kind: 'editCodeCardText',
          cardId: targetCard.card.id,
          oldString: action.oldString,
          newString: action.newString,
          targetLabel: formatResolvedTargetLabel(
            targetCard,
            action.targetLabel || targetCard.card.title
          ),
          openInCollection: action.openInCollection ?? true
        });
        break;
      }
      case 'readProjectFile': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'readProjectFile',
            fileId: targetFile.file.id,
            targetLabel: action.targetLabel || targetFile.file.filePath
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'readProjectFileContext': {
        const targetFile = findProjectFileByProjectPath(
          projectFiles,
          projectScopes,
          action.projectId,
          action.filePath,
          activeProjectId
        )
          ?? findProjectFileByTarget(projectFiles, action.target, activeProjectId);
        if (targetFile?.ok) {
          resolved.push({
            kind: 'readProjectFileContext',
            fileId: targetFile.file.id,
            query: action.query,
            lineNumber: action.lineNumber,
            before: action.before,
            after: action.after,
            occurrence: action.occurrence,
            targetLabel: action.targetLabel || targetFile.file.filePath
          });
          break;
        }
        errors.push(targetFile && !targetFile.ok ? targetFile.error : buildMissingProjectFileTargetError());
        break;
      }
      case 'readCodeCard': {
        const targetCard = findCardByTarget(cards, activeCardId, action.target);
        if (!targetCard.ok) {
          errors.push(targetCard.error);
          break;
        }
        resolved.push({
          kind: 'readCodeCard',
          cardId: targetCard.card.id,
          targetLabel: action.targetLabel || targetCard.card.title
        });
        break;
      }
      default:
        assertNeverToolAction(action, 'assistant tool action');
    }
  }

  return { resolved, errors };
}

function argsIncludesToolName(availableToolNames: ReadonlySet<string> | undefined, toolName: string) {
  return availableToolNames ? availableToolNames.has(toolName) : true;
}

export function resolveNativeToolCardActions(args: {
  toolCalls: ChatNativeToolCall[];
  cards: CodeCard[];
  enabledToolGroups?: PolarisToolPromptPreferences;
  toolEnforcementScope?: AssistantToolEnforcementScope;
  availableToolNames?: ReadonlySet<string>;
}): {
  resolved: ToolAction[];
  errors: string[];
} {
  const toolCardsByFunctionName = new Map(
    args.cards
      .filter((card) => isRunnableToolCodeCard(card))
      .map((card) => [buildToolCardFunctionName(card), card] as const)
  );
  const roomToolsVisible = isPolarisToolPromptGroupEnabled(
    args.enabledToolGroups,
    'room',
    args.toolEnforcementScope
  );

  const resolved: ToolAction[] = [];
  const errors: string[] = [];

  for (const toolCall of args.toolCalls) {
    const toolName = toolCall.name.trim();
    if (args.availableToolNames && !args.availableToolNames.has(toolName)) continue;
    const card = toolCardsByFunctionName.get(toolName);
    if (!card) continue;
    if (!roomToolsVisible) {
      errors.push(unavailableToolActionError('room'));
      continue;
    }

    try {
      const payload = parseToolCardPayload(toolCall.argumentsText);
      resolved.push({
        kind: 'invokeCodeCardTool',
        cardId: card.id,
        toolName,
        input: payload.input,
        args: payload.args,
        targetLabel: payload.targetLabel || card.title
      });
    } catch (error) {
      errors.push(
        `房间工具《${card.title}》参数解析失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  return {
    resolved,
    errors
  };
}

export function resolveNativeMcpToolActions(args: {
  toolCalls: ChatNativeToolCall[];
  mcpTools?: McpResolvedToolDefinition[];
  availableToolNames?: ReadonlySet<string>;
}): {
  resolved: ToolAction[];
  errors: string[];
} {
  const mcpToolsBySchemaName = new Map(
    (args.mcpTools ?? []).map((tool) => [tool.schemaName, tool] as const)
  );
  const resolved: ToolAction[] = [];
  const errors: string[] = [];

  for (const toolCall of args.toolCalls) {
    const toolName = toolCall.name.trim();
    if (args.availableToolNames && !args.availableToolNames.has(toolName)) continue;
    const tool = mcpToolsBySchemaName.get(toolName);
    if (!tool) continue;

    try {
      resolved.push({
        kind: 'invokeMcpTool',
        serverId: tool.serverId,
        serverName: tool.serverName,
        schemaName: tool.schemaName,
        toolName: tool.toolName,
        argumentsObject: parseNativeArgumentsObject(toolCall.argumentsText),
        targetLabel: `${tool.serverName} / ${tool.toolName}`
      });
    } catch (error) {
      errors.push(
        `MCP 工具「${tool.serverName} / ${tool.toolName}」参数解析失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  return {
    resolved,
    errors
  };
}
