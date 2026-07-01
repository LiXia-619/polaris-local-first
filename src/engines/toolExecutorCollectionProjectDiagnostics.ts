import { checkRoomProjectPreview } from './roomProjectPreview';
import { inspectRoomProjectRuntime } from './roomProjectRuntimeInspection';
import {
  buildPreviewDiagnosticEvidence,
  buildProjectPreviewRunnable,
  buildProjectPreviewSummary,
  buildProjectRuntimeRunnable,
  buildProjectRuntimeSummary,
  buildRuntimeDiagnosticEvidence,
  formatProjectPreviewCheck,
  formatProjectRuntimeInspection
} from './toolExecutorCollectionDiagnostics';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';

export type CollectionProjectDiagnosticAction = Extract<
  ToolAction,
  {
    kind:
      | 'checkProjectPreview'
      | 'inspectProjectRuntime';
  }
>;

export async function executeCollectionProjectDiagnosticAction(
  action: CollectionProjectDiagnosticAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'checkProjectPreview': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const projectFiles = ctx.listProjectFiles(project.id);
      const check = checkRoomProjectPreview(project, projectFiles);
      return {
        ok: true,
        summary: buildProjectPreviewSummary(project.title, check),
        detailText: formatProjectPreviewCheck(project.id, check),
        roomProjectId: project.id,
        projectFileId: check.entryFileId ?? undefined,
        projectDiagnostics: [buildPreviewDiagnosticEvidence(project.id, check)],
        projectPreviewRunnable: buildProjectPreviewRunnable(check)
      };
    }
    case 'inspectProjectRuntime': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const projectFiles = ctx.listProjectFiles(project.id);
      const inspection = await inspectRoomProjectRuntime(project, projectFiles, {
        settleMs: action.settleMs
      });
      return {
        ok: true,
        summary: buildProjectRuntimeSummary(inspection),
        detailText: formatProjectRuntimeInspection(project.id, inspection),
        roomProjectId: project.id,
        projectFileId: inspection.entryFileId ?? undefined,
        projectDiagnostics: [buildRuntimeDiagnosticEvidence(project.id, inspection)],
        projectPreviewRunnable: buildProjectRuntimeRunnable(inspection)
      };
    }
  }
}
