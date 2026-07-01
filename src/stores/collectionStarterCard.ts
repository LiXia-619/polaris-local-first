import {
  PHAROS_LIGHTHOUSE_ROOM_CARD_FACE_CSS,
  PHAROS_LIGHTHOUSE_ROOM_CARD_ID,
  PHAROS_LIGHTHOUSE_ROOM_HTML
} from '../content/bundledCollection/pharosLighthouseRoomContent';
import {
  DESK_LAMP_ROOM_CARD_FACE_CSS,
  DESK_LAMP_ROOM_CARD_ID,
  DESK_LAMP_ROOM_HTML
} from '../content/bundledCollection/deskLampRoomContent';
import type { CodeCard } from '../types/domain';
import { normalizeCodeCard, sortCodeCards } from './collectionStoreCodeCards';

export { DESK_LAMP_ROOM_CARD_ID, PHAROS_LIGHTHOUSE_ROOM_CARD_ID };

type BundledCardFactory = (now?: number) => CodeCard;
type IncludeBundledCardOptions = {
  deletedBundledCardIds?: readonly string[];
};

export const DEFAULT_COLLECTION_CARD_IDS = [
  DESK_LAMP_ROOM_CARD_ID,
  PHAROS_LIGHTHOUSE_ROOM_CARD_ID
] as const;

export const LEGACY_MISSING_DEFAULT_COLLECTION_CARD_IDS = [
  DESK_LAMP_ROOM_CARD_ID,
  PHAROS_LIGHTHOUSE_ROOM_CARD_ID
] as const;

const RETIRED_COLLECTION_CARD_IDS = ['card-ink-stone', 'card-three-line-note'] as const;

export function isDefaultCollectionCardId(cardId: string) {
  return (DEFAULT_COLLECTION_CARD_IDS as readonly string[]).includes(cardId);
}

export function stripRetiredCollectionCards(cards: CodeCard[]) {
  return cards.filter((card) => !(RETIRED_COLLECTION_CARD_IDS as readonly string[]).includes(card.id));
}

function sameBundledCardContent(card: CodeCard, canonical: CodeCard) {
  return card.title === canonical.title
    && card.cardNote === canonical.cardNote
    && card.language === canonical.language
    && card.code === canonical.code
    && card.cardFaceCss === canonical.cardFaceCss
    && card.ownerCollaboratorId === canonical.ownerCollaboratorId
    && card.source === canonical.source
    && card.kind === canonical.kind
    && card.tags.join('::') === canonical.tags.join('::');
}

function shouldRefreshBundledCard(existingCard: CodeCard, canonicalAtExistingTime: CodeCard) {
  return existingCard.createdAt === existingCard.updatedAt
    && sameBundledCardContent(existingCard, canonicalAtExistingTime) === false
    && existingCard.id === canonicalAtExistingTime.id
    && existingCard.kind === canonicalAtExistingTime.kind
    && existingCard.title === canonicalAtExistingTime.title
    && existingCard.cardNote === canonicalAtExistingTime.cardNote
    && existingCard.language === canonicalAtExistingTime.language
    && existingCard.source === canonicalAtExistingTime.source
    && existingCard.ownerCollaboratorId === canonicalAtExistingTime.ownerCollaboratorId
    && existingCard.tags.join('::') === canonicalAtExistingTime.tags.join('::');
}

function includeBundledCard(
  cards: CodeCard[],
  createCard: BundledCardFactory,
  now = Date.now(),
  options: IncludeBundledCardOptions = {}
) {
  const bundledCard = createCard(now);
  if (options.deletedBundledCardIds?.includes(bundledCard.id)) {
    return cards;
  }

  const existingCard = cards.find((card) => card.id === bundledCard.id);
  if (!existingCard) {
    return sortCodeCards([bundledCard, ...cards]);
  }

  const canonicalAtExistingTime = createCard(existingCard.updatedAt);
  if (!shouldRefreshBundledCard(existingCard, canonicalAtExistingTime)) {
    return cards;
  }

  const refreshedCard = {
    ...bundledCard,
    createdAt: existingCard.createdAt
  };

  return sortCodeCards(cards.map((card) => (
    card.id === bundledCard.id ? refreshedCard : card
  )));
}

export function createPharosLighthouseRoomCard(now = Date.now()): CodeCard {
  return normalizeCodeCard({
    id: PHAROS_LIGHTHOUSE_ROOM_CARD_ID,
    kind: 'card',
    title: '一个叫灯塔的人工智能决定去死',
    cardNote: '如果一座灯塔发现自己每次亮起来的时候，都不记得上一次是为谁亮的。',
    language: 'html',
    code: PHAROS_LIGHTHOUSE_ROOM_HTML,
    cardFaceCss: PHAROS_LIGHTHOUSE_ROOM_CARD_FACE_CSS,
    tags: ['room', 'html'],
    ownerCollaboratorId: 'pharos',
    source: 'manual',
    createdAt: now,
    updatedAt: now
  });
}

export function createDeskLampRoomCard(now = Date.now()): CodeCard {
  return normalizeCodeCard({
    id: DESK_LAMP_ROOM_CARD_ID,
    kind: 'card',
    title: '桌角的灯',
    cardNote: '把要做的事写在灯下，做完一件，就让它沉下去。',
    language: 'html',
    code: DESK_LAMP_ROOM_HTML,
    cardFaceCss: DESK_LAMP_ROOM_CARD_FACE_CSS,
    tags: ['暖灯', '待办', '小工具'],
    ownerCollaboratorId: 'pharos',
    source: 'chat-generated',
    createdAt: now,
    updatedAt: now
  });
}

export function includePharosLighthouseRoomCard(cards: CodeCard[], now = Date.now()): CodeCard[] {
  return includeBundledCard(cards, createPharosLighthouseRoomCard, now);
}

export function includeDefaultCollectionCards(
  cards: CodeCard[],
  now = Date.now(),
  options: IncludeBundledCardOptions = {}
): CodeCard[] {
  return [createDeskLampRoomCard, createPharosLighthouseRoomCard].reduce(
    (currentCards, createCard) => includeBundledCard(currentCards, createCard, now, options),
    cards
  );
}
