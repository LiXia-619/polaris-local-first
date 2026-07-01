import type { ChatMessage, ConversationTaskState, ToolInvocation } from '../types/domain';
import { buildConversationTaskWorkbench } from './conversationTaskWorkbench';
import { resolveConversationTaskMode } from './conversationTask';
import type { RuntimeFeedbackEvent } from './runtime-feedback/runtimeFeedbackEvents';
import type { RoomProjectTreeSnapshot } from './roomProjects';
import {
  resolveWorkspaceProposalIntent,
  resolveWorkspaceProposalLabel,
  type PendingWorkspaceProposal
} from './workspaceBinding';

export type WorkContextProjection = {
  taskLines: string[];
  workspaceLines: string[];
  feedbackLines: string[];
  lines: string[];
  hasActiveTask: boolean;
};

export type BuildWorkContextArgs = {
  currentTask?: ConversationTaskState | null;
  messages: ChatMessage[];
  activeProject?: RoomProjectTreeSnapshot | null;
  visibleProjects?: RoomProjectTreeSnapshot[];
  runtimeFeedback?: {
    pendingWorkspaceProposal?: PendingWorkspaceProposal | null;
    events?: RuntimeFeedbackEvent[];
  };
};

type WorkspaceFileFrame = {
  fileId: string;
  filePath: string;
  projectId: string;
  language?: string;
  fileRole?: string;
  updatedAt?: number;
};

type WorkspaceOpenLoopProjection = {
  title: string;
  fileCount: number;
  entryFilePath?: string | null;
};

type WorkspaceLabelProjection = {
  id: string;
  title: string;
};

const WORKSPACE_WRITE_ACTIONS = new Set<ToolInvocation['kind']>([
  'createRoomProject',
  'createProjectFile',
  'writeProjectFiles',
  'promoteCardToProject',
  'appendProjectFile',
  'insertProjectFile',
  'replaceProjectFileLines',
  'editProjectFileText',
  'deleteProjectFile'
]);

const WORKSPACE_DIAGNOSTIC_ACTIONS = new Set<ToolInvocation['kind']>([
  'checkProjectPreview',
  'inspectProjectRuntime'
]);

const MAX_RECENT_RUNTIME_FEEDBACK_ITEMS = 4;
const MAX_WORKSPACE_LOOP_LINE_CHARS = 180;

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const normalized = line.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function summarizeRecentPaths(paths: string[]) {
  if (paths.length === 0) return '';
  if (paths.length === 1) return paths[0]!;
  if (paths.length === 2) return `${paths[0]}、${paths[1]}`;
  return `${paths[0]}、${paths[1]}、${paths[2]}`;
}

function summarizeWorkspaceLoopText(value: string | undefined | null) {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!normalized) return '';
  return normalized.length > MAX_WORKSPACE_LOOP_LINE_CHARS
    ? `${normalized.slice(0, MAX_WORKSPACE_LOOP_LINE_CHARS - 3)}...`
    : normalized;
}

function isSettledWorkspaceTool(invocation: ToolInvocation) {
  return invocation.status === 'executed' || invocation.status === 'saved' || invocation.status === 'applied';
}

function buildFileFrameLookup(activeProject: RoomProjectTreeSnapshot) {
  return new Map(
    activeProject.files.map((file) => [
      file.fileId,
      {
        fileId: file.fileId,
        filePath: file.path,
        projectId: activeProject.id,
        language: file.language,
        fileRole: file.role
      } satisfies WorkspaceFileFrame
    ])
  );
}

