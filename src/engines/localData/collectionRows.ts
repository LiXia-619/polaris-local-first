import type {
  CodeCard,
  ImageAssetCard,
  ProjectFile,
  RoomProject,
  WorkspaceReferenceDoc
} from '../../types/domain';
import { extractPolarisAssetIds } from '../assetReferences';
import {
  type CollectionDomainMetaRow,
  type CollectionLocalDataObjectKind,
  type CollectionObjectRow,
  type CollectionObjectState,
  type CollectionObjectValueMap,
  type LocalDataRef,
  type LocalDataStoredRow,
  type LocalDataUnitMutation,
  type LocalDataUnitOfWork,
  createCompleteLocalDataRow
} from './types';

export const COLLECTION_OBJECT_LEGACY_LIFECYCLE_STATES = [
  'archive',
  'recovering',
  'quarantine',
  'missing-body'
] as const satisfies readonly CollectionObjectState[];

const COLLECTION_OBJECT_LEGACY_LIFECYCLE_STATE_SET = new Set<CollectionObjectState>(
  COLLECTION_OBJECT_LEGACY_LIFECYCLE_STATES
);

/** True when the object row is a sealed legacy entry, not a live product object. */
export function isLegacyLifecycleCollectionState(state: CollectionObjectState | undefined): boolean {
  return state !== undefined && COLLECTION_OBJECT_LEGACY_LIFECYCLE_STATE_SET.has(state);
}

/** True when the object row is a live, writable product object. */
export function isLiveProductCollectionState(state: CollectionObjectState | undefined): boolean {
  return state === undefined || state === 'active';
}

export type CollectionLocalDataState = {
  cards: CodeCard[];
  imageCards: ImageAssetCard[];
  roomProjects: RoomProject[];
  projectFiles: ProjectFile[];
  workspaceReferenceDocs: WorkspaceReferenceDoc[];
  deletedBundledCardIds?: string[];
};

type CollectionObjectSeed =
  | { kind: 'card'; value: CodeCard }
  | { kind: 'image-card'; value: ImageAssetCard }
  | { kind: 'project'; value: RoomProject }
  | { kind: 'project-file'; value: ProjectFile }
  | { kind: 'workspace-doc'; value: WorkspaceReferenceDoc };

export type CollectionLocalDataProjection = {
  domainMetaRow: ReturnType<typeof buildCollectionDomainMetaLocalDataRow>;
  objectRows: Array<ReturnType<typeof buildCollectionObjectLocalDataRow>>;
};

export function getCollectionDomainMetaLocalDataRef(): LocalDataRef {
  return {
    domain: 'collection',
    kind: 'domainMeta',
    id: 'collection'
  };
}

export function getCollectionObjectLocalDataRef(kind: CollectionLocalDataObjectKind, id: string): LocalDataRef {
  return {
    domain: 'collection',
    kind,
    id
  };
}

export function toCollectionObjectId(kind: CollectionLocalDataObjectKind, id: string) {
  return `${kind}:${id}`;
}

function uniqueSortedIds(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).filter((value) => value.trim().length > 0))).sort();
}

function collectTextAssetRefs(...values: Array<string | undefined>) {
  const refs = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    extractPolarisAssetIds(value).forEach((assetId) => refs.add(assetId));
  });
  return uniqueSortedIds(refs);
}

function resolveOwnerCollaboratorId(value: CollectionObjectValueMap[CollectionLocalDataObjectKind]) {
  return typeof value.ownerCollaboratorId === 'string' && value.ownerCollaboratorId.trim()
    ? value.ownerCollaboratorId
    : null;
}

function resolveProjectId(seed: CollectionObjectSeed) {
  if (seed.kind === 'project') return seed.value.id;
  if (seed.kind === 'project-file' || seed.kind === 'workspace-doc') return seed.value.projectId;
  return null;
}

function resolveUpdatedAt(value: CollectionObjectValueMap[CollectionLocalDataObjectKind]) {
  return typeof value.updatedAt === 'number' ? value.updatedAt : Date.now();
}

