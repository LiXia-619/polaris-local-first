import type { AvatarDisplaySize } from '../../types/domain';

export const AVATAR_DISPLAY_SIZE_LABELS: Record<AvatarDisplaySize, string> = {
  small: '小',
  medium: '中',
  large: '大'
};

const CHAT_AVATAR_SIZE_PX: Record<AvatarDisplaySize, number> = {
  small: 28,
  medium: 34,
  large: 40
};

const EDITOR_COMPACT_AVATAR_SIZE_PX: Record<AvatarDisplaySize, number> = {
  small: 30,
  medium: 34,
  large: 40
};

const EDITOR_AVATAR_SIZE_PX: Record<AvatarDisplaySize, number> = {
  small: 46,
  medium: 54,
  large: 64
};

export function resolveChatAvatarSize(size: AvatarDisplaySize) {
  return CHAT_AVATAR_SIZE_PX[size];
}

export function resolveAvatarEditorPreviewSize(size: AvatarDisplaySize, compact: boolean) {
  return compact ? EDITOR_COMPACT_AVATAR_SIZE_PX[size] : EDITOR_AVATAR_SIZE_PX[size];
}