function collectWorkspaceFramesFromMessages(args: {
  activeProject: RoomProjectTreeSnapshot;
  messages: ChatMessage[];
}) {
  const { activeProject, messages } = args;
  const fileFramesById = buildFileFrameLookup(activeProject);
  const recentWrittenFiles: WorkspaceFileFrame[] = [];
  let latestWriteAt = 0;
  let latestDiagnostic: {
    invocation: ToolInvocation;
    diagnostic: NonNullable<ToolInvocation['projectDiagnostics']>[number] | null;
    timestamp: number;
  } | null = null;

  for (const message of messages) {
    const invocation = message.toolInvocation;
    if (!invocation || !isSettledWorkspaceTool(invocation)) {
      continue;
    }

    if (WORKSPACE_DIAGNOSTIC_ACTIONS.has(invocation.kind)) {
      const diagnostic =
        invocation.projectDiagnostics?.find((entry) => entry.projectId === activeProject.id) ?? null;
      latestDiagnostic = {
        invocation,
        diagnostic,
        timestamp: message.timestamp
      };
      continue;
    }

    if (!WORKSPACE_WRITE_ACTIONS.has(invocation.kind)) continue;

    latestWriteAt = Math.max(latestWriteAt, message.timestamp);

    const writtenFileIds =
      invocation.projectFileIds?.length
        ? invocation.projectFileIds
        : invocation.projectFileId
          ? [invocation.projectFileId]
          : [];
    const recordedPaths = new Set<string>();

    for (const fileId of writtenFileIds) {
      const frame = fileFramesById.get(fileId);
      if (frame) {
        recordedPaths.add(frame.filePath);
        recentWrittenFiles.push({
          ...frame,
          updatedAt: message.timestamp
        });
      }
    }

    for (const filePath of invocation.projectFilePaths ?? []) {
      if (!filePath || recordedPaths.has(filePath)) continue;
      recentWrittenFiles.push({
        fileId: `${invocation.id}:${filePath}`,
        filePath,
        projectId: activeProject.id,
        updatedAt: message.timestamp
      });
    }
  }

  return {
    recentWrittenFiles,
    latestWriteAt,
    latestDiagnostic
  };
}

function collectRecentPaths(files: WorkspaceFileFrame[], activeProjectId: string) {
  return files
    .filter((file) => file.projectId === activeProjectId)
    .map((file) => file.filePath)
    .reverse()
    .filter((path, index, values) => values.indexOf(path) === index)
    .slice(0, 3);
}

function buildWorkspaceLines(args: {
  activeProject?: RoomProjectTreeSnapshot | null;
  messages: ChatMessage[];
}) {
  const activeProject = args.activeProject ?? null;
  if (!activeProject) {
    return [];
  }

  const messageFrames = collectWorkspaceFramesFromMessages({
    activeProject,
    messages: args.messages
  });
  const recentWrittenPaths = collectRecentPaths(messageFrames.recentWrittenFiles, activeProject.id);

  const lines: string[] = [];
  if (recentWrittenPaths.length > 0) {
    lines.push(`最近刚改过：${summarizeRecentPaths(recentWrittenPaths)}`);
  }
  lines.push(...buildWorkspaceLoopLines({
    latestDiagnostic: messageFrames.latestDiagnostic,
    latestWriteAt: messageFrames.latestWriteAt,
    recentWrittenPaths
  }));

  return lines;
}

function formatDiagnosticLocation(
  diagnostic: NonNullable<ToolInvocation['projectDiagnostics']>[number]
) {
  const filePath = diagnostic.firstErrorFilePath ?? diagnostic.entryFilePath ?? '';
  if (!filePath) return '';
  return typeof diagnostic.firstErrorLineNumber === 'number'
    ? `${filePath}:${diagnostic.firstErrorLineNumber}`
    : filePath;
}

function buildPassedDiagnosticLine(
  diagnostic: NonNullable<ToolInvocation['projectDiagnostics']>[number]
) {
  const label = diagnostic.tool === 'inspectProjectRuntime' ? '运行检查通过' : '预览检查通过';
  const parts = [
    diagnostic.entryFilePath ? `入口 ${diagnostic.entryFilePath}` : '',
    typeof diagnostic.visibleElementCount === 'number' ? `可见节点 ${diagnostic.visibleElementCount} 个` : ''
  ].filter(Boolean);
  return parts.length ? `最近${label}：${parts.join(' · ')}。` : `最近${label}。`;
}

function buildFailedDiagnosticLine(
  diagnostic: NonNullable<ToolInvocation['projectDiagnostics']>[number]
) {
  const label = diagnostic.tool === 'inspectProjectRuntime' ? '运行检查未过' : '预览检查未过';
  const location = formatDiagnosticLocation(diagnostic);
  const issue = summarizeWorkspaceLoopText(diagnostic.firstErrorMessage)
    || (diagnostic.reason === 'missing-entry' || diagnostic.reason === 'not-runnable'
      ? '没有可运行入口'
      : diagnostic.reason ?? '需要继续检查');
  const parts = [
    diagnostic.reason ?? '',
    location,
    issue
  ].filter(Boolean);
  return `最近${label}：${parts.join(' · ')}。`;
}

