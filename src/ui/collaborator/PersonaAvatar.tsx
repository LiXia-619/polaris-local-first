import type { AvatarIconId, AvatarShape } from '../../types/domain';
import { Icon } from '../Icon';
import { useAssetObjectUrl } from '../useAssetObjectUrl';
import { AvatarLogoIcon } from './AvatarLogoIcon';
import { CollaboratorSigil } from './CollaboratorSigil';

type PersonaAvatarProps = {
  role: 'assistant' | 'user';
  seed: string | null;
  assetId?: string | null;
  iconId?: AvatarIconId | null;
  imageUrl?: string | null;
  shape: AvatarShape;
  size?: number;
  className?: string;
};

export function PersonaAvatar({
  role,
  seed,
  assetId,
  iconId,
  imageUrl,
  shape,
  size = 28,
  className = ''
}: PersonaAvatarProps) {
  const assetUrl = useAssetObjectUrl(imageUrl ? undefined : assetId ?? undefined, true);
  const resolvedImageUrl = imageUrl ?? assetUrl;
  const borderRadius = shape === 'circle' ? '999px' : `${Math.max(8, Math.round(size * 0.24))}px`;
  const frameStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius
  };

  if (iconId) {
    return (
      <span
        className={`persona-avatar persona-avatar--icon ${className}`.trim()}
        data-avatar-shape={shape}
        data-avatar-icon-id={iconId}
        style={frameStyle}
        aria-hidden="true"
      >
        <AvatarLogoIcon iconId={iconId} size={Math.max(15, Math.round(size * 0.64))} />
      </span>
    );
  }

  if (resolvedImageUrl) {
    return (
      <span
        className={`persona-avatar persona-avatar--image ${className}`.trim()}
        data-avatar-shape={shape}
        style={frameStyle}
        aria-hidden="true"
      >
        <img src={resolvedImageUrl} alt="" />
      </span>
    );
  }

  if (role === 'assistant') {
    return (
      <span
        className={`persona-avatar persona-avatar--fallback ${className}`.trim()}
        data-avatar-shape={shape}
        style={frameStyle}
        aria-hidden="true"
      >
        <CollaboratorSigil seed={seed} size={Math.max(16, size - 4)} />
      </span>
    );
  }

  return (
    <span
      className={`persona-avatar persona-avatar--fallback persona-avatar--user ${className}`.trim()}
      data-avatar-shape={shape}
      style={frameStyle}
      aria-hidden="true"
    >
      <Icon name="polarisStar" size={Math.max(14, size - 10)} />
    </span>
  );
}
