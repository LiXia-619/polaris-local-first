import type { PolarisToolPromptGroup } from '../tool-protocol/assistantToolProtocolTypes';
import type {
  ConversationSummaryModelSettings,
  ImageGenerationSettings,
  ImageUnderstandingSettings,
  McpServerConfig,
  MemoryVectorRetrievalSettings,
  PolarisCompanionConnection,
  PolarisCompanionHostState,
  PolarisTriggerRule,
  ProviderProfile,
  VoiceGenerationSettings,
  WebDavConfig,
  WebSearchConfig
} from '../../types/domain';
import {
  type LocalDataRef,
  type LocalDataStoredRow,
  type LocalDataUnitMutation,
  type LocalDataUnitOfWork,
  type RuntimeDomainMetaRow,
  type RuntimeLocalDataObjectKind,
  type RuntimeObjectRow,
  type RuntimeObjectState,
  type RuntimeObjectValueMap,
  type RuntimeSettingsRowValue,
  createCompleteLocalDataRow
} from './types';

export const RUNTIME_OBJECT_LEGACY_LIFECYCLE_STATES = [
  'archive',
  'recovering',
  'quarantine',
  'missing-body'
] as const satisfies readonly RuntimeObjectState[];

const RUNTIME_OBJECT_LEGACY_LIFECYCLE_STATE_SET = new Set<RuntimeObjectState>(
  RUNTIME_OBJECT_LEGACY_LIFECYCLE_STATES
);

/** True when the runtime object row is a sealed legacy entry, not a live product object. */
export function isLegacyLifecycleRuntimeState(state: RuntimeObjectState | undefined): boolean {
  return state !== undefined && RUNTIME_OBJECT_LEGACY_LIFECYCLE_STATE_SET.has(state);
}

/** True when the runtime object row is a live, writable product object. */
export function isLiveProductRuntimeState(state: RuntimeObjectState | undefined): boolean {
  return state === undefined || state === 'active';
}

export type RuntimeLocalDataState = {
  providers: ProviderProfile[];
  activeProviderId: string | null;
  webdav: WebDavConfig;
  search: WebSearchConfig;
  conversationSummaryModel: ConversationSummaryModelSettings;
  memoryVectorRetrieval: MemoryVectorRetrievalSettings;
  imageGeneration: ImageGenerationSettings;
  imageUnderstanding: ImageUnderstandingSettings;
  voiceGeneration: VoiceGenerationSettings;
  toolPromptPreferences: Record<PolarisToolPromptGroup, boolean>;
  taskModeEnabled: boolean;
  mcpServers: McpServerConfig[];
  mcpToolTimeoutSeconds: number;
  companionHost: PolarisCompanionHostState;
  companionConnections: PolarisCompanionConnection[];
  triggerRules: PolarisTriggerRule[];
};

export type RuntimeObjectSeed =
  | { kind: 'settings'; value: RuntimeSettingsRowValue }
  | { kind: 'provider'; value: ProviderProfile }
  | { kind: 'mcp-server'; value: McpServerConfig }
  | { kind: 'companion-connection'; value: PolarisCompanionConnection }
  | { kind: 'trigger-rule'; value: PolarisTriggerRule };

export type RuntimeLocalDataProjection = {
  domainMetaRow: ReturnType<typeof buildRuntimeDomainMetaLocalDataRow>;
  objectRows: Array<ReturnType<typeof buildRuntimeObjectLocalDataRow>>;
};

export function getRuntimeDomainMetaLocalDataRef(): LocalDataRef {
  return {
    domain: 'runtime',
    kind: 'domainMeta',
    id: 'runtime'
  };
}

export function getRuntimeObjectLocalDataRef(kind: RuntimeLocalDataObjectKind, id: string): LocalDataRef {
  return {
    domain: 'runtime',
    kind,
    id
  };
}

export function toRuntimeObjectId(kind: RuntimeLocalDataObjectKind, id: string) {
  return `${kind}:${id}`;
}

function buildRuntimeSettingsValue(state: RuntimeLocalDataState, updatedAt: number): RuntimeSettingsRowValue {
  return {
    id: 'runtime-settings',
    webdav: state.webdav,
    search: state.search,
    conversationSummaryModel: state.conversationSummaryModel,
    memoryVectorRetrieval: state.memoryVectorRetrieval,
    imageGeneration: state.imageGeneration,
    imageUnderstanding: state.imageUnderstanding,
    voiceGeneration: state.voiceGeneration,
    toolPromptPreferences: state.toolPromptPreferences,
    taskModeEnabled: state.taskModeEnabled,
    mcpToolTimeoutSeconds: state.mcpToolTimeoutSeconds,
    companionHost: state.companionHost,
    updatedAt
  };
}

