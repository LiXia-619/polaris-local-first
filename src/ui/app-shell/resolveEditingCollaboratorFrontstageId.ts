import { isCompanionCollaboratorId } from '../../engines/companion';
import type { Persona } from '../../types/domain';

type ResolveEditingCollaboratorFrontstageIdArgs = {
  personas: Persona[];
  editingCollaboratorId: string | null;
  frontstageCollaboratorId: string | null;
  activeCollaboratorId: string | null;
};

function isEditableCollaboratorId(collaboratorId: string | null, personas: Persona[]) {
  if (!collaboratorId) return false;
  if (isCompanionCollaboratorId(collaboratorId)) return false;
  return personas.some((persona) => persona.id === collaboratorId);
}

export function resolveEditingCollaboratorFrontstageId({
  personas,
  editingCollaboratorId,
  frontstageCollaboratorId,
  activeCollaboratorId
}: ResolveEditingCollaboratorFrontstageIdArgs) {
  if (isEditableCollaboratorId(frontstageCollaboratorId, personas)) {
    return frontstageCollaboratorId;
  }

  if (isEditableCollaboratorId(editingCollaboratorId, personas)) {
    return editingCollaboratorId;
  }

  if (isEditableCollaboratorId(activeCollaboratorId, personas)) {
    return activeCollaboratorId;
  }

  return personas[0]?.id ?? null;
}
