import type { AvatarDisplaySize, AvatarIconId, AvatarShape, Persona, ProviderProfile } from '../../../types/domain';
import type { PersonaUpdatePatch } from '../../../app/persona/personaUpdatePatch';

export type { PersonaUpdatePatch } from '../../../app/persona/personaUpdatePatch';

export type PersonaTabProps = {
  activeCollaboratorId: string | null;
  activePersona: Persona | null;
  providers?: ProviderProfile[];
  activeProviderId?: string | null;
  showChatAvatars?: boolean;
  onUpdatePersona: (patch: PersonaUpdatePatch) => void;
  onSelectPersonaAvatar?: (role: 'assistant' | 'user', files: FileList | File[]) => Promise<void>;
  onSetPersonaAvatarIcon?: (role: 'assistant' | 'user', iconId: AvatarIconId | null) => void;
  onSetPersonaAvatarShape?: (role: 'assistant' | 'user', shape: AvatarShape) => void;
  onSetPersonaAvatarSize?: (role: 'assistant' | 'user', size: AvatarDisplaySize) => void;
  onDeletePersona?: () => void;
  deletePersonaLabel?: string;
  deletePersonaHint?: string;
};
