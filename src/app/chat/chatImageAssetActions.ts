import type { ChatAttachment, ChatMessage } from '../../types/domain';
import type { ToolActionCollectionState, ToolActionLocalState } from './chatToolActionTypes';
import { inferChatImageAssetTags } from './chatImageAssetTags';
import { resolveChatCollaboratorOwnerId } from './chatCollaboratorOwner';
import type { ActiveConversationCollaborator } from './chatConversationCollaborator';

type ChatImageAssetActionsArgs = {
  local: ToolActionLocalState;
  collection: Pick<ToolActionCollectionState, 'saveImageCardFromChat'>;
  activeConversation: ActiveConversationCollaborator | null;
  frontstageCollaboratorId: string | null;
};

export function createChatImageAssetActions({
  local,
  collection,
  activeConversation,
  frontstageCollaboratorId
}: ChatImageAssetActionsArgs) {
  const saveMessageImageCard = (message: ChatMessage, attachment: ChatAttachment) => {
    if (!activeConversation) return;
    if (attachment.kind !== 'image') return;
    const ownerCollaboratorId = resolveChatCollaboratorOwnerId({
      frontstageCollaboratorId,
      activeConversationCollaboratorId: activeConversation.collaboratorId
    });

    const result = collection.saveImageCardFromChat({
      assetId: attachment.assetId,
      tags: inferChatImageAssetTags(message, attachment),
      ownerCollaboratorId,
      imageName: attachment.name,
      conversationId: activeConversation.id,
      messageId: message.id,
      attachmentId: attachment.id
    });

    local.setCommandStatus(
      result?.created
        ? `已把《${result.title}》收进图片卡。`
        : result
          ? `《${result.title}》已经在收藏里了。`
          : '收藏图片失败。'
    );
  };

  return {
    saveMessageImageCard
  };
}
