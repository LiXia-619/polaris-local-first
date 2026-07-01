import type { SavedSkin } from '../../types/domain';
import type { CollectionLocalDataState } from './collectionRows';
import type { PersonaLocalDataState } from './personaRows';
import type { RuntimeLocalDataState } from './runtimeRows';
import type { SpaceLocalDataState } from './spaceRows';
import {
  type AssetDomainMetaRow,
  type CollectionDomainMetaRow,
  type CollectionLocalDataObjectKind,
  type CollectionObjectRow,
  type DocumentDomainMetaRow,
  type LocalDataCompleteRow,
  type LocalDataDomain,
  type LocalDataRef,
  type LocalDataStoredRow,
  type PersonaDomainMetaRow,
  type PersonaObjectRow,
  type RuntimeDomainMetaRow,
  type RuntimeLocalDataObjectKind,
  type RuntimeObjectRow,
  type SpaceDomainMetaRow,
  type SpaceLocalDataObjectKind,
  type SpaceObjectRow,
  getLocalDataRowKey
} from './types';

export type LocalDataHydrationPreviewStatus =
  | 'hydrated'
  | 'blocked'
  | 'delegated'
  | 'ledger-only'
  | 'missing';

export type LocalDataHydrationPreviewSummary = {
  domain: LocalDataDomain;
  status: LocalDataHydrationPreviewStatus;
  rowCount: number;
  completeRowCount: number;
  nonCompleteRowCount: number;
  objectCount: number;
  blockers: string[];
};

export type CollectionHydrationPreview = LocalDataHydrationPreviewSummary & {
  domain: 'collection';
  activeProjectId: string | null;
  state: CollectionLocalDataState | null;
};

export type PersonaHydrationPreview = LocalDataHydrationPreviewSummary & {
  domain: 'persona';
  activeCollaboratorId: string | null;
  seededDefaultPersonaIds: string[];
  state: PersonaLocalDataState | null;
};

export type RuntimeHydrationPreview = LocalDataHydrationPreviewSummary & {
  domain: 'runtime';
  activeProviderId: string | null;
  state: RuntimeLocalDataState | null;
};

export type SpaceHydrationPreview = LocalDataHydrationPreviewSummary & {
  domain: 'space';
  frontstageCollaboratorId: string | null;
  collectionProjectId: string | null;
  state: SpaceLocalDataState | null;
};

export type LedgerHydrationPreview = LocalDataHydrationPreviewSummary & {
  domain: 'asset' | 'document';
  ledgerOnly: true;
  domainMeta: AssetDomainMetaRow | DocumentDomainMetaRow | null;
};

export type ChatHydrationPreview = LocalDataHydrationPreviewSummary & {
  domain: 'chat';
  delegatedTo: 'chatLocalDataPersistence';
};

export type LocalDataStoreHydrationPreview =
  | CollectionHydrationPreview
  | PersonaHydrationPreview
  | RuntimeHydrationPreview
  | SpaceHydrationPreview
  | LedgerHydrationPreview
  | ChatHydrationPreview;

export type LocalDataStoreHydrationPreviewReport = {
  generatedAt: number;
  previews: LocalDataStoreHydrationPreview[];
};

export type LocalDataStoreHydrationPreviewEntry = {
  key: string;
  value: unknown;
};

const STORE_DOMAINS: LocalDataDomain[] = [
  'chat',
  'collection',
  'persona',
  'runtime',
  'space',
  'asset',
  'document'
];

function isLocalDataStoredRow(value: unknown): value is LocalDataStoredRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<LocalDataStoredRow>;
  return typeof row.key === 'string'
    && row.ref !== undefined
    && typeof row.ref === 'object'
    && typeof row.ref.domain === 'string'
    && typeof row.ref.kind === 'string'
    && typeof row.ref.id === 'string'
    && typeof row.version === 'number'
    && typeof row.updatedAt === 'number'
    && typeof row.state === 'string';
}

function isCompleteRow<T>(row: LocalDataStoredRow | null | undefined): row is LocalDataCompleteRow<T> {
  return row?.state === 'complete';
}

function rowsByKey(entries: LocalDataStoreHydrationPreviewEntry[]) {
  const rows = new Map<string, LocalDataStoredRow>();
  entries.forEach((entry) => {
    if (!isLocalDataStoredRow(entry.value)) return;
    if (entry.value.key !== entry.key) return;
    rows.set(entry.key, entry.value);
  });
  return rows;
}

