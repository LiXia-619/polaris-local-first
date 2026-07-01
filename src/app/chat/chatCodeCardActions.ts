import { extractCodeBlocksFromMessage } from '../../engines/codeCardEngine';
import { revealCollectionShelf } from '../shell/frontstageNavigation';
import { createUid } from '../../engines/id';
import type { WritableConversationBody } from '../../stores/chatStore';
import type { ChatMessage, CollectionShelf, ToolInvocation } from '../../types/domain';
import { resolveContinuationCodeBlockState } from './chatMessageCardReference';
import type {
  ChatSpaceFrontstagePort,
  ToolActionCollectionState,
  ToolActionDerivedState,
  ToolActionLocalState
} from './chatToolActionTypes';
import { resolveChatCollaboratorOwnerId } from './chatCollaboratorOwner';
import type { ActiveConversationCollaboratorSession } from './chatConversationCollaborator';

type ChatCodeCardActionsArgs = {
  local: ToolActionLocalState;
  chat: Pick<{
    ensureConversationWritable: (conversationId: string) => Promise<WritableConversationBody | null>;
    updateMessage: (target: WritableConversationBody, messageId: string, patch: Partial<ChatMessage>) => void;
  }, 'ensureConversationWritable' | 'updateMessage'>;
  collection: Pick<ToolActionCollectionState, 'cards' | 'saveCardFromChat' | 'updateCard'>;
  space: Pick<ChatSpaceFrontstagePort, 'setCollectionShelf' | 'setWorld' | 'setActiveCard' | 'spotlightCard'>;
  derived: Omit<ToolActionDerivedState, 'activeConversation'> & {
    activeConversation: ActiveConversationCollaboratorSession | null;
  };
  frontstageCollaboratorId: string | null;
  addRuntimeToolMessage: (target: WritableConversationBody, toolInvocation: ToolInvocation) => void;
};

export function createChatCodeCardActions({
  local,
  chat,
  collection,
  space,
  derived,
  frontstageCollaboratorId,
  addRuntimeToolMessage
}: ChatCodeCardActionsArgs) {
  const upsertSaveCodeCardToolMessage = (params: {
    target: WritableConversationBody;
    messageId: string;
    cardId: string;
    savedCount: number;
    totalCount: number;
    primaryTitle: string;
  }) => {
    const { target, messageId, cardId, savedCount, totalCount, primaryTitle } = params;
    const isComplete = savedCount >= totalCount;
    const title = totalCount > 1
      ? (isComplete ? `已存入 ${savedCount} 张卡片` : `已存入 ${savedCount} / ${totalCount}`)
      : '已存入卡片';
    const summary = totalCount > 1
      ? (isComplete
          ? `已存入 ${savedCount} 张卡片`
          : `已存入 ${savedCount} / ${totalCount} 张卡片`)
      : `已存入卡片 · ${primaryTitle}`;

    const existingToolMessage = target.messages
      .slice()
      .reverse()
      .find((candidate) =>
        candidate.toolInvocation?.kind === 'saveCodeCard' &&
        candidate.toolInvocation.originMessageId === messageId
      );

    if (existingToolMessage) {
      const existingInvocation = existingToolMessage.toolInvocation;
      if (!existingInvocation) return;
      chat.updateMessage(target, existingToolMessage.id, {
        content: summary,
        toolInvocation: {
          ...existingInvocation,
          status: isComplete ? 'saved' : 'executed',
          title,
          summary,
          cardId,
          originMessageId: messageId,
          codeSaveCount: savedCount,
          codeSaveTotal: totalCount
        }
      });
      return;
    }

    addRuntimeToolMessage(target, {
      id: createUid('tool'),
      kind: 'saveCodeCard',
      status: isComplete ? 'saved' : 'executed',
      title,
      summary,
      cardId,
      originMessageId: messageId,
      codeSaveCount: savedCount,
      codeSaveTotal: totalCount
    });
  };

  const openCollection = (collectionShelf: Extract<CollectionShelf, 'code' | 'project' | 'image'>) => {
    revealCollectionShelf(space, collectionShelf);
  };

  const openCodeCollection = () => {
    openCollection('code');
  };

  const saveMessageCodeCard = async (message: ChatMessage) => {
    if (!derived.activeConversation) return;
    const activeConversation = derived.activeConversation;
    const conversationId = activeConversation.id;
    const writableConversation = await chat.ensureConversationWritable(conversationId);
    if (!writableConversation) {
      local.setCommandStatus('当前对话消息还没加载完成，暂时不能保存这条代码。', true);
      return;
    }
    const ownerCollaboratorId = resolveChatCollaboratorOwnerId({
      frontstageCollaboratorId,
      activeConversationCollaboratorId: activeConversation.collaboratorId
    });

    const candidates = extractCodeBlocksFromMessage(message.content);
    if (candidates.length === 0) {
      local.setCommandStatus('这条消息里没有可保存的代码块。');
      return;
    }

    const continuation = resolveContinuationCodeBlockState({
      messages: writableConversation.messages,
      assistantMessageId: message.id,
      cards: collection.cards,
      codeBlocks: candidates
    });

    if (continuation) {
      collection.updateCard(continuation.targetCard.id, {
        code: continuation.primaryBlock.code,
        language: continuation.primaryBlock.language ?? continuation.targetCard.language
      });
      space.setActiveCard(continuation.targetCard.id);
      space.spotlightCard(continuation.targetCard.id);
      upsertSaveCodeCardToolMessage({
        target: writableConversation,
        messageId: message.id,
        cardId: continuation.targetCard.id,
        savedCount: 1,
        totalCount: 1,
        primaryTitle: continuation.targetCard.title
      });
      local.setCommandStatus(`已写回卡片：${continuation.targetCard.title}`);
      return;
    }

    const results = candidates
      .map((candidate) => collection.saveCardFromChat({
        title: candidate.title,
        language: candidate.language,
        code: candidate.code,
        tags: candidate.tags,
        ownerCollaboratorId,
        conversationId,
        messageId: message.id,
        blockIndex: candidate.blockIndex,
        blockTitle: candidate.title
      }))
      .filter((result): result is NonNullable<typeof result> => Boolean(result));
    if (results.length === 0) return;

    const createdResults = results.filter((result) => result.created);
    const primaryResult = createdResults[0] ?? results[0];
    space.setActiveCard(primaryResult.cardId);
    if (createdResults.length > 0) {
      space.spotlightCard(primaryResult.cardId);
    }
    upsertSaveCodeCardToolMessage({
      target: writableConversation,
      messageId: message.id,
      cardId: primaryResult.cardId,
      savedCount: results.length,
      totalCount: candidates.length,
      primaryTitle: primaryResult.title
    });
    local.setCommandStatus(
      createdResults.length > 1
        ? `已存入 ${createdResults.length} 张卡片`
        : createdResults.length === 1
          ? `已存入卡片：${primaryResult.title}`
          : `这条回复里的 ${results.length} 段代码已经有对应房间`
    );
  };

  const handleCodeCardAction = (message: ChatMessage) => {
    const actionMode = derived.codeCardActionModeByMessageId[message.id] ?? 'hidden';
    if (actionMode === 'open') {
      openCodeCollection();
      return;
    }
    if (actionMode === 'save') {
      return saveMessageCodeCard(message);
    }
  };

  return {
    openCodeCollection,
    saveMessageCodeCard,
    handleCodeCardAction
  };
}
