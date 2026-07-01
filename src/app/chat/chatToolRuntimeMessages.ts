import type { ChatMessage } from '../../types/domain';
import { createMessage } from '../../engines/chatMessageFactory';
import type { AddRuntimeToolMessage, ChatToolStoreBindings } from './chatPorts';

export function createAddRuntimeToolMessage(
  chat: Pick<ChatToolStoreBindings, 'chat'>['chat'],
  factoryOptions?: {
    // 群聊里过程消息要归到正在发言的成员名下，私域才能按人捞回过程
    resolveSpeakerCollaboratorId?: (conversationId: string) => string | null | undefined;
  }
): AddRuntimeToolMessage {
  return (target, toolInvocation, attachments, options) => {
    const conversationId = target.conversationId;
    const speakerCollaboratorId = factoryOptions?.resolveSpeakerCollaboratorId?.(conversationId) ?? undefined;
    const message: ChatMessage = {
      ...createMessage('system', toolInvocation.summary, attachments, 'tool-runtime', toolInvocation.id),
      model: 'local-tool',
      toolInvocation,
      ...(speakerCollaboratorId ? { speakerCollaboratorId } : {})
    };

    if (options?.beforeMessageId) {
      chat.insertMessageAfter(target, options.beforeMessageId, message);
    } else {
      chat.addMessage(target, message);
    }

  };
}
