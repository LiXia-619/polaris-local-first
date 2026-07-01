import {
  buildAmbiguousSnippetError,
  buildMissingSnippetError,
  countStringOccurrences
} from './toolExecutorCollectionTextEdit';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type { CodeCard, CollectionShelf } from '../types/domain';

export type CollectionCodeCardAction = Extract<
  ToolAction,
  {
    kind:
      | 'listCodeCards'
      | 'createCodeCard'
      | 'patchCodeCard'
      | 'editCodeCardText'
      | 'appendCodeCard'
      | 'readCodeCard';
  }
>;

function revealCollectionShelf(ctx: ToolContext, shelf: CollectionShelf) {
  ctx.setCollectionShelf(shelf);
  ctx.setWorld('collection');
}

export function formatCodeCardDirectory(cards: CodeCard[]) {
  return cards.length
    ? [
        `房间卡目录：${cards.length} 张`,
        ...cards.map((card, index) => [
          `${index + 1}. ${card.title}（${card.language}） id=${card.id}`,
          card.tags.length ? `   标签：${card.tags.join('、')}` : null,
          `   更新：${new Date(card.updatedAt).toISOString()}`
        ].filter(Boolean).join('\n'))
      ].join('\n')
    : '房间卡目录：当前协作者房间里还没有房间卡。';
}

export function formatCodeCardRead(card: CodeCard) {
  return [
    `房间：${card.title}`,
    `语言：${card.language}`,
    card.tags.length ? `标签：${card.tags.join('、')}` : null,
    '',
    card.code.trim() || '[空]'
  ].filter(Boolean).join('\n');
}

export async function executeCollectionCodeCardAction(
  action: CollectionCodeCardAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'listCodeCards': {
      const cards = ctx.listCodeCards()
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt);
      return {
        ok: true,
        summary: `已读取房间卡目录 · ${cards.length} 张`,
        detailText: formatCodeCardDirectory(cards)
      };
    }
    case 'createCodeCard': {
      const cardId = ctx.createCodeCard(action.card);
      if (!cardId) {
        return { ok: false, error: '新建卡片失败。' };
      }
      ctx.selectCodeCard(cardId);
      ctx.spotlightCodeCard(cardId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'code');
      }
      return { ok: true, cardId };
    }
    case 'patchCodeCard': {
      const updated = ctx.patchCodeCard(action.cardId, action.patch);
      if (!updated) {
        return { ok: false, error: '没有找到要修改的房间。' };
      }
      ctx.selectCodeCard(action.cardId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'code');
      }
      return { ok: true, cardId: action.cardId };
    }
    case 'editCodeCardText': {
      const card = ctx.readCodeCard(action.cardId);
      const currentContent = card?.code;
      if (typeof currentContent !== 'string') {
        return { ok: false, error: '没有找到要局部替换的房间。' };
      }
      const matchCount = countStringOccurrences(currentContent, action.oldString);
      if (matchCount === 0) {
        return {
          ok: false,
          error: buildMissingSnippetError({
            label: '要替换的原文片段',
            snippet: action.oldString,
            guidance: '请先读取这张房间卡的最新正文，或改用更短、更稳定的原文片段；oldString 必须和当前正文完全一致，包括空格、换行和引号。'
          })
        };
      }
      if (matchCount > 1) {
        return {
          ok: false,
          error: buildAmbiguousSnippetError({
            content: currentContent,
            snippet: action.oldString,
            count: matchCount,
            label: '要替换的原文片段',
            guidance: '请提供更长的 oldString。'
          })
        };
      }
      const nextContent = currentContent.replace(action.oldString, action.newString);
      const updated = ctx.patchCodeCard(action.cardId, { code: nextContent });
      if (!updated) {
        return { ok: false, error: '没有找到要局部替换的房间。' };
      }
      ctx.selectCodeCard(action.cardId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'code');
      }
      return { ok: true, cardId: action.cardId };
    }
    case 'appendCodeCard': {
      const card = ctx.readCodeCard(action.cardId);
      const currentContent = card?.code;
      if (typeof currentContent !== 'string') {
        return { ok: false, error: '没有找到要追加的房间。' };
      }
      const updated = ctx.patchCodeCard(action.cardId, { code: `${currentContent}${action.code}` });
      if (!updated) {
        return { ok: false, error: '没有找到要追加的房间。' };
      }
      ctx.selectCodeCard(action.cardId);
      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'code');
      }
      return { ok: true, cardId: action.cardId };
    }
    case 'readCodeCard': {
      const card = ctx.readCodeCard(action.cardId);
      if (!card) {
        return { ok: false, error: '没有找到要读取的房间。' };
      }
      return {
        ok: true,
        summary: `已读取房间 · ${card.title}`,
        detailText: formatCodeCardRead(card),
        cardId: card.id
      };
    }
  }
}
