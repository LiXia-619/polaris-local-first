import {
  filterMemoryRecallTerms,
  normalizeMemoryRecallTerm,
  tokenizeMemoryRecallTerms
} from './memoryRecallTerms';

export type MemoryRecallAnchorSource = 'preset' | 'shape' | 'corpus';

export type MemoryRecallAnchor = {
  term: string;
  weight: number;
  source: MemoryRecallAnchorSource;
};

export type MemoryRecallCorpusAnchorStats = Map<string, {
  conversationCount: number;
  occurrenceCount: number;
}>;

const RELATION_ANCHORS = new Set([
  '妈妈',
  '我妈',
  '老妈',
  '母亲',
  '爸爸',
  '我爸',
  '老爸',
  '父亲',
  '老师',
  '姐姐',
  '妹妹',
  '哥哥',
  '弟弟',
  '伴侣',
  '男朋友',
  '女朋友'
]);

const MODEL_PRODUCT_ANCHORS = new Set([
  'nova',
  'chatgpt',
  'claude',
  'deepseek',
  'gemini',
  'gpt',
  'kimi',
  'openai',
  'pharos',
  'polaris',
  'qwen',
  '豆包',
  '通义'
]);

const TECHNICAL_ANCHORS = new Set([
  '向量',
  '向量索引',
  '索引',
  '记忆',
  '供应商',
  '模型',
  '摘要',
  '召回'
]);

function addAnchor(
  anchors: Map<string, MemoryRecallAnchor>,
  term: string,
  weight: number,
  source: MemoryRecallAnchorSource
) {
  const normalized = normalizeMemoryRecallTerm(term);
  if (!normalized) return;
  const existing = anchors.get(normalized);
  if (!existing || weight > existing.weight) {
    anchors.set(normalized, { term: normalized, weight, source });
  }
}

function asciiAnchorTerms(text: string) {
  const matches = text.normalize('NFKC').match(/[A-Za-z][A-Za-z0-9_.-]{1,}/g) ?? [];
  return filterMemoryRecallTerms(matches).filter((term) => {
    const normalized = normalizeMemoryRecallTerm(term);
    if (MODEL_PRODUCT_ANCHORS.has(normalized)) return true;
    return /[A-Z]/.test(term) || /[0-9_.-]/.test(term);
  });
}

function presetAnchorsInText(text: string) {
  const normalized = normalizeMemoryRecallTerm(text);
  return [
    ...Array.from(RELATION_ANCHORS).filter((term) => normalized.includes(term)),
    ...Array.from(MODEL_PRODUCT_ANCHORS).filter((term) => normalized.includes(term)),
    ...Array.from(TECHNICAL_ANCHORS).filter((term) => normalized.includes(term))
  ];
}

export function extractMemoryRecallAnchors(
  text: string,
  corpusStats?: MemoryRecallCorpusAnchorStats
): MemoryRecallAnchor[] {
  const anchors = new Map<string, MemoryRecallAnchor>();

  for (const term of presetAnchorsInText(text)) {
    const weight = RELATION_ANCHORS.has(term)
      ? 6
      : MODEL_PRODUCT_ANCHORS.has(term)
        ? 5
        : 3;
    addAnchor(anchors, term, weight, 'preset');
  }
  for (const term of asciiAnchorTerms(text)) {
    addAnchor(anchors, term, MODEL_PRODUCT_ANCHORS.has(normalizeMemoryRecallTerm(term)) ? 5 : 4, 'shape');
  }
  for (const term of tokenizeMemoryRecallTerms(text)) {
    const stats = corpusStats?.get(term);
    if (!stats) continue;
    if (stats.conversationCount >= 2 || stats.occurrenceCount >= 3) {
      addAnchor(anchors, term, Math.min(4.5, 2.5 + stats.conversationCount), 'corpus');
    }
  }

  return Array.from(anchors.values()).sort((left, right) => {
    const weightDelta = right.weight - left.weight;
    if (weightDelta !== 0) return weightDelta;
    return left.term.localeCompare(right.term);
  });
}

export function buildMemoryRecallCorpusAnchorStats(
  entries: Array<{ conversationId: string; text: string }>
): MemoryRecallCorpusAnchorStats {
  const stats = new Map<string, {
    conversationIds: Set<string>;
    occurrenceCount: number;
  }>();

  for (const entry of entries) {
    for (const term of tokenizeMemoryRecallTerms(entry.text)) {
      const current = stats.get(term) ?? {
        conversationIds: new Set<string>(),
        occurrenceCount: 0
      };
      current.conversationIds.add(entry.conversationId);
      current.occurrenceCount += 1;
      stats.set(term, current);
    }
  }

  return new Map(Array.from(stats.entries()).map(([term, value]) => [
    term,
    {
      conversationCount: value.conversationIds.size,
      occurrenceCount: value.occurrenceCount
    }
  ]));
}
