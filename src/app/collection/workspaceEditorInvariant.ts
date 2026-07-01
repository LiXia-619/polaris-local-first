export function describeWorkspaceEditorInvariantViolation(args: {
  workshopMode: 'create' | 'edit' | null;
  activeCardId: string | null;
  activeProjectFileId: string | null;
  hasActiveCard: boolean;
  hasActiveProjectFile: boolean;
}) {
  const {
    workshopMode,
    activeCardId,
    activeProjectFileId,
    hasActiveCard,
    hasActiveProjectFile
  } = args;

  if (workshopMode !== 'edit') return null;
  if (activeCardId && activeProjectFileId) {
    return 'edit mode cannot target both a room card and a project file at the same time.';
  }
  if (!activeCardId && !activeProjectFileId) {
    return 'edit mode opened without an active room card or project file.';
  }
  if (activeCardId && !hasActiveCard) {
    return `edit mode targeted missing room card ${activeCardId}.`;
  }
  if (activeProjectFileId && !hasActiveProjectFile) {
    return `edit mode targeted missing project file ${activeProjectFileId}.`;
  }
  return null;
}