function countRows<D extends LocalDataDomain>(
  domain: D,
  rows: LocalDataStoredRow[],
  blockers: string[]
): LocalDataHydrationPreviewSummary & { domain: D } {
  const completeRowCount = rows.filter((row) => row.state === 'complete').length;
  const nonCompleteRows = rows.filter((row) => row.state !== 'complete' && row.state !== 'deleted');
  // For asset, an incomplete row (preview-only / missing-meta / missing-binary) is a FAITHFUL
  // record of an incomplete source asset, not a torn migration — so it is not a hydration blocker.
  // Every other domain treats an incomplete row as a blocker (a half-migrated object).
  if (domain !== 'asset') {
    blockers.push(...nonCompleteRows.map((row) => `${row.ref.kind}:${row.ref.id}:${row.state}`));
  }
  return {
    domain,
    status: 'missing',
    rowCount: rows.length,
    completeRowCount,
    nonCompleteRowCount: nonCompleteRows.length,
    objectCount: completeRowCount,
    blockers
  };
}

function domainRows(rowMap: Map<string, LocalDataStoredRow>, domain: LocalDataDomain) {
  return Array.from(rowMap.values()).filter((row) => row.ref.domain === domain);
}

function readMetaRow<T>(rowMap: Map<string, LocalDataStoredRow>, ref: LocalDataRef, blockers: string[]) {
  const row = rowMap.get(getLocalDataRowKey(ref));
  if (!row) {
    blockers.push('missing-domain-meta');
    return null;
  }
  if (!isCompleteRow<T>(row)) {
    blockers.push(`domain-meta-${row.state}`);
    return null;
  }
  return row;
}

function basePreview<D extends LocalDataDomain>(
  rowMap: Map<string, LocalDataStoredRow>,
  domain: D,
  blockers: string[]
) {
  const rows = domainRows(rowMap, domain);
  const summary = countRows(domain, rows, blockers);
  return {
    ...summary,
    objectCount: rows.filter((row) => row.ref.kind !== 'domainMeta' && row.state === 'complete').length
  };
}

function objectRows<T extends { kind: string }>(
  rowMap: Map<string, LocalDataStoredRow>,
  domain: LocalDataDomain,
  blockers: string[]
) {
  return domainRows(rowMap, domain)
    .filter((row) => row.ref.kind !== 'domainMeta')
    .flatMap((row) => {
      if (!isCompleteRow<T>(row)) return [];
      if (row.value.kind !== row.ref.kind) {
        blockers.push(`row-kind-mismatch:${row.ref.kind}:${row.ref.id}`);
        return [];
      }
      return [row.value];
    });
}

function statusFor(summary: LocalDataHydrationPreviewSummary, blockers: string[]) {
  if (summary.rowCount === 0) return 'missing';
  return blockers.length > 0 ? 'blocked' : 'hydrated';
}

function previewCollection(rowMap: Map<string, LocalDataStoredRow>): CollectionHydrationPreview {
  const blockers: string[] = [];
  const summary = basePreview(rowMap, 'collection', blockers);
  const metaRow = readMetaRow<CollectionDomainMetaRow>(rowMap, {
    domain: 'collection',
    kind: 'domainMeta',
    id: 'collection'
  }, blockers);
  const rows = objectRows<CollectionObjectRow>(rowMap, 'collection', blockers);
  const state: CollectionLocalDataState = {
    cards: rows.filter((row): row is CollectionObjectRow<'card'> => row.kind === 'card').map((row) => row.value),
    imageCards: rows.filter((row): row is CollectionObjectRow<'image-card'> => row.kind === 'image-card').map((row) => row.value),
    roomProjects: rows.filter((row): row is CollectionObjectRow<'project'> => row.kind === 'project').map((row) => row.value),
    projectFiles: rows.filter((row): row is CollectionObjectRow<'project-file'> => row.kind === 'project-file').map((row) => row.value),
    workspaceReferenceDocs: rows.filter((row): row is CollectionObjectRow<'workspace-doc'> => row.kind === 'workspace-doc').map((row) => row.value),
    deletedBundledCardIds: metaRow?.value.deletedBundledCardIds ?? []
  };
  return {
    ...summary,
    status: statusFor(summary, blockers),
    blockers,
    activeProjectId: metaRow?.value.activeProjectId ?? null,
    state: blockers.length > 0 ? null : state
  };
}

