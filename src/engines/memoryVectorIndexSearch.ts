import { tokenizeMemoryRetrievalQuery } from './memoryRetrievalIndex';
import {
  sameMemoryVectorIndexModelIdentity,
  type MemoryVectorIndexEntry,
  type MemoryVectorIndexModelIdentity
} from './memoryVectorIndexStorage';

export type MemoryVectorIndexSearchResult = {
  entry: MemoryVectorIndexEntry;
  score: number;
  matchedKeywords: string[];
  matchKind: 'vector_similarity';
  authority: 'semantic_clue';
};

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return null;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return null;

    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude <= 0 || rightMagnitude <= 0) return null;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function entryKeywordText(entry: MemoryVectorIndexEntry) {
  return [
    entry.title,
    entry.summary,
    entry.semanticText,
    entry.conversationTitle,
    ...entry.keywords
  ].join(' ');
}

function matchedQueryKeywords(entry: MemoryVectorIndexEntry, queryText: string | undefined) {
  const queryKeywords = tokenizeMemoryRetrievalQuery(queryText ?? '');
  if (!queryKeywords.length) return [];

  const entryKeywords = new Set(tokenizeMemoryRetrievalQuery(entryKeywordText(entry)));
  return queryKeywords.filter((keyword) => entryKeywords.has(keyword));
}

function finiteLimit(limit: number | undefined) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return null;
  return Math.max(0, Math.floor(limit));
}

export function searchMemoryVectorIndexEntries(args: {
  entries: MemoryVectorIndexEntry[];
  queryEmbedding: number[];
  model: MemoryVectorIndexModelIdentity;
  queryText?: string;
  activeConversationId?: string | null;
  limit?: number;
}): MemoryVectorIndexSearchResult[] {
  const results = args.entries.flatMap((entry) => {
    if (entry.conversationId === args.activeConversationId) return [];
    if (!entry.embedding) return [];
    if (!sameMemoryVectorIndexModelIdentity(entry.embedding, args.model)) return [];

    const score = cosineSimilarity(args.queryEmbedding, entry.embedding.vector);
    if (score === null) return [];

    return [{
      entry,
      score,
      matchedKeywords: matchedQueryKeywords(entry, args.queryText),
      matchKind: 'vector_similarity' as const,
      authority: 'semantic_clue' as const
    }];
  }).sort((left, right) => {
    const scoreDelta = right.score - left.score;
    if (scoreDelta !== 0) return scoreDelta;

    const updatedAtDelta = right.entry.updatedAt - left.entry.updatedAt;
    if (updatedAtDelta !== 0) return updatedAtDelta;

    return right.entry.sourceChunkId.localeCompare(left.entry.sourceChunkId);
  });

  const limit = finiteLimit(args.limit);
  return limit === null ? results : results.slice(0, limit);
}
