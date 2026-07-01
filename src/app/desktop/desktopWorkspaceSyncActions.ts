import { inferManualProjectFileRole } from '../collection/projectWorkspaceCreation';
import { normalizeCodeCardFilePath } from '../../engines/roomProjects';
import { useCollectionStore } from '../../stores/collectionStore';
import type { DesktopLocalHostBridge, DesktopLocalWorkspaceFileSnapshot } from '../../desktop/localHost';
import type { ProjectFile, RoomProject } from '../../types/domain';
import {
  buildDesktopWorkspaceFileSyncMap,
  buildDesktopWorkspaceManifestContent,
  createDesktopWorkspaceFileSyncEntry,
  DESKTOP_WORKSPACE_MANIFEST_PATH,
  inferDesktopWorkspaceFileLanguage,
  planDesktopWorkspaceDiskImport,
  planDesktopWorkspaceDiskWrite,
  type DesktopWorkspaceSyncPlanIssue
} from './desktopWorkspaceBinding';

export type DesktopWorkspaceSyncDirection = 'from-disk' | 'to-disk';

export type DesktopWorkspaceSyncConfirmationRequest = {
  direction: DesktopWorkspaceSyncDirection;
  changedFiles: string[];
  issues: DesktopWorkspaceSyncPlanIssue[];
};

export type DesktopWorkspaceSyncResult = {
  status: 'synced' | 'cancelled';
  direction: DesktopWorkspaceSyncDirection;
  projectId: string;
  rootId: string;
  rootLabel: string;
  changedFileCount: number;
  issueCount: number;
  syncedAt?: number;
};

export type DesktopWorkspaceChangeStatus = {
  projectId: string;
  rootId: string;
  rootLabel: string;
  diskChangedFiles: string[];
  polarisChangedFiles: string[];
  conflictFiles: string[];
  overwriteFiles: string[];
  checkedAt: number;
};

type DesktopWorkspaceSyncArgs = {
  bridge: DesktopLocalHostBridge | null;
  projectId: string;
  confirmPlan?: (request: DesktopWorkspaceSyncConfirmationRequest) => boolean | Promise<boolean>;
};

function resolveBoundDesktopProject(projectId: string): RoomProject {
  const project = useCollectionStore.getState().roomProjects.find((candidate) => candidate.id === projectId);
  if (!project?.desktopBinding) {
    throw new Error('这个工作区还没有绑定本机文件夹。');
  }
  return project;
}

async function confirmSyncPlan(
  direction: DesktopWorkspaceSyncDirection,
  changedFiles: string[],
  issues: DesktopWorkspaceSyncPlanIssue[],
  confirmPlan: DesktopWorkspaceSyncArgs['confirmPlan']
) {
  if (changedFiles.length === 0 || issues.length === 0) return true;
  if (!confirmPlan) return false;
  return Boolean(await confirmPlan({ direction, changedFiles, issues }));
}

function upsertProjectFileFromDisk(args: {
  project: RoomProject;
  file: DesktopLocalWorkspaceFileSnapshot;
}) {
  const normalizedPath = normalizeCodeCardFilePath(args.file.relativePath);
  if (!normalizedPath) return null;
  const language = inferDesktopWorkspaceFileLanguage(normalizedPath, args.file.content);
  const fileRole = inferManualProjectFileRole(normalizedPath, language);
  const collection = useCollectionStore.getState();
  const currentFile = collection.projectFiles.find((candidate) =>
    candidate.projectId === args.project.id
    && normalizeCodeCardFilePath(candidate.filePath) === normalizedPath
  );

  if (currentFile) {
    if (
      currentFile.content !== args.file.content
      || currentFile.fileRole !== fileRole
      || currentFile.language !== language
    ) {
      collection.updateProjectFile(currentFile.id, {
        fileRole,
        language,
        content: args.file.content
      });
    }
    return currentFile.id;
  }

  return collection.createProjectFile({
    projectId: args.project.id,
    filePath: normalizedPath,
    fileRole,
    language,
    content: args.file.content,
    ownerCollaboratorId: args.project.ownerCollaboratorId,
    source: 'manual'
  });
}