function buildWorkspaceLoopLines(args: {
  latestDiagnostic: {
    invocation: ToolInvocation;
    diagnostic: NonNullable<ToolInvocation['projectDiagnostics']>[number] | null;
    timestamp: number;
  } | null;
  latestWriteAt: number;
  recentWrittenPaths: string[];
}) {
  const { latestDiagnostic, latestWriteAt, recentWrittenPaths } = args;
  if (!latestDiagnostic) {
    return recentWrittenPaths.length > 0
      ? ['工作台状态：最近修改未验证。']
      : [];
  }

  if (latestWriteAt > latestDiagnostic.timestamp) {
    return ['工作台状态：上次检查早于最近修改，诊断已过期。'];
  }

  if (!latestDiagnostic.diagnostic) {
    return latestDiagnostic.invocation.status === 'failed'
      ? [`最近检查失败：${summarizeWorkspaceLoopText(latestDiagnostic.invocation.error ?? latestDiagnostic.invocation.summary) || '没有可用诊断证据'}。`]
      : [];
  }

  return latestDiagnostic.diagnostic.reason === 'ok' && latestDiagnostic.diagnostic.runnable
    ? [buildPassedDiagnosticLine(latestDiagnostic.diagnostic)]
    : [buildFailedDiagnosticLine(latestDiagnostic.diagnostic)];
}

function normalizeRuntimeFeedbackLine(content: string) {
  const normalized = content
    .replace(/\s+/g, ' ')
    .replace(/^\[工具结果：[^\]]+\]\s*/u, '')
    .trim();
  if (!normalized) return null;
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function buildPendingWorkspaceProposalRuntimeLines(args: BuildWorkContextArgs) {
  return buildPendingWorkspaceProposalLines({
    proposal: args.runtimeFeedback?.pendingWorkspaceProposal,
    currentProjectId: args.activeProject?.id ?? null
  });
}

function formatRuntimeFeedbackEventLine(event: RuntimeFeedbackEvent) {
  if (event.kind === 'assistant_tool_preparation_failed') {
    const detailParts: string[] = [];

    if (event.truncated) {
      detailParts.push('疑似尾部截断。');
    }
    if ((event.reasons?.length ?? 0) > 0) {
      detailParts.push(`原因：${event.reasons?.join('；')}`);
    }
    if ((event.declaredActionKinds?.length ?? 0) > 0) {
      detailParts.push(`声明动作：${event.declaredActionKinds?.join('、')}。`);
    }
    if ((event.resolvedActionKinds?.length ?? 0) > 0) {
      detailParts.push(`已解析动作：${event.resolvedActionKinds?.join('、')}。`);
    }

    return detailParts.length > 0
      ? `${event.summary} ${detailParts.join(' ')}`
      : event.summary;
  }

  return event.summary;
}

function buildRecentRuntimeEventLines(args: BuildWorkContextArgs) {
  const events = args.runtimeFeedback?.events ?? [];
  if (events.length === 0) return [];
  const workspaceScopeEvents = events.filter((event) => event.kind === 'workspace_scope_changed');
  const workspaceScopeLine = buildWorkspaceScopeStateLine({
    events: workspaceScopeEvents,
    activeProject: args.activeProject,
    visibleProjects: args.visibleProjects
  });

  const recentEventLines = events
    .filter((event) => event.kind !== 'workspace_scope_changed')
    .slice(-MAX_RECENT_RUNTIME_FEEDBACK_ITEMS)
    .map((event) => formatRuntimeFeedbackEventLine(event))
    .filter((line): line is string => Boolean(line));

  return [
    ...(workspaceScopeLine ? [workspaceScopeLine] : []),
    ...recentEventLines
  ];
}

