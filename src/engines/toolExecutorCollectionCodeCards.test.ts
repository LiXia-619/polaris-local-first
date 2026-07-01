import { describe, expect, it, vi } from 'vitest';
import {
  executeCollectionCodeCardAction,
  formatCodeCardDirectory,
  formatCodeCardRead
} from './toolExecutorCollectionCodeCards';
import type { ToolContext } from './toolExecutorTypes';
import type { CodeCard } from '../types/domain';

function makeCard(patch: Partial<CodeCard> = {}): CodeCard {
  return {
    id: 'card-1',
    title: '白树房间',
    language: 'html',
    code: '<main>白树</main>',
    tags: ['视觉'],
    source: 'manual',
    createdAt: 1,
    updatedAt: 2,
    ...patch
  };
}

function createContext(card = makeCard()) {
  return {
    listCodeCards: vi.fn(() => [card]),
    createCodeCard: vi.fn(() => 'card-new'),
    patchCodeCard: vi.fn(() => true),
    readCodeCard: vi.fn((cardId: string) => cardId === card.id ? card : null),
    selectCodeCard: vi.fn(),
    spotlightCodeCard: vi.fn(),
    setCollectionShelf: vi.fn(),
    setWorld: vi.fn()
  } as Partial<ToolContext> as ToolContext;
}

describe('code card formatting', () => {
  it('formats directory entries and empty states', () => {
    const card = makeCard({ updatedAt: Date.UTC(2026, 0, 1) });

    expect(formatCodeCardDirectory([card])).toContain('1. 白树房间（html） id=card-1');
    expect(formatCodeCardDirectory([card])).toContain('标签：视觉');
    expect(formatCodeCardDirectory([])).toBe('房间卡目录：当前协作者房间里还没有房间卡。');
  });

  it('formats full code card reads', () => {
    expect(formatCodeCardRead(makeCard())).toContain('<main>白树</main>');
    expect(formatCodeCardRead(makeCard({ tags: [], code: '  ' }))).toContain('[空]');
  });
});

describe('executeCollectionCodeCardAction', () => {
  it('lists code cards newest first', async () => {
    const older = makeCard({ id: 'old', title: '旧房间', updatedAt: 1 });
    const newer = makeCard({ id: 'new', title: '新房间', updatedAt: 2 });
    const ctx = createContext();
    vi.mocked(ctx.listCodeCards).mockReturnValue([older, newer]);

    await expect(executeCollectionCodeCardAction({ kind: 'listCodeCards' }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '已读取房间卡目录 · 2 张',
      detailText: expect.stringMatching(/1\. 新房间[\s\S]*2\. 旧房间/)
    });
  });

  it('creates and opens a new code card when requested', async () => {
    const ctx = createContext();

    await expect(executeCollectionCodeCardAction({
      kind: 'createCodeCard',
      card: {
        title: '新房间',
        language: 'html',
        code: '<main />',
        tags: []
      },
      openInCollection: true
    }, ctx)).resolves.toEqual({ ok: true, cardId: 'card-new' });

    expect(ctx.selectCodeCard).toHaveBeenCalledWith('card-new');
    expect(ctx.spotlightCodeCard).toHaveBeenCalledWith('card-new');
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('code');
    expect(ctx.setWorld).toHaveBeenCalledWith('collection');
  });

  it('edits a code card by exact single snippet match', async () => {
    const ctx = createContext(makeCard({ code: 'alpha beta gamma' }));

    await expect(executeCollectionCodeCardAction({
      kind: 'editCodeCardText',
      cardId: 'card-1',
      oldString: 'beta',
      newString: 'BETA',
      openInCollection: true
    }, ctx)).resolves.toEqual({ ok: true, cardId: 'card-1' });

    expect(ctx.patchCodeCard).toHaveBeenCalledWith('card-1', { code: 'alpha BETA gamma' });
    expect(ctx.selectCodeCard).toHaveBeenCalledWith('card-1');
    expect(ctx.setCollectionShelf).toHaveBeenCalledWith('code');
  });

  it('returns precise edit errors for missing or ambiguous snippets', async () => {
    const ctx = createContext(makeCard({ code: 'same one same two' }));

    await expect(executeCollectionCodeCardAction({
      kind: 'editCodeCardText',
      cardId: 'card-1',
      oldString: 'missing',
      newString: 'x'
    }, ctx)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('要替换的原文片段没有命中')
    });

    await expect(executeCollectionCodeCardAction({
      kind: 'editCodeCardText',
      cardId: 'card-1',
      oldString: 'same',
      newString: 'x'
    }, ctx)).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('要替换的原文片段匹配到 2 处')
    });
  });

  it('appends and reads code cards', async () => {
    const ctx = createContext(makeCard({ code: 'alpha' }));

    await expect(executeCollectionCodeCardAction({
      kind: 'appendCodeCard',
      cardId: 'card-1',
      code: ' beta'
    }, ctx)).resolves.toEqual({ ok: true, cardId: 'card-1' });
    expect(ctx.patchCodeCard).toHaveBeenCalledWith('card-1', { code: 'alpha beta' });

    await expect(executeCollectionCodeCardAction({
      kind: 'readCodeCard',
      cardId: 'card-1'
    }, ctx)).resolves.toMatchObject({
      ok: true,
      summary: '已读取房间 · 白树房间',
      detailText: expect.stringContaining('alpha'),
      cardId: 'card-1'
    });
  });
});
