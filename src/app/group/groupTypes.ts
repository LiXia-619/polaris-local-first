import type { CodeCard, ImageAssetCard, Persona } from '../../types/domain';
import type { GroupActivityKey } from './groupActivity';

export type GroupWorldTab = 'dialogue' | 'cards' | 'images' | 'settings';
export type GroupWorldView = 'home' | 'room';

export const GROUP_BACKGROUND_IDS = ['aurora', 'dusk', 'moss', 'paper'] as const;
export type GroupBackgroundId = (typeof GROUP_BACKGROUND_IDS)[number];

export function groupGenerationKey(conversationId: string, memberId: string) {
  return `${conversationId}::member::${memberId}`;
}

export function laneGenerationKey(conversationId: string, memberId: string) {
  return `${conversationId}::lane::${memberId}`;
}

export type GroupMemberLiveState = {
  member: Persona;
  typing: boolean;
  streamingMessageId: string | null;
  failed: boolean;
  // 私域里正跑着的工具对应的状态文案 key；没在用工具时为 null
  activityKey: GroupActivityKey | null;
};

export type GroupImageItem = {
  id: string;
  assetId: string;
  ownerId: string | null;
  ownerName: string | null;
  fromUser: boolean;
  timestamp: number;
};

export type GroupCardItem = {
  card: CodeCard;
  ownerId: string | null;
  ownerName: string | null;
};

// 附件架：卡片和文件混着收，按时间排
export type GroupArtifactItem =
  | (GroupCardItem & { type: 'card'; timestamp: number })
  | {
      type: 'file';
      id: string;
      assetId: string;
      name: string;
      ownerId: string | null;
      ownerName: string | null;
      fromUser: boolean;
      timestamp: number;
    };

export type GroupOwnedItem = Pick<CodeCard | ImageAssetCard, 'ownerCollaboratorId' | 'originMessageId'>;
