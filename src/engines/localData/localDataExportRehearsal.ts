import JSZip from 'jszip';
import { buildLocalDataCensusReport, type LocalDataCensusReport } from './localDataCensusReport';
import type { LocalDataCensusReportSource } from './localDataCensusReportTypes';
import type { PersistedKvEntry } from '../../infrastructure/persistence';
import type { StoredAssetMeta } from '../../infrastructure/assetStore';
import { serializeChatStateEntries, type PersistedChatState } from '../../stores/chatCurrentPersistence';
import type { PersistedCollectionState } from '../../stores/collectionStorePersistence';
import { repairCollectionProjectTopology } from '../../stores/collectionStoreProjectTopology';
import {
  buildWorkspaceReferenceDocContentPayload,
  serializeWorkspaceReferenceDocContentEntries,
  stripWorkspaceReferenceDocContent
} from '../../stores/workspaceReferenceDocContentPersistence';
import {
  serializePersonaMemoryDocContentEntries,
  type PersonaMemoryDocContentPayload
} from '../../stores/personaMemoryReferenceDocPersistence';
import { migratePersistedPersonaPayload } from '../../stores/personaStore';
import { normalizeRuntimePayload, type RuntimePayload } from '../../stores/runtimeStorePersistence';
import {
  migratePersistedSpaceState,
  serializePersistedSpaceLocalState,
  serializePersistedSpaceThemeState,
  SPACE_THEME_STATE_KEY,
  type PersistedSpaceState
} from '../../stores/spaceStorePersistence';
import { normalizeAppCustomization } from '../../stores/runtimeStoreCustomization';
import {
  ASSET_INDEX_PATH,
  PERSONA_MEMORY_DOC_CONTENT_PATH,
  SPACE_STORE_KEY,
  SPACE_STORE_VERSION,
  type AssetIndexEntry,
  type ExportManifest
} from '../../stores/storeExportPackage';
import type { Persona, ProjectFile, WorkspaceReferenceDoc } from '../../types/domain';

type PersistedPersonaState = {
  personas: Persona[];
  activeCollaboratorId: string | null;
  editingCollaboratorId?: string | null;
  seededDefaultPersonaIds?: string[];
};

export type LocalDataExportZipTextFile = {
  async: (type: 'string') => Promise<string>;
};

export type LocalDataExportZipReader = {
  file: (path: string) => LocalDataExportZipTextFile | null;
};

export type LocalDataExportRehearsal = {
  manifest: ExportManifest;
  source: LocalDataCensusReportSource;
  spaceState: ReturnType<typeof migratePersistedSpaceState>;
  chatState: PersistedChatState;
  collectionState: PersistedCollectionState;
  personaState: PersistedPersonaState;
  personaMemoryDocContent: PersonaMemoryDocContentPayload | null;
  runtimeState: RuntimePayload;
  assetIndex: AssetIndexEntry[];
};

function ensureObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 缺少或格式不正确`);
  }
}

function parseJsonFile<T>(content: string, label: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`${label} 格式不正确`);
  }
}

async function readZipTextFile(zip: LocalDataExportZipReader, path: string, label: string) {
  const file = zip.file(path);
  if (!file) throw new Error(`导出包缺少 ${label}`);
  return await file.async('string');
}

function validateManifest(value: unknown): ExportManifest {
  ensureObject(value, 'manifest');
  const manifest = value as Partial<ExportManifest>;
  if (manifest.format !== 'polaris-export' || manifest.version !== 1) {
    throw new Error('这不是 Polaris 的正式导出包');
  }
  if (
    manifest.stores?.space !== 'stores/space.json'
    || manifest.stores?.chat !== 'stores/chat.json'
    || manifest.stores?.collection !== 'stores/collection.json'
    || manifest.stores?.persona !== 'stores/persona.json'
    || (
      manifest.stores?.personaMemoryDocContent !== undefined
      && manifest.stores.personaMemoryDocContent !== PERSONA_MEMORY_DOC_CONTENT_PATH
    )
    || manifest.stores?.runtime !== 'stores/runtime.json'
    || manifest.assets?.index !== ASSET_INDEX_PATH
  ) {
    throw new Error('导出包缺少必要索引');
  }
  return manifest as ExportManifest;
}

function validateChatState(value: unknown): PersistedChatState {
  ensureObject(value, 'chat store');
  const payload = value as Partial<PersistedChatState>;
  if (!Array.isArray(payload.conversations)) throw new Error('chat store 缺少 conversations');
  return {
    conversations: payload.conversations,
    activeConversationId:
      typeof payload.activeConversationId === 'string' || payload.activeConversationId === null
        ? payload.activeConversationId
        : null
  };
}

function validateCollectionState(value: unknown): PersistedCollectionState {
  ensureObject(value, 'collection store');
  const payload = value as Partial<PersistedCollectionState> & { activeCardId?: string | null };
  if (!Array.isArray(payload.cards) || !Array.isArray(payload.imageCards)) {
    throw new Error('collection store 缺少必要字段');
  }
  return repairCollectionProjectTopology({
    cards: payload.cards,
    projectFiles: Array.isArray(payload.projectFiles) ? payload.projectFiles as ProjectFile[] : [],
    workspaceReferenceDocs: Array.isArray(payload.workspaceReferenceDocs)
      ? payload.workspaceReferenceDocs as WorkspaceReferenceDoc[]
      : [],
    roomProjects: Array.isArray(payload.roomProjects) ? payload.roomProjects : [],
    imageCards: payload.imageCards,
    deletedBundledCardIds: Array.isArray(payload.deletedBundledCardIds)
      ? payload.deletedBundledCardIds.filter((id): id is string => typeof id === 'string')
      : []
  });
}

function validatePersonaState(value: unknown): PersistedPersonaState {
  ensureObject(value, 'persona store');
  const payload = value as Partial<PersistedPersonaState>;
  if (!Array.isArray(payload.personas)) throw new Error('persona store 缺少 personas');
  const migrated = migratePersistedPersonaPayload({
    personas: payload.personas,
    seededDefaultPersonaIds: payload.seededDefaultPersonaIds
  });
  return {
    personas: migrated.personas,
    activeCollaboratorId:
      typeof payload.activeCollaboratorId === 'string' || payload.activeCollaboratorId === null
        ? payload.activeCollaboratorId
        : null,
    editingCollaboratorId:
      typeof payload.editingCollaboratorId === 'string' || payload.editingCollaboratorId === null
        ? payload.editingCollaboratorId
        : undefined,
    seededDefaultPersonaIds: migrated.seededDefaultPersonaIds
  };
}

function validatePersonaMemoryDocContent(value: unknown): PersonaMemoryDocContentPayload {
  ensureObject(value, 'persona memory doc content');
  const payload = value as Partial<PersonaMemoryDocContentPayload>;
  return {
    version: 1,
    docs: payload.docs && typeof payload.docs === 'object' && !Array.isArray(payload.docs)
      ? Object.fromEntries(
          Object.entries(payload.docs)
            .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
        )
      : {}
  };
}

function validateRuntimeState(value: unknown): RuntimePayload {
  ensureObject(value, 'runtime store');
  const payload = value as Partial<RuntimePayload>;
  if (!Array.isArray(payload.providers)) throw new Error('runtime store 缺少 providers');
  return normalizeRuntimePayload(payload);
}

function validateAssetIndex(value: unknown): AssetIndexEntry[] {
  if (!Array.isArray(value)) throw new Error('资产索引格式不正确');
  return value.map((entry) => {
    ensureObject(entry, '资产索引项');
    const asset = entry as Partial<AssetIndexEntry>;
    if (
      typeof asset.id !== 'string'
      || (asset.kind !== 'image' && asset.kind !== 'file')
      || typeof asset.name !== 'string'
      || typeof asset.mimeType !== 'string'
      || typeof asset.filePath !== 'string'
    ) {
      throw new Error('资产索引缺少必要字段');
    }
    return {
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      mimeType: asset.mimeType,
      size: typeof asset.size === 'number' ? asset.size : 0,
      createdAt: typeof asset.createdAt === 'number' ? asset.createdAt : Date.now(),
      textContent: typeof asset.textContent === 'string' ? asset.textContent : undefined,
      filePath: asset.filePath,
      previewPath: typeof asset.previewPath === 'string' ? asset.previewPath : undefined
    };
  });
}

function buildAssetPresenceEntries(assetIndex: AssetIndexEntry[]) {
  return {
    assetMeta: assetIndex.map((asset) => ({
      key: asset.id,
      value: {
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        createdAt: asset.createdAt,
        textContent: asset.textContent
      } satisfies StoredAssetMeta
    })),
    assetBinary: assetIndex.map((asset) => ({ key: asset.id, value: new Blob([], { type: asset.mimeType }) })),
    assetPreview: assetIndex
      .filter((asset) => asset.previewPath)
      .map((asset) => ({ key: asset.id, value: new Blob([], { type: 'image/jpeg' }) }))
  };
}

function resolveImportedSpaceState(args: {
  spaceState: PersistedSpaceState;
  personaState: PersistedPersonaState;
  parsedRuntimeState: Partial<RuntimePayload> & {
    screenshotDebugOverlayEnabled?: boolean;
    customization?: Partial<PersistedSpaceState['customization']>;
  };
  importedActiveCardId: string | null;
}) {
  const importedSpaceState = {
    ...args.spaceState,
    editingCollaboratorId:
      typeof args.spaceState.editingCollaboratorId === 'string' || args.spaceState.editingCollaboratorId === null
        ? args.spaceState.editingCollaboratorId
        : typeof args.personaState.editingCollaboratorId === 'string' || args.personaState.editingCollaboratorId === null
          ? args.personaState.editingCollaboratorId
          : null,
    screenshotDebugOverlayEnabled:
      typeof args.spaceState.screenshotDebugOverlayEnabled === 'boolean'
        ? args.spaceState.screenshotDebugOverlayEnabled
        : args.parsedRuntimeState.screenshotDebugOverlayEnabled === true,
    customization: args.spaceState.customization
      ? normalizeAppCustomization(args.spaceState.customization)
      : normalizeAppCustomization(args.parsedRuntimeState.customization),
    activeCardId: typeof args.spaceState.activeCardId === 'string' ? args.spaceState.activeCardId : args.importedActiveCardId
  } satisfies PersistedSpaceState;
  return migratePersistedSpaceState(importedSpaceState);
}

function buildRehearsalSource(args: {
  spaceState: ReturnType<typeof migratePersistedSpaceState>;
  chatState: PersistedChatState;
  collectionState: PersistedCollectionState;
  personaState: PersistedPersonaState;
  personaMemoryDocContent: PersonaMemoryDocContentPayload | null;
  runtimeState: RuntimePayload;
  assetIndex: AssetIndexEntry[];
}): LocalDataCensusReportSource {
  const kv: PersistedKvEntry[] = [
    ...serializeChatStateEntries(args.chatState),
    {
      key: 'collection-state-v2',
      value: {
        ...args.collectionState,
        workspaceReferenceDocs: stripWorkspaceReferenceDocContent(args.collectionState.workspaceReferenceDocs)
      }
    },
    ...serializeWorkspaceReferenceDocContentEntries(
      buildWorkspaceReferenceDocContentPayload(args.collectionState.workspaceReferenceDocs)
    ),
    { key: 'persona-state-v2', value: args.personaState },
    ...serializePersonaMemoryDocContentEntries(args.personaMemoryDocContent),
    { key: 'runtime-providers-v2', value: args.runtimeState },
    { key: SPACE_THEME_STATE_KEY, value: serializePersistedSpaceThemeState(args.spaceState) }
  ];
  const assets = buildAssetPresenceEntries(args.assetIndex);

  return {
    kv,
    ...assets,
    localStorage: [{
      key: SPACE_STORE_KEY,
      value: JSON.stringify({
        state: serializePersistedSpaceLocalState(args.spaceState),
        version: SPACE_STORE_VERSION
      })
    }]
  };
}

export async function buildLocalDataExportRehearsalFromZipReader(
  zip: LocalDataExportZipReader
): Promise<LocalDataExportRehearsal> {
  const manifest = validateManifest(
    parseJsonFile(await readZipTextFile(zip, 'manifest.json', 'manifest.json'), 'manifest.json')
  );
  const spaceState = parseJsonFile<PersistedSpaceState>(
    await readZipTextFile(zip, manifest.stores.space, manifest.stores.space),
    manifest.stores.space
  );
  const chatState = validateChatState(
    parseJsonFile(await readZipTextFile(zip, manifest.stores.chat, manifest.stores.chat), manifest.stores.chat)
  );
  const collectionStateContent = await readZipTextFile(zip, manifest.stores.collection, manifest.stores.collection);
  const parsedCollectionState = parseJsonFile<Partial<PersistedCollectionState> & { activeCardId?: string | null }>(
    collectionStateContent,
    manifest.stores.collection
  );
  const collectionState = validateCollectionState(parsedCollectionState);
  const personaState = validatePersonaState(
    parseJsonFile(await readZipTextFile(zip, manifest.stores.persona, manifest.stores.persona), manifest.stores.persona)
  );
  const personaMemoryDocContent = manifest.stores.personaMemoryDocContent
    ? validatePersonaMemoryDocContent(
        parseJsonFile(
          await readZipTextFile(zip, manifest.stores.personaMemoryDocContent, manifest.stores.personaMemoryDocContent),
          manifest.stores.personaMemoryDocContent
        )
      )
    : null;
  const runtimeText = await readZipTextFile(zip, manifest.stores.runtime, manifest.stores.runtime);
  const parsedRuntimeState = parseJsonFile<Partial<RuntimePayload> & {
    screenshotDebugOverlayEnabled?: boolean;
    customization?: Partial<PersistedSpaceState['customization']>;
  }>(runtimeText, manifest.stores.runtime);
  const runtimeState = validateRuntimeState(parsedRuntimeState);
  const assetIndex = validateAssetIndex(
    parseJsonFile(await readZipTextFile(zip, manifest.assets.index, manifest.assets.index), manifest.assets.index)
  );
  if (assetIndex.length !== manifest.assets.count) throw new Error('导出包资产数量不一致');
  const importedSpaceState = resolveImportedSpaceState({
    spaceState,
    personaState,
    parsedRuntimeState,
    importedActiveCardId: typeof parsedCollectionState.activeCardId === 'string' ? parsedCollectionState.activeCardId : null
  });

  const source = buildRehearsalSource({
    spaceState: importedSpaceState,
    chatState,
    collectionState,
    personaState,
    personaMemoryDocContent,
    runtimeState,
    assetIndex
  });

  return {
    manifest,
    source,
    spaceState: importedSpaceState,
    chatState,
    collectionState,
    personaState,
    personaMemoryDocContent,
    runtimeState,
    assetIndex
  };
}

export async function buildLocalDataExportRehearsalFromZipBuffer(
  buffer: ArrayBuffer | Uint8Array
): Promise<LocalDataExportRehearsal> {
  return await buildLocalDataExportRehearsalFromZipReader(await JSZip.loadAsync(buffer));
}

export async function buildLocalDataCensusReportFromExportZipBuffer(
  buffer: ArrayBuffer | Uint8Array
): Promise<LocalDataCensusReport> {
  const rehearsal = await buildLocalDataExportRehearsalFromZipBuffer(buffer);
  return buildLocalDataCensusReport(rehearsal.source);
}
