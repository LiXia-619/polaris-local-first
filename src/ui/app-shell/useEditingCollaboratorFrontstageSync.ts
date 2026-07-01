import { useEffect } from 'react';
import type { Persona } from '../../types/domain';
import { resolveEditingCollaboratorFrontstageId } from './resolveEditingCollaboratorFrontstageId';

type UseEditingCollaboratorFrontstageSyncArgs = {
  personas: Persona[];
  editingCollaboratorId: string | null;
  frontstageCollaboratorId: string | null;
  activeCollaboratorId: string | null;
  setEditingCollaboratorId: (collaboratorId: string | null) => void;
};

export function useEditingCollaboratorFrontstageSync({
  personas,
  editingCollaboratorId,
  frontstageCollaboratorId,
  activeCollaboratorId,
  setEditingCollaboratorId
}: UseEditingCollaboratorFrontstageSyncArgs) {
  useEffect(() => {
    const nextCollaboratorId = resolveEditingCollaboratorFrontstageId({
      personas,
      editingCollaboratorId,
      frontstageCollaboratorId,
      activeCollaboratorId
    });
    if (nextCollaboratorId !== editingCollaboratorId) {
      setEditingCollaboratorId(nextCollaboratorId);
    }
  }, [
    personas,
    editingCollaboratorId,
    frontstageCollaboratorId,
    activeCollaboratorId,
    setEditingCollaboratorId
  ]);
}
