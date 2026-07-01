import { createRoomProject, normalizeRoomProject, sortRoomProjects } from '../engines/roomProjects';
import type { ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../types/domain';
import { normalizeProjectFile, sortProjectFiles } from './collectionStoreProjectFiles';
import {
  normalizeWorkspaceReferenceDoc,
  sortWorkspaceReferenceDocs
} from './collectionStoreWorkspaceReferences';

type CollectionProjectTopology = {
  roomProjects: RoomProject[];
  projectFiles: ProjectFile[];
  workspaceReferenceDocs: WorkspaceReferenceDoc[];
};

function readTime(value: number | undefined) {
  return typeof value === 'number' ? value : Date.now();
}

function deriveRecoveredProjectTitle(projectId: string) {
  const trimmed = projectId.trim();
  return trimmed ? `恢复的工作区 ${trimmed}` : '恢复的工作区';
}

function selectOwnerCollaboratorId(items: Array<ProjectFile | WorkspaceReferenceDoc>) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    if (!item.ownerCollaboratorId) return;
    counts.set(item.ownerCollaboratorId, (counts.get(item.ownerCollaboratorId) ?? 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
}

function selectEntryFileId(files: ProjectFile[]) {
  return files.find((file) => file.fileRole === 'entry')?.id ?? files[0]?.id;
}

function createRecoveredRoomProject(projectId: string, files: ProjectFile[], docs: WorkspaceReferenceDoc[]) {
  const timestamps = [...files, ...docs].flatMap((item) => [readTime(item.createdAt), readTime(item.updatedAt)]);
  const createdAt = Math.min(...timestamps);
  const updatedAt = Math.max(...timestamps);

  return createRoomProject({
    id: projectId,
    title: deriveRecoveredProjectTitle(projectId),
    ownerCollaboratorId: selectOwnerCollaboratorId([...files, ...docs]),
    entryFileId: selectEntryFileId(files),
    fileIds: files.map((file) => file.id),
    tags: ['恢复'],
    source: 'imported',
    createdAt,
    updatedAt
  });
}

export function repairCollectionProjectTopology<T extends CollectionProjectTopology>(args: T): T {
  const roomProjects = args.roomProjects.map((project) => normalizeRoomProject(project));
  const projectFiles = args.projectFiles.map((file) => normalizeProjectFile(file));
  const workspaceReferenceDocs = args.workspaceReferenceDocs
    .map((doc) => normalizeWorkspaceReferenceDoc(doc))
    .filter((doc) => doc.projectId);
  const projectIds = new Set(roomProjects.map((project) => project.id));
  const missingProjectIds = new Set<string>();

  projectFiles.forEach((file) => {
    if (!projectIds.has(file.projectId)) missingProjectIds.add(file.projectId);
  });
  workspaceReferenceDocs.forEach((doc) => {
    if (!projectIds.has(doc.projectId)) missingProjectIds.add(doc.projectId);
  });

  const recoveredProjects = [...missingProjectIds].map((projectId) => createRecoveredRoomProject(
    projectId,
    projectFiles.filter((file) => file.projectId === projectId),
    workspaceReferenceDocs.filter((doc) => doc.projectId === projectId)
  ));

  return {
    ...args,
    roomProjects: sortRoomProjects([...recoveredProjects, ...roomProjects]),
    projectFiles: sortProjectFiles(projectFiles),
    workspaceReferenceDocs: sortWorkspaceReferenceDocs(workspaceReferenceDocs)
  };
}
