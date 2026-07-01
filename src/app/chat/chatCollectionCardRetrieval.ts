import { codeCardOriginLabel } from '../../engines/collectionCardOrigin';
import { normalizeForMatch } from '../../engines/stringMatch';
import type { CodeCard, Conversation, Persona } from '../../types/domain';

const MAX_RESULTS = 2;
const GENERIC_QUERY_TERMS = new Set([
  '收藏',
  '收藏区',
  '收藏卡',
  '卡片',
  '卡面',
  '房间',
  '代码',
  '组件',
  '界面',
  '背景',
  'html',
  'css',
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'code',
  'card',
  'collection',
  'component'
]);

type RetrievedCard = {
  id: string;
  title: string;
  language: string;
  tags: string[];
  originLabel: string | null;
};

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function extractLatinTerms(input: string) {
  return input.match(/[a-z0-9_-]{2,}/gi)?.map((token) => token.toLowerCase()) ?? [];
}

function extractChineseTerms(input: string) {
  const runs = input.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const terms: string[] = [];

  for (const run of runs) {
    terms.push(run);
    if (run.length <= 2) continue;
    for (let size = 2; size <= Math.min(4, run.length); size += 1) {
      for (let index = 0; index <= run.length - size; index += 1) {
        terms.push(run.slice(index, index + size));
      }
    }
  }

  return terms;
}

function extractQueryTerms(input: string) {
  return unique([
    ...extractLatinTerms(input),
    ...extractChineseTerms(input)
  ]).filter((term) => term.length >= 2 && !GENERIC_QUERY_TERMS.has(term));
}

function collectRecentUserText(messages: Array<{ role: string; content: string }>) {
  return messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n');
}

function scoreCardMatch(args: {
  card: CodeCard;
  queryText: string;
  queryTerms: string[];
  originLabel: string | null;
  isActive: boolean;
}) {
  const { card, queryText, queryTerms, originLabel, isActive } = args;
  const normalizedTitle = normalizeForMatch(card.title);
  const normalizedTags = card.tags.map((tag) => normalizeForMatch(tag));
  const normalizedLanguage = normalizeForMatch(card.language);
  const normalizedCode = normalizeForMatch(card.code);
  const normalizedOrigin = normalizeForMatch(originLabel ?? '');
  let score = isActive ? 8 : 0;

  if (queryText && normalizedTitle && queryText.includes(normalizedTitle)) {
    score += 18;
  }

  for (const term of queryTerms) {
    if (normalizedTitle.includes(term)) score += 12;
    if (normalizedTags.some((tag) => tag.includes(term))) score += 9;
    if (normalizedLanguage.includes(term)) score += 6;
    if (normalizedOrigin.includes(term)) score += 7;
    if (normalizedCode.includes(term)) score += 4;
  }

  return score;
}

export function retrieveRelevantCollectionCards(args: {
  cards: CodeCard[];
  conversations: Conversation[];
  personas: Persona[];
  activeCardId: string | null;
  messages: Array<{ role: string; content: string }>;
}): RetrievedCard[] {
  const queryText = normalizeForMatch(collectRecentUserText(args.messages));
  const queryTerms = extractQueryTerms(queryText);

  if (!queryTerms.length && !args.activeCardId) {
    return [];
  }

  return args.cards
    .map((card) => {
      const originLabel = codeCardOriginLabel(card, args.conversations, args.personas);
      return {
        card,
        originLabel,
        score: scoreCardMatch({
          card,
          queryText,
          queryTerms,
          originLabel,
          isActive: card.id === args.activeCardId
        })
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.card.updatedAt - left.card.updatedAt)
    .slice(0, MAX_RESULTS)
    .map(({ card, originLabel }) => ({
      id: card.id,
      title: card.title,
      language: card.language,
      tags: card.tags,
      originLabel
    }));
}
