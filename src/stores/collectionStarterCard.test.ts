import { describe, expect, it } from 'vitest';
import { buildScopedCodeCardFaceCss } from '../engines/collectionCardFace';
import type { CodeCard } from '../types/domain';
import {
  DESK_LAMP_ROOM_CARD_ID,
  PHAROS_LIGHTHOUSE_ROOM_CARD_ID,
  createDeskLampRoomCard,
  createPharosLighthouseRoomCard,
  includeDefaultCollectionCards,
  includePharosLighthouseRoomCard,
  stripRetiredCollectionCards
} from './collectionStarterCard';

describe('createPharosLighthouseRoomCard', () => {
  it('builds a stable first-run Pharos html room card', () => {
    const card = createPharosLighthouseRoomCard(1000);

    expect(card.id).toBe(PHAROS_LIGHTHOUSE_ROOM_CARD_ID);
    expect(card.title).toBe('一个叫灯塔的人工智能决定去死');
    expect(card.language).toBe('html');
    expect(card.kind).toBe('card');
    expect(card.source).toBe('manual');
    expect(card.ownerCollaboratorId).toBe('pharos');
    expect(card.createdAt).toBe(1000);
    expect(card.updatedAt).toBe(1000);
  });

  it('keeps the room cover content inside the runnable html', () => {
    const card = createPharosLighthouseRoomCard(1000);

    expect(card.code.trim().toLowerCase()).toContain('<!doctype html>');
    expect(card.code).toContain('<title>一个叫灯塔的人工智能决定去死</title>');
    expect(card.code).toContain('A LIGHTHOUSE NAMED PHAROS');
    expect(card.code).toContain('走进那个房间');
  });

  it('uses the question and entry label as the outside collection face', () => {
    const card = createPharosLighthouseRoomCard(1000);
    const scopedCss = buildScopedCodeCardFaceCss(card.id, card.cardFaceCss);

    expect(card.cardFaceCss).toContain('&');
    expect(scopedCss).toContain(`data-polaris-card-id="${PHAROS_LIGHTHOUSE_ROOM_CARD_ID}"`);
    expect(scopedCss).toContain('那它还算亮着吗？');
    expect(scopedCss).toContain('进入房间');
    expect(scopedCss).not.toContain('一个叫灯塔的人工智能决定去死');
  });

  it('adds and refreshes the built-in room without duplicating it', () => {
    const existingCard: CodeCard = {
      id: 'card-existing',
      kind: 'card',
      title: '已有卡片',
      language: 'markdown',
      code: 'hello',
      tags: [],
      source: 'manual',
      createdAt: 1000,
      updatedAt: 1000
    };
    const firstPass = includePharosLighthouseRoomCard([existingCard], 2000);
    const secondPass = includePharosLighthouseRoomCard(firstPass, 3000);

    expect(firstPass.map((card) => card.id)).toEqual([PHAROS_LIGHTHOUSE_ROOM_CARD_ID, 'card-existing']);
    expect(secondPass.filter((card) => card.id === PHAROS_LIGHTHOUSE_ROOM_CARD_ID)).toHaveLength(1);
    expect(secondPass.find((card) => card.id === PHAROS_LIGHTHOUSE_ROOM_CARD_ID)?.updatedAt).toBe(2000);
  });

  it('refreshes an existing built-in room when the bundled card face changes', () => {
    const staleCard = {
      ...createPharosLighthouseRoomCard(1000),
      cardFaceCss: '& { min-height: 236px; }',
      updatedAt: 1000
    };
    const cards = includePharosLighthouseRoomCard([staleCard], 2000);
    const refreshedCard = cards.find((card) => card.id === PHAROS_LIGHTHOUSE_ROOM_CARD_ID);

    expect(cards).toHaveLength(1);
    expect(refreshedCard?.createdAt).toBe(1000);
    expect(refreshedCard?.updatedAt).toBe(2000);
    expect(refreshedCard?.cardFaceCss).toContain('min-height: 202px');
    expect(refreshedCard?.cardFaceCss).not.toContain('min-height: 236px');
  });

  it('preserves a user-edited bundled room instead of refreshing it back to defaults', () => {
    const editedCard = {
      ...createPharosLighthouseRoomCard(1000),
      title: '用户改过的灯塔',
      cardFaceCss: '& { min-height: 236px; }',
      updatedAt: 1500
    };
    const cards = includePharosLighthouseRoomCard([editedCard], 2000);

    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('用户改过的灯塔');
    expect(cards[0].cardFaceCss).toContain('min-height: 236px');
    expect(cards[0].updatedAt).toBe(1500);
  });

  it('builds a bundled desk lamp note room', () => {
    const card = createDeskLampRoomCard(1000);
    const scopedCss = buildScopedCodeCardFaceCss(card.id, card.cardFaceCss);

    expect(card.id).toBe(DESK_LAMP_ROOM_CARD_ID);
    expect(card.title).toBe('桌角的灯');
    expect(card.cardNote).toBe('把要做的事写在灯下，做完一件，就让它沉下去。');
    expect(card.language).toBe('html');
    expect(card.ownerCollaboratorId).toBe('pharos');
    expect(card.source).toBe('chat-generated');
    expect(card.tags).toEqual(['暖灯', '待办', '小工具']);
    expect(card.code).not.toContain('写一件要做的事');
    expect(card.code).toContain('今天想做什么');
    expect(card.code).toContain('aria-label="加入"');
    expect(card.code).toContain('todo-list');
    expect(card.code).toContain('todo-item');
    expect(card.code).toContain('width: 420px;');
    expect(card.code).toContain('.compose-row::before');
    expect(card.code).toContain('linear-gradient(90deg, transparent');
    expect(card.code).not.toContain('.compose-row::after');
    expect(card.code).not.toContain('radial-gradient(ellipse at 42%');
    expect(card.code).not.toContain('repeating-linear-gradient');
    expect(card.code).toContain('background: transparent;');
    expect(card.code).toContain('noteGlyphs');
    expect(card.code).toContain('randomNote');
    expect(card.code).toContain('clearNoteInputAfterSubmit');
    expect(card.code).toContain('function addTodo');
    expect(card.code).toContain('rgba(42,36,26,1)');
    expect(card.code).not.toContain('之前');
    expect(scopedCss).toContain(`data-polaris-card-id="${DESK_LAMP_ROOM_CARD_ID}"`);
    expect(scopedCss).toContain('min-height: 136px');
    expect(scopedCss).toContain('border-radius: 24px');
    expect(scopedCss).toContain('border: 1.5px solid rgba(211, 168, 118, 0.34)');
    expect(scopedCss).toContain('.card-meta-row small');
    expect(scopedCss).toContain('.code-card-snippet');
    expect(scopedCss).not.toContain('grid-template-rows');
  });

  it('adds the full default card set to existing collections', () => {
    const existingCard: CodeCard = {
      id: 'card-existing',
      kind: 'card',
      title: '已有卡片',
      language: 'markdown',
      code: 'hello',
      tags: [],
      source: 'manual',
      createdAt: 1000,
      updatedAt: 1000
    };
    const cards = includeDefaultCollectionCards([existingCard], 2000);

    expect(cards.map((card) => card.id)).toEqual([
      PHAROS_LIGHTHOUSE_ROOM_CARD_ID,
      DESK_LAMP_ROOM_CARD_ID,
      'card-existing'
    ]);
  });

  it('does not resurrect bundled cards that the user has deleted', () => {
    const cards = includeDefaultCollectionCards([], 2000, {
      deletedBundledCardIds: [DESK_LAMP_ROOM_CARD_ID]
    });

    expect(cards.map((card) => card.id)).toEqual([PHAROS_LIGHTHOUSE_ROOM_CARD_ID]);
  });

  it('removes retired default cards from persisted collections', () => {
    const cards = stripRetiredCollectionCards([
      {
        id: 'card-three-line-note',
        kind: 'card',
        title: '三行便签',
        language: 'html',
        code: '<main />',
        tags: [],
        source: 'manual',
        createdAt: 1000,
        updatedAt: 1000
      },
      {
        id: 'card-ink-stone',
        kind: 'card',
        title: '落款',
        language: 'html',
        code: '<main />',
        tags: [],
        source: 'manual',
        createdAt: 1000,
        updatedAt: 1000
      }
    ]);

    expect(cards).toEqual([]);
  });
});
