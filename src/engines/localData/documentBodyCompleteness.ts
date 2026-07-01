import type { PersistedDbEntry } from '../../infrastructure/persistence';

export type DocumentBodyCompletenessIndex = {
  bodyKeys: Set<string>;
  completeKeys: Set<string>;
  chunkIssueKeys: Set<string>;
};

type ChunkBodySummary = {
  indexes: number[];
  charCount: number;
  readable: boolean;
  knownCharCount: boolean;
};

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function addChunkSummary(target: Map<string, ChunkBodySummary>, docKey: string, index: number, value: unknown) {
  const existing = target.get(docKey) ?? { indexes: [], charCount: 0, readable: true, knownCharCount: true };
  existing.indexes.push(index);
  if (typeof value === 'string') {
    existing.charCount += value.length;
  } else if (value === undefined) {
    existing.knownCharCount = false;
  } else {
    existing.readable = false;
  }
  target.set(docKey, existing);
}

function collectChunkBodySummaries(entries: PersistedDbEntry[], prefix: string) {
  const summaries = new Map<string, ChunkBodySummary>();
  entries.forEach((entry) => {
    if (!entry.key.startsWith(prefix)) return;
    const body = entry.key.slice(prefix.length);
    const separatorIndex = body.lastIndexOf(':');
    if (separatorIndex <= 0) return;
    const docKey = body.slice(0, separatorIndex);
    const index = Number(body.slice(separatorIndex + 1));
    if (!Number.isInteger(index) || index < 0) return;
    addChunkSummary(summaries, docKey, index, entry.value);
  });
  return summaries;
}

function hasContiguousIndexes(indexes: number[]) {
  const sorted = [...indexes].sort((left, right) => left - right);
  return sorted.every((value, index) => value === index);
}

export function declaredReferenceDocCharCount(doc: Record<string, unknown>) {
  const declared = readNumber(doc.charCount);
  if (declared !== null) return declared;
  return typeof doc.content === 'string' ? doc.content.length : 0;
}

export function collectDocumentBodyCompletenessIndex(args: {
  kv: PersistedDbEntry[];
  splitPrefix: string;
  chunkPrefix: string;
  legacyDocs?: Record<string, string>;
  declaredCharCounts: Map<string, number>;
}): DocumentBodyCompletenessIndex {
  const bodyKeys = new Set<string>();
  const completeKeys = new Set<string>();
  const chunkIssueKeys = new Set<string>();
  const markComplete = (docKey: string, charCount: number | 'unknown' | null) => {
    bodyKeys.add(docKey);
    const declaredCharCount = args.declaredCharCounts.get(docKey) ?? 0;
    if (charCount === 'unknown' || (charCount !== null && charCount >= declaredCharCount)) {
      completeKeys.add(docKey);
    }
  };

  Object.entries(args.legacyDocs ?? {}).forEach(([docKey, content]) => {
    markComplete(docKey, typeof content === 'string' ? content.length : null);
  });

  args.kv.forEach((entry) => {
    if (!entry.key.startsWith(args.splitPrefix)) return;
    const charCount = typeof entry.value === 'string'
      ? entry.value.length
      : entry.value === undefined
        ? 'unknown'
        : null;
    markComplete(entry.key.slice(args.splitPrefix.length), charCount);
  });

  collectChunkBodySummaries(args.kv, args.chunkPrefix).forEach((summary, docKey) => {
    const declaredCharCount = args.declaredCharCounts.get(docKey) ?? 0;
    const chunkComplete = summary.readable
      && hasContiguousIndexes(summary.indexes)
      && (!summary.knownCharCount || summary.charCount >= declaredCharCount);
    const charCount = summary.knownCharCount ? summary.charCount : 'unknown';
    markComplete(docKey, chunkComplete ? charCount : null);
    if (!chunkComplete) chunkIssueKeys.add(docKey);
  });
  chunkIssueKeys.forEach((docKey) => completeKeys.delete(docKey));

  return { bodyKeys, completeKeys, chunkIssueKeys };
}
