import { PersonaAvatar } from '../../collaborator/PersonaAvatar';
import type { Persona } from '../../../types/domain';

type GroupAvatarProps = {
  persona: Persona;
  size?: number;
};

export function GroupAvatar({ persona, size = 30 }: GroupAvatarProps) {
  return (
    <PersonaAvatar
      role="assistant"
      seed={persona.id}
      assetId={persona.assistantAvatarAssetId}
      iconId={persona.assistantAvatarIconId}
      shape={persona.assistantAvatarShape}
      size={size}
    />
  );
}
