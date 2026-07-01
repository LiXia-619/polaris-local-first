import { createCodeCard, deriveCodeCardTitle, inferCodeLanguage, normalizeCodeLanguage, normalizeCodeCardTags } from '../engines/codeCardEngine';
import type { CodeCard } from '../types/domain';
import { normalizeCodeCardFaceCss } from '../engines/collectionCardFace';

export type CodeCardPatch = Partial<
  Pick<CodeCard, 'title' | 'cardNote' | 'language' | 'code' | 'cardFaceCss' | 'tags' | 'source' | 'kind' | 'pinnedAt'>
>;

export type SaveFromChatInput = {
  title?: string;
  cardNote?: string;
  language?: string;
  code: string;
  cardFaceCss?: string;
  tags?: string[];
  ownerCollaboratorId?: string;
  conversationId: string;
  messageId: string;
  blockIndex: number;
  blockTitle?: string;
};

export type SaveFromChatResult = {
  cardId: string;
  created: boolean;
  title: string;
};

export function sortCodeCards(cards: CodeCard[]): CodeCard[] {
  return [...cards].sort((left, right) => {
    const pinDelta = Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt));
    if (pinDelta !== 0) return pinDelta;
    if ((right.pinnedAt ?? 0) !== (left.pinnedAt ?? 0)) return (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0);
    return right.updatedAt - left.updatedAt;
  });
}

export function normalizeCodeCard(
  card: (Partial<CodeCard> & { ownerPersonaId?: string }) & Pick<CodeCard, 'id' | 'title' | 'code'>
): CodeCard {
  const createdAt = typeof card.createdAt === 'number' ? card.createdAt : Date.now();
  const updatedAt = typeof card.updatedAt === 'number' ? card.updatedAt : createdAt;
  const code = card.code ?? '';
  const language = inferCodeLanguage(code, card.language);
  const title = card.title.trim() || deriveCodeCardTitle(code, '未命名房间', language);
  const kind =
    card.kind === 'room-rule'
      ? 'room-rule'
      : card.kind === 'tool'
        ? 'tool'
        : 'card';

  return {
    id: card.id,
    kind,
    title,
    cardNote: card.cardNote?.trim() || undefined,
    language: normalizeCodeLanguage(language),
    code,
    cardFaceCss: normalizeCodeCardFaceCss(card.cardFaceCss),
    tags: normalizeCodeCardTags(card.tags),
    ownerCollaboratorId:
      typeof card.ownerCollaboratorId === 'string'
        ? card.ownerCollaboratorId
        : typeof card.ownerPersonaId === 'string'
          ? card.ownerPersonaId
          : undefined,
    source: card.source ?? 'manual',
    createdAt,
    updatedAt,
    pinnedAt: typeof card.pinnedAt === 'number' ? card.pinnedAt : null,
    originConversationId: card.originConversationId,
    originMessageId: card.originMessageId,
    originBlockIndex: card.originBlockIndex,
    originBlockTitle: card.originBlockTitle
  };
}

export function createCodeCardEntry(seed?: Partial<CodeCard>) {
  return normalizeCodeCard(
    {
      ...createCodeCard({
        title: seed?.title,
        cardNote: seed?.cardNote,
        kind: seed?.kind,
        language: seed?.language,
        code: seed?.code,
        cardFaceCss: seed?.cardFaceCss,
        tags: seed?.tags,
        source: seed?.source,
        originConversationId: seed?.originConversationId,
        originMessageId: seed?.originMessageId,
        originBlockIndex: seed?.originBlockIndex,
        originBlockTitle: seed?.originBlockTitle
      }),
      ownerCollaboratorId: seed?.ownerCollaboratorId
    }
  );
}

export function patchCodeCards(cards: CodeCard[], cardId: string, patch: CodeCardPatch) {
  return sortCodeCards(
    cards.map((card) =>
      card.id === cardId
        ? normalizeCodeCard({
            ...card,
            ...patch,
            kind: patch.kind ?? card.kind,
            title: (patch.title ?? card.title).trim() || card.title,
            cardNote: patch.cardNote !== undefined ? patch.cardNote : card.cardNote,
            language: patch.language ?? card.language,
            code: patch.code ?? card.code,
            cardFaceCss: patch.cardFaceCss !== undefined ? patch.cardFaceCss : card.cardFaceCss,
            tags: patch.tags ?? card.tags,
            source: patch.source ?? card.source,
            pinnedAt: patch.pinnedAt !== undefined ? patch.pinnedAt : card.pinnedAt,
            updatedAt: Date.now()
          })
        : card
    )
  );
}

export function removeCodeCard(cards: CodeCard[], cardId: string) {
  return cards.filter((card) => card.id !== cardId);
}

export function createCodeCardFromChat(input: SaveFromChatInput) {
  return normalizeCodeCard(
    {
      ...createCodeCard({
        title: input.title,
        cardNote: input.cardNote,
        kind: 'card',
        language: input.language,
        code: input.code,
        cardFaceCss: input.cardFaceCss,
        tags: normalizeCodeCardTags(input.tags),
        source: 'chat-generated',
        originConversationId: input.conversationId,
        originMessageId: input.messageId,
        originBlockIndex: input.blockIndex,
        originBlockTitle: input.blockTitle
      }),
      ownerCollaboratorId: input.ownerCollaboratorId
    }
  );
}