function buildProjectFileByPath(files: ProjectFile[]) {
  return new Map(
    files.flatMap((file) => {
      const path = normalizeCodeCardFilePath(file.filePath);
      return path ? [[path, file] as const] : [];
    })
  );
}

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths));
}

export async function syncDesktopProjectFromDisk({
  bridge,
  projectId,
  confirmPlan
}: DesktopWorkspaceSyncArgs): Promise<DesktopWorkspaceSyncResult> {
  if (!bridge) {
    throw new Error('当前不是官网 Mac 桌面宿主。');
  }
  const project = resolveBoundDesktopProject(projectId);
  const binding = project.desktopBinding!;
  const diskSnapshot = await bridge.readWorkspaceFiles({ rootId: binding.rootId });
  const projectFilesBeforeSync = useCollectionStore.getState().projectFiles.filter((file) => file.projectId === project.id);
  const plan = planDesktopWorkspaceDiskImport({
    diskFiles: diskSnapshot.files,
    projectFiles: projectFilesBeforeSync,
    fileSync: binding.fileSync
  });
  const confirmed = await confirmSyncPlan('from-disk', plan.changedFiles, plan.issues, confirmPlan);
  if (!confirmed) {
    return {
      status: 'cancelled',
      direction: 'from-disk',
      projectId: project.id,
      rootId: binding.rootId,
      rootLabel: binding.rootLabel,
      changedFileCount: plan.changedFiles.length,
      issueCount: plan.issues.length
    };
  }

  const syncedAt = Date.now();
  let entryFileId = project.entryFileId;
  for (const file of diskSnapshot.files) {
    const fileId = upsertProjectFileFromDisk({ project, file });
    if (!fileId) continue;
    if (normalizeCodeCardFilePath(file.relativePath) === binding.entryFilePath) {
      entryFileId = fileId;
    }
  }

  const projectFilesAfterSync = useCollectionStore.getState().projectFiles.filter((file) => file.projectId === project.id);
  const projectFileByPath = buildProjectFileByPath(projectFilesAfterSync);
  const fileSyncEntries = diskSnapshot.files.flatMap((file) => {
    const path = normalizeCodeCardFilePath(file.relativePath);
    const projectFile = path ? projectFileByPath.get(path) : null;
    const entry = projectFile ? createDesktopWorkspaceFileSyncEntry({
      relativePath: file.relativePath,
      diskContent: file.content,
      polarisContent: projectFile.content,
      diskUpdatedAt: file.updatedAt,
      polarisUpdatedAt: projectFile.updatedAt,
      syncedAt
    }) : null;
    return entry ? [entry] : [];
  });

  useCollectionStore.getState().updateProject(project.id, {
    entryFileId,
    desktopBinding: {
      ...binding,
      syncedAt,
      fileSync: {
        ...(binding.fileSync ?? {}),
        ...buildDesktopWorkspaceFileSyncMap(fileSyncEntries)
      }
    }
  });

  return {
    status: 'synced',
    direction: 'from-disk',
    projectId: project.id,
    rootId: binding.rootId,
    rootLabel: binding.rootLabel,
    changedFileCount: plan.changedFiles.length,
    issueCount: plan.issues.length,
    syncedAt
  };
}

export async function inspectDesktopProjectChanges({
  bridge,
  projectId
}: Pick<DesktopWorkspaceSyncArgs, 'bridge' | 'projectId'>): Promise<DesktopWorkspaceChangeStatus> {
  if (!bridge) {
    throw new Error('当前不是官网 Mac 桌面宿主。');
  }
  const project = resolveBoundDesktopProject(projectId);
  const binding = project.desktopBinding!;
  const projectFiles = useCollectionStore.getState().projectFiles.filter((file) => file.projectId === project.id);
  const diskSnapshot = await bridge.readWorkspaceFiles({ rootId: binding.rootId });
  const importPlan = planDesktopWorkspaceDiskImport({
    diskFiles: diskSnapshot.files,
    projectFiles,
    fileSync: binding.fileSync
  });
  const writePlan = planDesktopWorkspaceDiskWrite({
    diskFiles: diskSnapshot.files,
    projectFiles,
    fileSync: binding.fileSync
  });
  const allIssues = [...importPlan.issues, ...writePlan.issues];

  return {
    projectId: project.id,
    rootId: binding.rootId,
    rootLabel: binding.rootLabel,
    diskChangedFiles: uniquePaths(importPlan.changedFiles),
    polarisChangedFiles: uniquePaths(writePlan.changedFiles),
    conflictFiles: uniquePaths(allIssues.filter((issue) => issue.kind === 'conflict').map((issue) => issue.path)),
    overwriteFiles: uniquePaths(allIssues.filter((issue) => issue.kind === 'overwrite').map((issue) => issue.path)),
    checkedAt: Date.now()
  };
}