function resolveAssetRefs(seed: CollectionObjectSeed) {
  switch (seed.kind) {
    case 'card':
      return collectTextAssetRefs(seed.value.code, seed.value.cardFaceCss, seed.value.cardNote);
    case 'image-card':
      return seed.value.assetId ? [seed.value.assetId] : [];
    case 'project':
      return collectTextAssetRefs(seed.value.coverStyle, seed.value.coverNote);
    case 'project-file':
      return collectTextAssetRefs(seed.value.content);
    case 'workspace-doc':
      return collectTextAssetRefs(seed.value.content, seed.value.summary);
  }
}

function objectSeeds(state: CollectionLocalDataState): CollectionObjectSeed[] {
  return [
    ...state.cards.map((value) => ({ kind: 'card' as const, value })),
    ...state.imageCards.map((value) => ({ kind: 'image-card' as const, value })),
    ...state.roomProjects.map((value) => ({ kind: 'project' as const, value })),
    ...state.projectFiles.map((value) => ({ kind: 'project-file' as const, value })),
    ...state.workspaceReferenceDocs.map((value) => ({ kind: 'workspace-doc' as const, value }))
  ];
}

function buildCollectionObjectRowValue<K extends CollectionLocalDataObjectKind>(args: {
  kind: K;
  value: CollectionObjectValueMap[K];
}): CollectionObjectRow<K> {
  return {
    id: args.value.id,
    objectId: toCollectionObjectId(args.kind, args.value.id),
    kind: args.kind,
    value: args.value,
    ownerCollaboratorId: resolveOwnerCollaboratorId(args.value),
    projectId: resolveProjectId(args as CollectionObjectSeed),
    assetRefs: resolveAssetRefs(args as CollectionObjectSeed),
    updatedAt: resolveUpdatedAt(args.value)
  };
}

export function buildCollectionObjectLocalDataRow<K extends CollectionLocalDataObjectKind>(args: {
  kind: K;
  value: CollectionObjectValueMap[K];
  version: number;
  // Optional wall-clock override for the row envelope. The row VALUE keeps its content-derived
  // `updatedAt` so the ordinary value-diff stays stable.
  updatedAt?: number;
}) {
  const rowValue = buildCollectionObjectRowValue(args);

  return createCompleteLocalDataRow({
    ref: getCollectionObjectLocalDataRef(args.kind, args.value.id),
    value: rowValue,
    version: args.version,
    updatedAt: args.updatedAt ?? rowValue.updatedAt
  });
}

export function buildCollectionDomainMetaLocalDataRow(args: {
  activeProjectId: string | null;
  state: CollectionLocalDataState;
  version: number;
  updatedAt: number;
}) {
  const objectCounts: CollectionDomainMetaRow['objectCounts'] = {
    card: args.state.cards.length,
    'image-card': args.state.imageCards.length,
    project: args.state.roomProjects.length,
    'project-file': args.state.projectFiles.length,
    'workspace-doc': args.state.workspaceReferenceDocs.length
  };
  const totalObjectCount = Object.values(objectCounts).reduce((sum, count) => sum + count, 0);
  const value: CollectionDomainMetaRow = {
    id: 'collection',
    activeProjectId: args.activeProjectId,
    activeObjectCount: totalObjectCount,
    totalObjectCount,
    objectCounts,
    deletedBundledCardIds: uniqueSortedIds(args.state.deletedBundledCardIds ?? []),
    updatedAt: args.updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getCollectionDomainMetaLocalDataRef(),
    value,
    version: args.version,
    updatedAt: args.updatedAt
  });
}

export function buildCollectionLocalDataProjection(args: {
  activeProjectId: string | null;
  state: CollectionLocalDataState;
  version: number;
  updatedAt: number;
}): CollectionLocalDataProjection {
  return {
    domainMetaRow: buildCollectionDomainMetaLocalDataRow(args),
    objectRows: objectSeeds(args.state).map((seed) => buildCollectionObjectLocalDataRow({
      ...seed,
      version: args.version
    }))
  };
}

export function buildCollectionLocalDataUnitOfWork(args: {
  id?: string;
  activeProjectId: string | null;
  state: CollectionLocalDataState;
  version: number;
  updatedAt: number;
}): LocalDataUnitOfWork {
  const projection = buildCollectionLocalDataProjection(args);
  const objectMutations: LocalDataUnitMutation[] = projection.objectRows.map((row) => ({ type: 'put', row }));

  return {
    id: args.id,
    domain: 'collection',
    version: args.version,
    mutations: [
      { type: 'put', row: projection.domainMetaRow },
      ...objectMutations
    ]
  };
}
