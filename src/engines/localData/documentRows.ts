import { extractPolarisAssetIds } from '../assetReferences';
import {
  type DocumentBodyRow,
  type DocumentDomainMetaRow,
  type DocumentLocalDataObjectKind,
  type DocumentOwnerRef,
  type DocumentStorageSource,
  type LocalDataRef,
  type LocalDataUnitMutation,
  type LocalDataUnitOfWork,
  createCompleteLocalDataRow,
  createIncompleteLocalDataRow
} from './types';

export type DocumentBodySource = {
  source: DocumentStorageSource;
  content: string | null;
  keys: string[];
  chunkIndexes: number[];
  chunkCount: number;
  contiguous: boolean;
};

export type DocumentObjectSeed = {
  id: string;
  kind: DocumentLocalDataObjectKind;
  title: string;
  summary: string;
  declaredCharCount: number;
  contentLoaded: boolean;
  body: DocumentBodySource;
  ownerRefs: DocumentOwnerRef[];
  updatedAt: number;
  expectsBody: boolean;
};

export type DocumentLocalDataState = {
  documents: DocumentObjectSeed[];
};

export type DocumentLocalDataProjection = {
  domainMetaRow: ReturnType<typeof buildDocumentDomainMetaLocalDataRow>;
  objectRows: Array<ReturnType<typeof buildDocumentObjectLocalDataRow>>;
};

export function getDocumentDomainMetaLocalDataRef(): LocalDataRef {
  return {
    domain: 'document',
    kind: 'domainMeta',
    id: 'document'
  };
}

export function getDocumentObjectLocalDataRef(kind: DocumentLocalDataObjectKind, id: string): LocalDataRef {
  return {
    domain: 'document',
    kind,
    id
  };
}

export function toDocumentObjectId(kind: DocumentLocalDataObjectKind, id: string) {
  return `${kind}:${id}`;
}

function uniqueSortedIds(values: Iterable<string | null | undefined>) {
  return Array.from(new Set(
    Array.from(values)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  )).sort();
}

function collectAssetRefs(...values: string[]) {
  const refs = new Set<string>();
  values.forEach((value) => extractPolarisAssetIds(value).forEach((assetId) => refs.add(assetId)));
  return uniqueSortedIds(refs);
}

export function documentObjectHasMissingBody(seed: DocumentObjectSeed) {
  if (!seed.expectsBody || seed.body.source === 'chunked') return false;
  return seed.body.content === null || seed.body.content.length < seed.declaredCharCount;
}

export function documentObjectHasIncompleteChunks(seed: DocumentObjectSeed) {
  return seed.body.source === 'chunked'
    && (!seed.body.contiguous
      || seed.body.content === null
      || (seed.expectsBody && seed.body.content.length < seed.declaredCharCount));
}

export function documentObjectIncompleteReason(seed: DocumentObjectSeed) {
  if (documentObjectHasIncompleteChunks(seed)) return 'missing-chunk';
  if (documentObjectHasMissingBody(seed)) return 'missing-body';
  return null;
}

function buildRowValue(seed: DocumentObjectSeed): DocumentBodyRow {
  const reason = documentObjectIncompleteReason(seed);
  const content = reason ? '' : seed.body.content ?? '';
  return {
    id: seed.id,
    objectId: toDocumentObjectId(seed.kind, seed.id),
    kind: seed.kind,
    title: seed.title,
    summary: seed.summary,
    content,
    declaredCharCount: seed.declaredCharCount,
    actualCharCount: content.length,
    contentLoaded: reason === null && (seed.body.content !== null || !seed.expectsBody),
    storageSource: seed.body.source,
    storageKeys: uniqueSortedIds(seed.body.keys),
    chunkCount: seed.body.chunkCount,
    chunkIndexes: [...seed.body.chunkIndexes].sort((left, right) => left - right),
    ownerRefs: seed.ownerRefs,
    ownerCount: seed.ownerRefs.length,
    assetRefs: collectAssetRefs(seed.summary, content),
    orphan: seed.ownerRefs.length === 0,
    updatedAt: seed.updatedAt
  };
}

export function buildDocumentObjectLocalDataRow(args: {
  seed: DocumentObjectSeed;
  version: number;
  updatedAt: number;
}) {
  const value = buildRowValue(args.seed);
  const reason = documentObjectIncompleteReason(args.seed);
  if (reason) {
    return createIncompleteLocalDataRow({
      ref: getDocumentObjectLocalDataRef(args.seed.kind, args.seed.id),
      version: args.version,
      updatedAt: args.updatedAt,
      reason,
      missingKeys: args.seed.body.keys.length > 0 ? args.seed.body.keys : [`document-body:${args.seed.id}`],
      meta: value
    });
  }

  return createCompleteLocalDataRow({
    ref: getDocumentObjectLocalDataRef(args.seed.kind, args.seed.id),
    value,
    version: args.version,
    updatedAt: value.updatedAt
  });
}

export function buildDocumentDomainMetaLocalDataRow(args: {
  state: DocumentLocalDataState;
  version: number;
  updatedAt: number;
}) {
  const objectCounts: DocumentDomainMetaRow['objectCounts'] = {
    'persona-memory-doc': args.state.documents.filter((doc) => doc.kind === 'persona-memory-doc').length,
    'workspace-reference-doc': args.state.documents.filter((doc) => doc.kind === 'workspace-reference-doc').length,
    'orphan-body': args.state.documents.filter((doc) => doc.kind === 'orphan-body').length
  };
  const value: DocumentDomainMetaRow = {
    id: 'document',
    activeObjectCount: args.state.documents.filter((doc) => !documentObjectIncompleteReason(doc) && doc.kind !== 'orphan-body').length,
    totalObjectCount: args.state.documents.length,
    objectCounts,
    missingBodyCount: args.state.documents.filter(documentObjectHasMissingBody).length,
    incompleteChunkCount: args.state.documents.filter(documentObjectHasIncompleteChunks).length,
    orphanBodyCount: objectCounts['orphan-body'],
    totalCharCount: args.state.documents.reduce((sum, doc) => (
      documentObjectIncompleteReason(doc) ? sum : sum + (doc.body.content?.length ?? 0)
    ), 0),
    updatedAt: args.updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getDocumentDomainMetaLocalDataRef(),
    value,
    version: args.version,
    updatedAt: args.updatedAt
  });
}

export function buildDocumentLocalDataProjection(args: {
  state: DocumentLocalDataState;
  version: number;
  updatedAt: number;
}): DocumentLocalDataProjection {
  return {
    domainMetaRow: buildDocumentDomainMetaLocalDataRow(args),
    objectRows: args.state.documents.map((seed) => buildDocumentObjectLocalDataRow({
      seed,
      version: args.version,
      updatedAt: args.updatedAt
    }))
  };
}

export function buildDocumentLocalDataUnitOfWork(args: {
  id?: string;
  state: DocumentLocalDataState;
  version: number;
  updatedAt: number;
}): LocalDataUnitOfWork {
  const projection = buildDocumentLocalDataProjection(args);
  const objectMutations: LocalDataUnitMutation[] = projection.objectRows.map((row) => ({ type: 'put', row }));

  return {
    id: args.id,
    domain: 'document',
    version: args.version,
    mutations: [
      { type: 'put', row: projection.domainMetaRow },
      ...objectMutations
    ]
  };
}
