import type { Persona } from '../../types/domain';

type ResolveActiveCollaboratorFrontstageIdArgs = {
  personas: Persona[];
  frontstageCollaboratorId: string | null;
  activeCollaboratorId: string | null;
};

export function resolveActiveCollaboratorFrontstageId({
  personas,
  frontstageCollaboratorId,
  activeCollaboratorId
}: ResolveActiveCollaboratorFrontstageIdArgs) {
  if (frontstageCollaboratorId && personas.some((persona) => persona.id === frontstageCollaboratorId)) {
    return frontstageCollaboratorId;
  }
  return activeCollaboratorId;
}