function buildRuntimeFeedbackLines(args: BuildWorkContextArgs) {
  const seen = new Set<string>();
  const lines = [
    ...buildPendingWorkspaceProposalRuntimeLines(args),
    ...buildWorkspaceOpenLoopLines(args.activeProject),
    ...buildRecentRuntimeEventLines(args)
  ];

  return lines.filter((line) => {
    const normalized = normalizeRuntimeFeedbackLine(line);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function buildWorkspaceOpenLoopLines(project: WorkspaceOpenLoopProjection | null | undefined): string[] {
  if (!project) return [];

  if (project.fileCount === 0) {
    return [`当前工作区“${project.title}”还没有文件。`];
  }

  if (!project.entryFilePath) {
    return [`当前工作区“${project.title}”已有 ${project.fileCount} 个文件，但还没有可运行入口。`];
  }

  return [];
}

function buildPendingWorkspaceProposalLines(args: {
  proposal: PendingWorkspaceProposal | null | undefined;
  currentProjectId?: string | null;
}): string[] {
  const { proposal } = args;
  if (!proposal || proposal.status !== 'pending') return [];
  const intent = resolveWorkspaceProposalIntent({
    proposal,
    currentProjectId: args.currentProjectId ?? null
  });

  const lines = [
    intent === 'create'
      ? `当前对话还没进入工作区；现在有一个待确认的新工作区提议：${resolveWorkspaceProposalLabel(proposal)}。`
      : `当前对话还没进入工作区；现在有一个待确认的工作区进入提议：${resolveWorkspaceProposalLabel(proposal)}。`,
    `这些项目动作还没执行，仍在等待用户确认。`
  ];

  if ((proposal.requestedFilePaths?.length ?? 0) > 0) {
    lines.push(`提议涉及文件：${proposal.requestedFilePaths?.slice(0, 4).join('、')}。`);
  }

  return lines;
}

function resolveWorkspaceLabel(args: {
  projectId: string | null;
  activeProject?: WorkspaceLabelProjection | null;
  visibleProjects?: WorkspaceLabelProjection[];
}) {
  if (!args.projectId) return null;

  if (args.activeProject?.id === args.projectId) {
    return args.activeProject.title;
  }

  const visibleProject = args.visibleProjects?.find((project) => project.id === args.projectId) ?? null;
  return visibleProject?.title ?? null;
}

function buildWorkspaceScopeStateLine(args: {
  events: Array<Extract<RuntimeFeedbackEvent, { kind: 'workspace_scope_changed' }>>;
  activeProject?: WorkspaceLabelProjection | null;
  visibleProjects?: WorkspaceLabelProjection[];
}) {
  if (args.events.length === 0) return null;

  const orderedEvents = [...args.events].sort((left, right) => left.createdAt - right.createdAt);
  const latestEvent = orderedEvents[orderedEvents.length - 1];
  const currentProjectId =
    args.activeProject?.id
    ?? (
      latestEvent?.change === 'exited'
        ? null
        : latestEvent?.nextProjectId ?? null
    );
  const visitedProjectIds = orderedEvents.reduce<string[]>((ids, event) => {
    [event.previousProjectId, event.nextProjectId].forEach((projectId) => {
      if (projectId && !ids.includes(projectId)) {
        ids.push(projectId);
      }
    });
    return ids;
  }, []);
  if (currentProjectId && !visitedProjectIds.includes(currentProjectId)) {
    visitedProjectIds.push(currentProjectId);
  }

  const otherVisitedLabels = visitedProjectIds
    .filter((projectId) => projectId !== currentProjectId)
    .map((projectId) => resolveWorkspaceLabel({
      projectId,
      activeProject: args.activeProject,
      visibleProjects: args.visibleProjects
    }) ?? projectId);

  if (!currentProjectId) {
    if (otherVisitedLabels.length === 0) {
      return '当前对话不在工作区。';
    }
    return `当前对话不在工作区；本次对话曾访问：${otherVisitedLabels.join('、')}。`;
  }

  const currentProjectLabel = resolveWorkspaceLabel({
    projectId: currentProjectId,
    activeProject: args.activeProject,
    visibleProjects: args.visibleProjects
  }) ?? currentProjectId;

  if (otherVisitedLabels.length === 0) {
    return `当前工作区：${currentProjectLabel}。`;
  }

  return `当前工作区：${currentProjectLabel}；本次对话还访问过：${otherVisitedLabels.join('、')}。`;
}

export function buildWorkContext(args: BuildWorkContextArgs): WorkContextProjection {
  const hasActiveTask = Boolean(args.currentTask && resolveConversationTaskMode(args.currentTask) === 'active');
  const taskLines = args.currentTask
    ? buildConversationTaskWorkbench({
        currentTask: args.currentTask,
        messages: args.messages
      }).lines
    : [];
  const workspaceLines = buildWorkspaceLines({
    activeProject: args.activeProject,
    messages: args.messages
  });
  const feedbackLines = buildRuntimeFeedbackLines(args);

  return {
    taskLines: uniqueLines(taskLines),
    workspaceLines: uniqueLines(workspaceLines),
    feedbackLines: uniqueLines(feedbackLines),
    lines: uniqueLines([
      ...taskLines,
      ...workspaceLines,
      ...feedbackLines
    ]),
    hasActiveTask
  };
}
