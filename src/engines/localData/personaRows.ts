import type { Persona } from '../../types/domain';
import {
  type LocalDataRef,
  type LocalDataStoredRow,
  type LocalDataUnitMutation,
  type LocalDataUnitOfWork,
  type PersonaCollaboratorState,
  type PersonaDomainMetaRow,
  type PersonaObjectRow,
  createCompleteLocalDataRow
} from './types';

export const PERSONA_COLLABORATOR_LEGACY_LIFECYCLE_STATES = [
  'archive',
  'recovering',
  'quarantine',
  'missing-body'
] as const satisfies readonly PersonaCollaboratorState[];

const PERSONA_COLLABORATOR_LEGACY_LIFECYCLE_STATE_SET = new Set<PersonaCollaboratorState>(
  PERSONA_COLLABORATOR_LEGACY_LIFECYCLE_STATES
);

/**
 * True when the collaborator row is a sealed legacy entry, not a live product persona. A
 * live row carries no `state` field (undefined === `active`), so undefined is never legacy.
 */
export function isLegacyLifecyclePersonaState(state: PersonaCollaboratorState | undefined): boolean {
  return state !== undefined && PERSONA_COLLABORATOR_LEGACY_LIFECYCLE_STATE_SET.has(state);
}

/** True when the collaborator row is a live, writable product persona. */
export function isLiveProductPersonaState(state: PersonaCollaboratorState | undefined): boolean {
  return state === undefined || state === 'active';
}

export type PersonaLocalDataState = {
  personas: Persona[];
  activeCollaboratorId: string | null;
  seededDefaultPersonaIds: string[];
};

export type PersonaLocalDataProjection = {
  domainMetaRow: ReturnType<typeof buildPersonaDomainMetaLocalDataRow>;
  objectRows: Array<ReturnType<typeof buildPersonaObjectLocalDataRow>>;
};

export function getPersonaDomainMetaLocalDataRef(): LocalDataRef {
  return {
    domain: 'persona',
    kind: 'domainMeta',
    id: 'persona'
  };
}

export function getPersonaObjectLocalDataRef(id: string): LocalDataRef {
  return {
    domain: 'persona',
    kind: 'collaborator',
    id
  };
}

export function toPersonaObjectId(id: string) {
  return `collaborator:${id}`;
}

function uniqueSortedIds(values: Iterable<string | null | undefined>) {
  return Array.from(new Set(
    Array.from(values)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  )).sort();
}

function collectAvatarAssetRefs(persona: Persona) {
  return uniqueSortedIds([
    persona.assistantAvatarAssetId,
    persona.userAvatarAssetId
  ]);
}

// The collaborator row's updatedAt is derived purely from the persona's own
// modification signals (its version plus reference-doc / conversation-summary
// timestamps), never the commit wall-clock. A content-derived timestamp keeps the
// object-row value-diff stable: re-persisting an unchanged persona produces a
// byte-identical row instead of a fresh now-stamped one, so the row writer can tell
// a real edit from a no-op without a separate payload-level short-circuit.
function resolvePersonaUpdatedAt(persona: Persona) {
  const memoryDocUpdatedAt = persona.memory.referenceDocs
    .map((doc) => doc.updatedAt)
    .filter((updatedAt) => Number.isFinite(updatedAt));
  const summaryUpdatedAt = persona.memory.conversationSummaries
    .map((summary) => summary.updatedAt)
    .filter((updatedAt) => Number.isFinite(updatedAt));
  return Math.max(persona.version, ...memoryDocUpdatedAt, ...summaryUpdatedAt);
}

export function buildPersonaObjectLocalDataRow(args: {
  value: Persona;
  activeCollaboratorId: string | null;
  version: number;
  // Optional wall-clock override for the row envelope. The row VALUE keeps the content-derived
  // `updatedAt` so the ordinary value-diff stays stable.
  updatedAt?: number;
}) {
  const updatedAt = resolvePersonaUpdatedAt(args.value);
  const rowValue: PersonaObjectRow = {
    id: args.value.id,
    objectId: toPersonaObjectId(args.value.id),
    kind: 'collaborator',
    value: args.value,
    active: args.value.id === args.activeCollaboratorId,
    assetRefs: collectAvatarAssetRefs(args.value),
    referenceDocIds: uniqueSortedIds(args.value.memory.referenceDocs.map((doc) => doc.id)),
    referenceDocCount: args.value.memory.referenceDocs.length,
    updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getPersonaObjectLocalDataRef(args.value.id),
    value: rowValue,
    version: args.version,
    updatedAt: args.updatedAt ?? updatedAt
  });
}

export function buildPersonaDomainMetaLocalDataRow(args: {
  state: PersonaLocalDataState;
  version: number;
  updatedAt: number;
}) {
  const value: PersonaDomainMetaRow = {
    id: 'persona',
    activeCollaboratorId: args.state.activeCollaboratorId,
    activeObjectCount: args.state.personas.length,
    totalObjectCount: args.state.personas.length,
    seededDefaultPersonaIds: uniqueSortedIds(args.state.seededDefaultPersonaIds),
    updatedAt: args.updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getPersonaDomainMetaLocalDataRef(),
    value,
    version: args.version,
    updatedAt: args.updatedAt
  });
}

export function buildPersonaLocalDataProjection(args: {
  state: PersonaLocalDataState;
  version: number;
  updatedAt: number;
}): PersonaLocalDataProjection {
  return {
    domainMetaRow: buildPersonaDomainMetaLocalDataRow(args),
    objectRows: args.state.personas.map((persona) => buildPersonaObjectLocalDataRow({
      value: persona,
      activeCollaboratorId: args.state.activeCollaboratorId,
      version: args.version
    }))
  };
}

export function buildPersonaLocalDataUnitOfWork(args: {
  id?: string;
  state: PersonaLocalDataState;
  version: number;
  updatedAt: number;
}): LocalDataUnitOfWork {
  const projection = buildPersonaLocalDataProjection(args);
  const objectMutations: LocalDataUnitMutation[] = projection.objectRows.map((row) => ({ type: 'put', row }));

  return {
    id: args.id,
    domain: 'persona',
    version: args.version,
    mutations: [
      { type: 'put', row: projection.domainMetaRow },
      ...objectMutations
    ]
  };
}