function previewPersona(rowMap: Map<string, LocalDataStoredRow>): PersonaHydrationPreview {
  const blockers: string[] = [];
  const summary = basePreview(rowMap, 'persona', blockers);
  const metaRow = readMetaRow<PersonaDomainMetaRow>(rowMap, {
    domain: 'persona',
    kind: 'domainMeta',
    id: 'persona'
  }, blockers);
  const rows = objectRows<PersonaObjectRow>(rowMap, 'persona', blockers);
  const state: PersonaLocalDataState = {
    personas: rows.map((row) => row.value),
    activeCollaboratorId: metaRow?.value.activeCollaboratorId ?? null,
    seededDefaultPersonaIds: metaRow?.value.seededDefaultPersonaIds ?? []
  };
  return {
    ...summary,
    status: statusFor(summary, blockers),
    blockers,
    activeCollaboratorId: state.activeCollaboratorId,
    seededDefaultPersonaIds: state.seededDefaultPersonaIds,
    state: blockers.length > 0 ? null : state
  };
}

function previewRuntime(rowMap: Map<string, LocalDataStoredRow>): RuntimeHydrationPreview {
  const blockers: string[] = [];
  const summary = basePreview(rowMap, 'runtime', blockers);
  const metaRow = readMetaRow<RuntimeDomainMetaRow>(rowMap, {
    domain: 'runtime',
    kind: 'domainMeta',
    id: 'runtime'
  }, blockers);
  const rows = objectRows<RuntimeObjectRow>(rowMap, 'runtime', blockers);
  const settingsRows = rows.filter((row): row is RuntimeObjectRow<'settings'> => row.kind === 'settings');
  if (settingsRows.length !== 1) blockers.push(`settings-row-count:${settingsRows.length}`);
  const settings = settingsRows[0]?.value;
  const state: RuntimeLocalDataState | null = settings ? {
    providers: rows.filter((row): row is RuntimeObjectRow<'provider'> => row.kind === 'provider').map((row) => row.value),
    activeProviderId: metaRow?.value.activeProviderId ?? null,
    webdav: settings.webdav,
    search: settings.search,
    conversationSummaryModel: settings.conversationSummaryModel,
    memoryVectorRetrieval: settings.memoryVectorRetrieval,
    imageGeneration: settings.imageGeneration,
    imageUnderstanding: settings.imageUnderstanding,
    voiceGeneration: settings.voiceGeneration,
    toolPromptPreferences: settings.toolPromptPreferences,
    taskModeEnabled: settings.taskModeEnabled,
    mcpServers: rows.filter((row): row is RuntimeObjectRow<'mcp-server'> => row.kind === 'mcp-server').map((row) => row.value),
    mcpToolTimeoutSeconds: settings.mcpToolTimeoutSeconds,
    companionHost: settings.companionHost,
    companionConnections: rows.filter((row): row is RuntimeObjectRow<'companion-connection'> => row.kind === 'companion-connection').map((row) => row.value),
    triggerRules: rows.filter((row): row is RuntimeObjectRow<'trigger-rule'> => row.kind === 'trigger-rule').map((row) => row.value)
  } : null;
  return {
    ...summary,
    status: statusFor(summary, blockers),
    blockers,
    activeProviderId: state?.activeProviderId ?? null,
    state: blockers.length > 0 ? null : state
  };
}

function requireSingleSpaceRow<K extends SpaceLocalDataObjectKind>(
  rows: SpaceObjectRow[],
  kind: K,
  blockers: string[]
) {
  const matches = rows.filter((row): row is SpaceObjectRow<K> => row.kind === kind);
  if (matches.length !== 1) blockers.push(`${kind}-row-count:${matches.length}`);
  return matches[0] ?? null;
}

function reassembleSpaceSavedSkins(
  themeRow: SpaceObjectRow<'theme'>,
  rows: SpaceObjectRow[],
  blockers: string[]
): SavedSkin[] {
  const skinRowsById = new Map<string, SavedSkin>();
  for (const row of rows.filter((candidate): candidate is SpaceObjectRow<'skin'> => candidate.kind === 'skin')) {
    skinRowsById.set(row.value.id, row.value.value);
  }
  // The theme row's `savedSkinOrder` is the authoritative library order; the skin rows are
  // the bodies. A referenced skin id without a row is a torn write, surfaced as a blocker
  // (not silently dropped). Skin rows not in the order are ignored — the next ordinary save
  // tombstones them through the value diff.
  const savedSkins: SavedSkin[] = [];
  for (const skinId of themeRow.value.savedSkinOrder) {
    const skin = skinRowsById.get(skinId);
    if (!skin) {
      blockers.push(`skin-row-missing:${skinId}`);
      continue;
    }
    savedSkins.push(skin);
  }
  return savedSkins;
}

