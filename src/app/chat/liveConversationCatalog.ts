import type { Conversation } from '../../types/domain';
import { isGroupConversation } from '../../engines/conversationOwnership';

type SelectLiveConversationOptions = {
  includeGroupConversations?: boolean;
};

export function selectChatConversations(
  conversations: Conversation[],
  options: SelectLiveConversationOptions = {}
) {
  if (options.includeGroupConversations) return conversations;
  return conversations.filter((conversation) => !isGroupConversation(conversation));
}