export async function syncDesktopProjectToDisk({
  bridge,
  projectId,
  confirmPlan
}: DesktopWorkspaceSyncArgs): Promise<DesktopWorkspaceSyncResult> {
  if (!bridge) {
    throw new Error('当前不是官网 Mac 桌面宿主。');
  }
  const project = resolveBoundDesktopProject(projectId);
  const binding = project.desktopBinding!;
  const projectFiles = useCollectionStore.getState().projectFiles.filter((file) => file.projectId === project.id);
  const files = projectFiles.flatMap((file) => {
    const relativePath = normalizeCodeCardFilePath(file.filePath);
    return relativePath && relativePath !== DESKTOP_WORKSPACE_MANIFEST_PATH && !relativePath.startsWith('.polaris/')
      ? [{ relativePath, content: file.content }]
      : [];
  });
  const diskSnapshot = await bridge.readWorkspaceFiles({ rootId: binding.rootId });
  const plan = planDesktopWorkspaceDiskWrite({
    diskFiles: diskSnapshot.files,
    projectFiles,
    fileSync: binding.fileSync
  });
  const confirmed = await confirmSyncPlan('to-disk', plan.changedFiles, plan.issues, confirmPlan);
  if (!confirmed) {
    return {
      status: 'cancelled',
      direction: 'to-disk',
      projectId: project.id,
      rootId: binding.rootId,
      rootLabel: binding.rootLabel,
      changedFileCount: plan.changedFiles.length,
      issueCount: plan.issues.length
    };
  }

  const syncedAt = Date.now();
  const result = await bridge.writeWorkspaceFiles({
    rootId: binding.rootId,
    files: [
      ...files,
      {
        relativePath: DESKTOP_WORKSPACE_MANIFEST_PATH,
        content: buildDesktopWorkspaceManifestContent({
          projectId: project.id,
          title: project.title,
          entryFilePath: binding.entryFilePath,
          updatedAt: syncedAt
        })
      }
    ]
  });
  const projectFileByPath = buildProjectFileByPath(projectFiles);
  const fileSyncEntries = result.writtenFiles.flatMap((file) => {
    if (file.relativePath === DESKTOP_WORKSPACE_MANIFEST_PATH || file.relativePath.startsWith('.polaris/')) return [];
    const projectFile = projectFileByPath.get(file.relativePath);
    const entry = projectFile ? createDesktopWorkspaceFileSyncEntry({
      relativePath: file.relativePath,
      diskContent: projectFile.content,
      polarisContent: projectFile.content,
      diskUpdatedAt: syncedAt,
      polarisUpdatedAt: projectFile.updatedAt,
      syncedAt
    }) : null;
    return entry ? [entry] : [];
  });

  useCollectionStore.getState().updateProject(project.id, {
    desktopBinding: {
      ...binding,
      syncedAt,
      fileSync: {
        ...(binding.fileSync ?? {}),
        ...buildDesktopWorkspaceFileSyncMap(fileSyncEntries)
      }
    }
  });

  return {
    status: 'synced',
    direction: 'to-disk',
    projectId: project.id,
    rootId: binding.rootId,
    rootLabel: binding.rootLabel,
    changedFileCount: plan.changedFiles.length,
    issueCount: plan.issues.length,
    syncedAt
  };
}