export function buildRuntimeObjectSeeds(state: RuntimeLocalDataState, updatedAt: number): RuntimeObjectSeed[] {
  return [
    { kind: 'settings', value: buildRuntimeSettingsValue(state, updatedAt) },
    ...state.providers.map((value) => ({ kind: 'provider' as const, value })),
    ...state.mcpServers.map((value) => ({ kind: 'mcp-server' as const, value })),
    ...state.companionConnections.map((value) => ({ kind: 'companion-connection' as const, value })),
    ...state.triggerRules.map((value) => ({ kind: 'trigger-rule' as const, value }))
  ];
}

function resolveObjectId(seed: RuntimeObjectSeed) {
  return seed.kind === 'settings' ? seed.value.id : seed.value.id;
}

function resolveOwnerCollaboratorId(seed: RuntimeObjectSeed) {
  if (seed.kind === 'companion-connection') return seed.value.collaboratorId || null;
  if (seed.kind === 'trigger-rule') return seed.value.target.collaboratorId || null;
  return null;
}

function resolveUpdatedAt(seed: RuntimeObjectSeed, fallback: number) {
  switch (seed.kind) {
    case 'settings':
      return seed.value.updatedAt;
    case 'companion-connection':
      return seed.value.lastSnapshotAt ?? seed.value.createdAt;
    case 'trigger-rule':
      return seed.value.updatedAt;
    case 'provider':
    case 'mcp-server':
      return fallback;
  }
}

export function buildRuntimeObjectLocalDataRow<K extends RuntimeLocalDataObjectKind>(args: {
  kind: K;
  value: RuntimeObjectValueMap[K];
  version: number;
  updatedAt: number;
}) {
  const seed = args as RuntimeObjectSeed & { version: number; updatedAt: number };
  const id = resolveObjectId(seed);
  const updatedAt = resolveUpdatedAt(seed, args.updatedAt);
  const rowValue: RuntimeObjectRow<K> = {
    id,
    objectId: toRuntimeObjectId(args.kind, id),
    kind: args.kind,
    value: args.value,
    ownerCollaboratorId: resolveOwnerCollaboratorId(seed),
    updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getRuntimeObjectLocalDataRef(args.kind, id),
    value: rowValue,
    version: args.version,
    updatedAt
  });
}

export function buildRuntimeDomainMetaLocalDataRow(args: {
  state: RuntimeLocalDataState;
  version: number;
  updatedAt: number;
}) {
  const objectCounts: RuntimeDomainMetaRow['objectCounts'] = {
    settings: 1,
    provider: args.state.providers.length,
    'mcp-server': args.state.mcpServers.length,
    'companion-connection': args.state.companionConnections.length,
    'trigger-rule': args.state.triggerRules.length
  };
  const totalObjectCount = Object.values(objectCounts).reduce((sum, count) => sum + count, 0);
  const value: RuntimeDomainMetaRow = {
    id: 'runtime',
    activeProviderId: args.state.activeProviderId,
    activeObjectCount: totalObjectCount,
    totalObjectCount,
    objectCounts,
    updatedAt: args.updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getRuntimeDomainMetaLocalDataRef(),
    value,
    version: args.version,
    updatedAt: args.updatedAt
  });
}

export function buildRuntimeLocalDataProjection(args: {
  state: RuntimeLocalDataState;
  version: number;
  updatedAt: number;
}): RuntimeLocalDataProjection {
  return {
    domainMetaRow: buildRuntimeDomainMetaLocalDataRow(args),
    objectRows: buildRuntimeObjectSeeds(args.state, args.updatedAt).map((seed) => buildRuntimeObjectLocalDataRow({
      ...seed,
      version: args.version,
      updatedAt: args.updatedAt
    }))
  };
}

export function buildRuntimeLocalDataUnitOfWork(args: {
  id?: string;
  state: RuntimeLocalDataState;
  version: number;
  updatedAt: number;
}): LocalDataUnitOfWork {
  const projection = buildRuntimeLocalDataProjection(args);
  const objectMutations: LocalDataUnitMutation[] = projection.objectRows.map((row) => ({ type: 'put', row }));

  return {
    id: args.id,
    domain: 'runtime',
    version: args.version,
    mutations: [
      { type: 'put', row: projection.domainMetaRow },
      ...objectMutations
    ]
  };
}
