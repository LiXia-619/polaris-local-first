import { useEffect } from 'react';
import type { Persona } from '../../types/domain';
import { resolveActiveCollaboratorFrontstageId } from './resolveActiveCollaboratorFrontstageId';

type UseCollaboratorFrontstageSyncArgs = {
  personas: Persona[];
  activeCollaboratorId: string | null;
  frontstageCollaboratorId: string | null;
  setActiveCollaborator: (collaboratorId: string) => void;
};

export function useCollaboratorFrontstageSync({
  personas,
  activeCollaboratorId,
  frontstageCollaboratorId,
  setActiveCollaborator
}: UseCollaboratorFrontstageSyncArgs) {
  useEffect(() => {
    const nextActiveCollaboratorId = resolveActiveCollaboratorFrontstageId({
      personas,
      frontstageCollaboratorId,
      activeCollaboratorId
    });
    if (nextActiveCollaboratorId && nextActiveCollaboratorId !== activeCollaboratorId) {
      setActiveCollaborator(nextActiveCollaboratorId);
    }
  }, [
    personas,
    activeCollaboratorId,
    frontstageCollaboratorId,
    setActiveCollaborator
  ]);
}