function previewSpace(rowMap: Map<string, LocalDataStoredRow>): SpaceHydrationPreview {
  const blockers: string[] = [];
  const summary = basePreview(rowMap, 'space', blockers);
  const metaRow = readMetaRow<SpaceDomainMetaRow>(rowMap, {
    domain: 'space',
    kind: 'domainMeta',
    id: 'space'
  }, blockers);
  const rows = objectRows<SpaceObjectRow>(rowMap, 'space', blockers);
  const frontstage = requireSingleSpaceRow(rows, 'frontstage', blockers);
  const theme = requireSingleSpaceRow(rows, 'theme', blockers);
  const customization = requireSingleSpaceRow(rows, 'customization', blockers);
  const collaboratorThemes = rows
    .filter((row): row is SpaceObjectRow<'collaborator-theme'> => row.kind === 'collaborator-theme')
    .reduce<SpaceLocalDataState['collaboratorThemes']>((sessions, row) => {
      sessions[row.value.collaboratorId] = {
        theme: row.value.theme,
        customization: row.value.customization
      };
      return sessions;
    }, {});
  const savedSkins = theme ? reassembleSpaceSavedSkins(theme, rows, blockers) : [];
  const state: SpaceLocalDataState | null = frontstage && theme && customization ? {
    activeWorld: frontstage.value.activeWorld,
    collectionShelf: frontstage.value.collectionShelf,
    frontstageCollaboratorId: frontstage.value.frontstageCollaboratorId,
    collectionProjectId: frontstage.value.collectionProjectId,
    editingCollaboratorId: frontstage.value.editingCollaboratorId,
    screenshotDebugOverlayEnabled: frontstage.value.screenshotDebugOverlayEnabled,
    appLanguage: frontstage.value.appLanguage,
    displayPreferences: frontstage.value.displayPreferences,
    activeCardId: frontstage.value.activeCardId,
    // The saved-skin library is reassembled from skin rows in the stored order.
    theme: { ...theme.value.value, savedSkins },
    customization: customization.value.value,
    collaboratorThemes
  } : null;
  return {
    ...summary,
    status: statusFor(summary, blockers),
    blockers,
    frontstageCollaboratorId: metaRow?.value.frontstageCollaboratorId ?? null,
    collectionProjectId: metaRow?.value.collectionProjectId ?? null,
    state: blockers.length > 0 ? null : state
  };
}

function previewLedger(
  rowMap: Map<string, LocalDataStoredRow>,
  domain: 'asset' | 'document'
): LedgerHydrationPreview {
  const blockers: string[] = [];
  const summary = basePreview(rowMap, domain, blockers);
  const metaRow = readMetaRow<AssetDomainMetaRow | DocumentDomainMetaRow>(rowMap, {
    domain,
    kind: 'domainMeta',
    id: domain
  }, blockers);
  return {
    ...summary,
    status: summary.rowCount === 0 ? 'missing' : blockers.length > 0 ? 'blocked' : 'ledger-only',
    blockers,
    ledgerOnly: true,
    domainMeta: metaRow?.value ?? null
  };
}

function previewChat(rowMap: Map<string, LocalDataStoredRow>): ChatHydrationPreview {
  const blockers: string[] = [];
  const summary = basePreview(rowMap, 'chat', blockers);
  return {
    ...summary,
    status: 'delegated',
    blockers,
    delegatedTo: 'chatLocalDataPersistence'
  };
}

export function previewLocalDataStoreHydration(
  entries: LocalDataStoreHydrationPreviewEntry[],
  domains: LocalDataDomain[] = STORE_DOMAINS
): LocalDataStoreHydrationPreviewReport {
  const rowMap = rowsByKey(entries);
  return {
    generatedAt: Date.now(),
    previews: domains.map((domain) => {
      switch (domain) {
        case 'chat':
          return previewChat(rowMap);
        case 'collection':
          return previewCollection(rowMap);
        case 'persona':
          return previewPersona(rowMap);
        case 'runtime':
          return previewRuntime(rowMap);
        case 'space':
          return previewSpace(rowMap);
        case 'asset':
        case 'document':
          return previewLedger(rowMap, domain);
      }
    })
  };
}

export function expectedLocalDataObjectKindsForHydration(domain: LocalDataDomain) {
  const objectKinds: Record<LocalDataDomain, string[]> = {
    asset: ['asset'],
    chat: ['catalog', 'record'],
    collection: ['card', 'image-card', 'project', 'project-file', 'workspace-doc'] satisfies CollectionLocalDataObjectKind[],
    document: ['persona-memory-doc', 'workspace-reference-doc', 'orphan-body'],
    persona: ['collaborator'],
    runtime: ['settings', 'provider', 'mcp-server', 'companion-connection', 'trigger-rule'] satisfies RuntimeLocalDataObjectKind[],
    space: ['frontstage', 'theme', 'customization', 'collaborator-theme', 'skin'] satisfies SpaceLocalDataObjectKind[]
  };
  return objectKinds[domain];
}
