import type { ProjectFile } from '../types/domain';
import type { ToolAction } from './toolExecutor';

export type PendingWorkspaceProposal = {
  id: string;
  conversationId: string;
  source: 'model-proposed' | 'user-requested';
  requestedProjectTitle?: string;
  requestedActionKinds: string[];
  requestedFilePaths?: string[];
  draftProjectId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: number;
};

export type PendingWorkspaceProposalRecord = PendingWorkspaceProposal & {
  requestedActions: ToolAction[];
};

export type WorkspaceProposalIntent = 'create' | 'enter' | 'switch';

export function resolveWorkspaceActionProjectId(action: ToolAction, projectFiles: ProjectFile[]) {
  switch (action.kind) {
    case 'createRoomProject':
      return action.project.projectId;
    case 'createProjectFile':
      return action.file.projectId;
    case 'writeProjectFiles':
    case 'patchRoomProject':
      return action.projectId;
    case 'listProjectFiles':
    case 'searchProjectFiles':
    case 'listWorkspaceReferences':
    case 'searchWorkspaceReferences':
    case 'readWorkspaceReference':
    case 'promoteWorkspaceReferenceToProjectFile':
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
    case 'pinProjectFileAsReference': {
      const targetFile = projectFiles.find((file) => file.id === action.fileId) ?? null;
      return targetFile?.projectId;
    }
    default:
      return undefined;
  }
}

export function isWorkspaceProjectAction(action: ToolAction, projectFiles: ProjectFile[]) {
  if (
    action.kind === 'createRoomProject'
    || action.kind === 'createProjectFile'
    || action.kind === 'writeProjectFiles'
    || action.kind === 'patchRoomProject'
    || action.kind === 'listProjectFiles'
    || action.kind === 'searchProjectFiles'
    || action.kind === 'listWorkspaceReferences'
    || action.kind === 'searchWorkspaceReferences'
    || action.kind === 'readWorkspaceReference'
    || action.kind === 'promoteWorkspaceReferenceToProjectFile'
    || action.kind === 'checkProjectPreview'
    || action.kind === 'inspectProjectRuntime'
    || action.kind === 'promoteCardToProject'
  ) {
    return true;
  }

  if (action.kind === 'appendProjectFile' || action.kind === 'insertProjectFile' || action.kind === 'replaceProjectFileLines' || action.kind === 'editProjectFileText' || action.kind === 'deleteProjectFile' || action.kind === 'readProjectFile' || action.kind === 'readProjectFileContext' || action.kind === 'pinProjectFileAsReference') {
    return projectFiles.some((file) => file.id === action.fileId);
  }

  return false;
}

export function workspaceProposalCreatesWorkspace(proposal: Pick<PendingWorkspaceProposal, 'requestedActionKinds'>) {
  return proposal.requestedActionKinds.includes('createRoomProject')
    || proposal.requestedActionKinds.includes('promoteCardToProject');
}

export function resolveWorkspaceProposalIntent(args: {
  proposal: PendingWorkspaceProposal;
  currentProjectId?: string | null;
}): WorkspaceProposalIntent {
  if (args.currentProjectId) return 'switch';
  return workspaceProposalCreatesWorkspace(args.proposal) ? 'create' : 'enter';
}

export function resolveWorkspaceProposalLabel(proposal: PendingWorkspaceProposal) {
  return proposal.requestedProjectTitle?.trim()
    || proposal.draftProjectId?.trim()
    || '未命名工作区';
}
