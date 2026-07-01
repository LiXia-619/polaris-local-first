import {
  replaceAssetEntries,
  type AssetExportEntry,
  type StoredAssetMeta
} from '../infrastructure/assetStore';
import { flushPageLifecycleHandlers } from '../infrastructure/pageLifecycleFlush';
import {
  kvReplaceAll,
  type PersistedKvEntry
} from '../infrastructure/persistence';
import type { PersistedChatState } from './chatCurrentPersistence';
import type { PersistedCollectionState } from './collectionStorePersistence';
import {
  type PersonaMemoryDocContentPayload
} from './personaMemoryReferenceDocPersistence';
import type { RuntimePayload } from './runtimeStorePersistence';
import { normalizeRuntimePayload } from './runtimeStorePersistence';
import type { PersistedSpaceState } from './spaceStorePersistence';
import {
  SPACE_THEME_STATE_KEY,
  migratePersistedSpaceState,
  serializePersistedSpaceLocalState,
  serializePersistedSpaceThemeState
} from './spaceStorePersistence';
import { normalizeAppCustomization } from './runtimeStoreCustomization';
import { migrateLegacyProjectCards } from './collectionStoreProjectFiles';
import { normalizeWorkspaceReferenceDoc } from './collectionStoreWorkspaceReferences';
import { repairCollectionProjectTopology } from './collectionStoreProjectTopology';
import { applyImportedPersistedStores } from './storeImportApply';
import { clearLegacyLocalDataKvShadowIfStoreBackendInstalled } from './localDataLegacyKvShadowCleanup';
import { restoreStructuredImportToLocalDataRepository } from './storeImportLocalDataRestore';
import { LOCAL_DATA_NAMESPACE } from '../engines/localData';
import {
  ASSET_INDEX_PATH,
  PERSONA_MEMORY_DOC_CONTENT_PATH,
  SPACE_STORE_KEY,
  SPACE_STORE_VERSION,
  type AssetIndexEntry,
  type ExportManifest
} from './storeExportPackage';
import type { StoreImportProgressReporter } from './storeImportProgress';
import type { Persona, ProjectFile, WorkspaceReferenceDoc } from '../types/domain';
import {
  clearImportRollbackFile,
  readImportRollbackFile
} from '../native/importRollbackFile';
import { clearStoreLocalDataEntriesWithPrefix } from './storeLocalDataBackendHost';

const LOCAL_STORAGE_PREFIX = 'polaris';
const ASSET_READ_CONCURRENCY = 4;

type ImportStructuredExportPackageOptions = {
  onProgress?: StoreImportProgressReporter;
};

type PersistedPersonaState = {
  personas: Persona[];
  activeCollaboratorId: string | null;
  editingCollaboratorId?: string | null;
  seededDefaultPersonaIds?: string[];
};

type ZipTextOrBlobFile = {
  async: (type: 'string' | 'blob') => Promise<string | Blob>;
};

type ZipReader = {
  file: (path: string) => ZipTextOrBlobFile | null;
};

export type ImportLocalStorageEntry = {
  key: string;
  value: string;
};

type ImportRollbackScope = {
  kv: boolean;
  localStorage: boolean;
  assets: boolean;
};

const IMPORT_ROLLBACK_MANIFEST_PATH = 'rollback/manifest.json';
const IMPORT_ROLLBACK_KV_PATH = 'rollback/kv.json';
const IMPORT_ROLLBACK_LOCAL_STORAGE_PATH = 'rollback/localStorage.json';
const IMPORT_ROLLBACK_ASSET_INDEX_PATH = 'rollback/assets.json';

function clearPolarisLocalStorage() {
  if (typeof window === 'undefined') return;

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}

function replacePolarisLocalStorage(entries: ImportLocalStorageEntry[]) {
  if (typeof window === 'undefined') return;
  clearPolarisLocalStorage();
  for (const entry of entries) {
    window.localStorage.setItem(entry.key, entry.value);
  }
}

async function replaceKvEntries(entries: PersistedKvEntry[]) {
  await kvReplaceAll(entries);
}

async function readImportRollbackZip(blob: Blob): Promise<{
  kvEntries: PersistedKvEntry[];
  localStorageEntries: ImportLocalStorageEntry[];
  assetEntries: AssetExportEntry[];
}> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const manifest = parseJsonFile<Record<string, unknown>>(
    await readZipTextFile(zip, IMPORT_ROLLBACK_MANIFEST_PATH, IMPORT_ROLLBACK_MANIFEST_PATH),
    IMPORT_ROLLBACK_MANIFEST_PATH
  );
  if (manifest.format !== 'polaris-import-rollback' || manifest.version !== 1) {
    throw new Error('导入回滚包格式不正确。');
  }
  const kvEntries = parseJsonFile<PersistedKvEntry[]>(
    await readZipTextFile(zip, IMPORT_ROLLBACK_KV_PATH, IMPORT_ROLLBACK_KV_PATH),
    IMPORT_ROLLBACK_KV_PATH
  );
  const localStorageEntries = parseJsonFile<ImportLocalStorageEntry[]>(
    await readZipTextFile(zip, IMPORT_ROLLBACK_LOCAL_STORAGE_PATH, IMPORT_ROLLBACK_LOCAL_STORAGE_PATH),
    IMPORT_ROLLBACK_LOCAL_STORAGE_PATH
  );
  const assetIndex = parseJsonFile<Array<{
    meta: StoredAssetMeta;
    binaryPath: string;
    previewPath?: string;
  }>>(
    await readZipTextFile(zip, IMPORT_ROLLBACK_ASSET_INDEX_PATH, IMPORT_ROLLBACK_ASSET_INDEX_PATH),
    IMPORT_ROLLBACK_ASSET_INDEX_PATH
  );
  const assetEntries = await mapWithConcurrency(assetIndex, ASSET_READ_CONCURRENCY, async (entry) => ({
    meta: entry.meta,
    blob: await readZipBlobFile(zip, entry.binaryPath, entry.binaryPath),
    previewBlob: entry.previewPath ? await readZipBlobFile(zip, entry.previewPath, entry.previewPath) : null
  }));

  return {
    kvEntries,
    localStorageEntries,
    assetEntries
  };
}

async function restoreImportRollbackZip(
  blob: Blob,
  scope: ImportRollbackScope = { kv: true, localStorage: true, assets: true }
): Promise<void> {
  const rollback = await readImportRollbackZip(blob);
  const failures: string[] = [];
  if (scope.kv) {
    try {
      await replaceKvEntries(rollback.kvEntries);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (scope.localStorage) {
    try {
      replacePolarisLocalStorage(rollback.localStorageEntries);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (scope.assets) {
    try {
      await replaceAssetEntries(rollback.assetEntries);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (failures.length > 0) {
    throw new Error(`导入失败后回滚旧数据也失败：${failures.join('；')}`);
  }
}

export async function recoverPendingStructuredImportRollback() {
  const rollbackFile = await readImportRollbackFile();
  if (!rollbackFile) return false;
  await restoreImportRollbackZip(rollbackFile);
  await clearImportRollbackFile();
  return true;
}

async function refreshImportedStoresBestEffort() {
  try {
    await applyImportedPersistedStores();
  } catch {
    // Persisted data is already replaced; the next hydration pass can read it again.
  }
}

function formatSkippedImportDomains(
  skippedDomains: Array<{ domain: string; reason: string }>
) {
  return skippedDomains
    .map((entry) => `${entry.domain}: ${entry.reason}`)
    .join('；');
}

function formatPromotionSkippedImportDomains(
  skippedDomains: Array<{ domain: string; status: string; reasons: string[] }>
) {
  return skippedDomains
    .map((entry) => `${entry.domain}: ${entry.status}${entry.reasons.length > 0 ? ` (${entry.reasons.join(', ')})` : ''}`)
    .join('；');
}

export async function importPersistedDataDirectly(params: {
  kvEntries: PersistedKvEntry[];
  localStorageEntries: ImportLocalStorageEntry[];
  assetEntries: AssetExportEntry[];
  onProgress?: StoreImportProgressReporter;
}) {
  params.onProgress?.({ message: '收束未保存数据' });
  await flushPageLifecycleHandlers();
  params.onProgress?.({ message: '写入对话和设置' });
  await replaceKvEntries(params.kvEntries);
  replacePolarisLocalStorage(params.localStorageEntries);
  params.onProgress?.({
    message: params.assetEntries.length > 0 ? '写入附件' : '刷新导入结果',
    current: params.assetEntries.length > 0 ? 0 : undefined,
    total: params.assetEntries.length > 0 ? params.assetEntries.length : undefined
  });
  await replaceAssetEntries(params.assetEntries, {
    onProgress: (current, total) => params.onProgress?.({ message: '写入附件', current, total })
  });
  params.onProgress?.({ message: '刷新导入结果' });
  await refreshImportedStoresBestEffort();
  await clearImportRollbackFile();
}

function parseJsonFile<T>(content: string, label: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`${label} 格式不正确`);
  }
}

function ensureObject(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 缺少或格式不正确`);
  }
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
  ) {
    throw new Error('导出包缺少必要 stores 索引');
  }
  if (manifest.assets?.index !== ASSET_INDEX_PATH) {
    throw new Error('导出包缺少资产索引');
  }
  return manifest as ExportManifest;
}

function validateSpaceState(value: unknown): PersistedSpaceState {
  ensureObject(value, 'space store');
  return value as PersistedSpaceState;
}

function validateChatState(value: unknown): PersistedChatState {
  ensureObject(value, 'chat store');
  const payload = value as Partial<PersistedChatState>;
  if (!Array.isArray(payload.conversations)) {
    throw new Error('chat store 缺少 conversations');
  }
  return {
    conversations: payload.conversations,
    activeConversationId:
      typeof payload.activeConversationId === 'string' || payload.activeConversationId === null
        ? payload.activeConversationId
        : null,
    loadedConversationIds: Array.isArray(payload.loadedConversationIds)
      ? payload.loadedConversationIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    recoveredConversationIds: Array.isArray(payload.recoveredConversationIds)
      ? payload.recoveredConversationIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    quarantinedConversationIds: Array.isArray(payload.quarantinedConversationIds)
      ? payload.quarantinedConversationIds.filter((id): id is string => typeof id === 'string')
      : undefined
  };
}

function validateCollectionState(value: unknown): PersistedCollectionState {
  ensureObject(value, 'collection store');
  const payload = value as Partial<PersistedCollectionState> & { activeCardId?: string | null };
  if (!Array.isArray(payload.cards) || !Array.isArray(payload.imageCards)) {
    throw new Error('collection store 缺少必要字段');
  }
  const migrated = migrateLegacyProjectCards({
    cards: payload.cards,
    projectFiles: Array.isArray(payload.projectFiles) ? payload.projectFiles as ProjectFile[] : []
  });
  return repairCollectionProjectTopology({
    cards: migrated.cards,
    projectFiles: migrated.projectFiles,
    workspaceReferenceDocs: Array.isArray(payload.workspaceReferenceDocs)
      ? (payload.workspaceReferenceDocs as WorkspaceReferenceDoc[])
          .map((doc) => normalizeWorkspaceReferenceDoc(doc))
          .filter((doc) => doc.projectId)
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
  if (!Array.isArray(payload.personas)) {
    throw new Error('persona store 缺少 personas');
  }
  return {
    personas: payload.personas,
    activeCollaboratorId:
      typeof payload.activeCollaboratorId === 'string' || payload.activeCollaboratorId === null
        ? payload.activeCollaboratorId
        : null,
    editingCollaboratorId:
      typeof payload.editingCollaboratorId === 'string' || payload.editingCollaboratorId === null
        ? payload.editingCollaboratorId
        : undefined,
    seededDefaultPersonaIds: Array.isArray(payload.seededDefaultPersonaIds)
      ? payload.seededDefaultPersonaIds.filter((id): id is string => typeof id === 'string')
      : undefined
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
  if (!Array.isArray(payload.providers)) {
    throw new Error('runtime store 缺少 providers');
  }
  return normalizeRuntimePayload(payload);
}

function validateAssetIndex(value: unknown): AssetIndexEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('资产索引格式不正确');
  }

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

async function readZipTextFile(zip: ZipReader, path: string, label: string) {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`导出包缺少 ${label}`);
  }
  return await file.async('string') as string;
}

async function readZipBlobFile(zip: ZipReader, path: string, label: string) {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`导出包缺少 ${label}`);
  }
  return await file.async('blob') as Blob;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

async function readAssetEntriesFromExportZip(
  zip: ZipReader,
  assetIndex: AssetIndexEntry[],
  onProgress?: StoreImportProgressReporter
) {
  let completedAssetReads = 0;
  onProgress?.({
    message: assetIndex.length > 0 ? '读取附件' : '准备写入数据',
    current: assetIndex.length > 0 ? 0 : undefined,
    total: assetIndex.length > 0 ? assetIndex.length : undefined
  });
  return await mapWithConcurrency(
    assetIndex,
    ASSET_READ_CONCURRENCY,
    async (asset): Promise<AssetExportEntry> => {
      const entry = {
        meta: {
          id: asset.id,
          kind: asset.kind,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
          createdAt: asset.createdAt,
          textContent: asset.textContent
        } satisfies StoredAssetMeta,
        blob: await readZipBlobFile(zip, asset.filePath, asset.filePath),
        previewBlob: asset.previewPath ? await readZipBlobFile(zip, asset.previewPath, asset.previewPath) : null
      };
      completedAssetReads += 1;
      onProgress?.({ message: '读取附件', current: completedAssetReads, total: assetIndex.length });
      return entry;
    }
  );
}

export async function importStructuredExportPackage(
  file: Blob,
  options: ImportStructuredExportPackageOptions = {}
): Promise<void> {
  const { default: JSZip } = await import('jszip');
  options.onProgress?.({ message: '读取备份包' });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  options.onProgress?.({ message: '解析备份结构' });
  const manifest = validateManifest(
    parseJsonFile(await readZipTextFile(zip, 'manifest.json', 'manifest.json'), 'manifest.json')
  );
  const spaceState = validateSpaceState(
    parseJsonFile(await readZipTextFile(zip, manifest.stores.space, manifest.stores.space), manifest.stores.space)
  );
  const collectionStateContent = await readZipTextFile(zip, manifest.stores.collection, manifest.stores.collection);
  const parsedCollectionState = parseJsonFile<Partial<PersistedCollectionState> & { activeCardId?: string | null }>(
    collectionStateContent,
    manifest.stores.collection
  );
  const chatState = validateChatState(
    parseJsonFile(await readZipTextFile(zip, manifest.stores.chat, manifest.stores.chat), manifest.stores.chat)
  );
  const collectionState = validateCollectionState(
    parsedCollectionState
  );
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
  const runtimeState = validateRuntimeState(
    parseJsonFile(await readZipTextFile(zip, manifest.stores.runtime, manifest.stores.runtime), manifest.stores.runtime)
  );
  const parsedRuntimeState = parseJsonFile<Partial<RuntimePayload> & {
    screenshotDebugOverlayEnabled?: boolean;
    customization?: Partial<PersistedSpaceState['customization']>;
  }>(
    await readZipTextFile(zip, manifest.stores.runtime, manifest.stores.runtime),
    manifest.stores.runtime
  );
  const assetIndex = validateAssetIndex(
    parseJsonFile(await readZipTextFile(zip, manifest.assets.index, manifest.assets.index), manifest.assets.index)
  );

  if (assetIndex.length !== manifest.assets.count) {
    throw new Error('导出包资产数量不一致');
  }

  const assetEntries = await readAssetEntriesFromExportZip(zip, assetIndex, options.onProgress);

  const importedActiveCardId = typeof parsedCollectionState.activeCardId === 'string'
    ? parsedCollectionState.activeCardId
    : null;
  const importedSpaceState = {
    ...spaceState,
    editingCollaboratorId:
      typeof spaceState.editingCollaboratorId === 'string' || spaceState.editingCollaboratorId === null
        ? spaceState.editingCollaboratorId
        : typeof personaState.editingCollaboratorId === 'string' || personaState.editingCollaboratorId === null
          ? personaState.editingCollaboratorId
          : null,
    screenshotDebugOverlayEnabled:
      typeof spaceState.screenshotDebugOverlayEnabled === 'boolean'
        ? spaceState.screenshotDebugOverlayEnabled
        : parsedRuntimeState.screenshotDebugOverlayEnabled === true,
    customization:
      spaceState.customization
        ? normalizeAppCustomization(spaceState.customization)
        : normalizeAppCustomization(parsedRuntimeState.customization),
    activeCardId: typeof spaceState.activeCardId === 'string' ? spaceState.activeCardId : importedActiveCardId
  } satisfies PersistedSpaceState;
  const migratedSpaceState = migratePersistedSpaceState(importedSpaceState);
  options.onProgress?.({ message: '收束未保存数据' });
  await flushPageLifecycleHandlers();
  options.onProgress?.({ message: '写入对话和设置' });
  await replaceKvEntries([]);
  replacePolarisLocalStorage([{
    key: SPACE_STORE_KEY,
    value: JSON.stringify({
      state: serializePersistedSpaceLocalState(migratedSpaceState),
      version: SPACE_STORE_VERSION
    })
  }]);
  options.onProgress?.({
    message: assetEntries.length > 0 ? '写入附件' : '刷新导入结果',
    current: assetEntries.length > 0 ? 0 : undefined,
    total: assetEntries.length > 0 ? assetEntries.length : undefined
  });
  await replaceAssetEntries(assetEntries, {
    onProgress: (current, total) => options.onProgress?.({ message: '写入附件', current, total })
  });
  options.onProgress?.({ message: '重建当前数据库' });
  await clearStoreLocalDataEntriesWithPrefix(`${LOCAL_DATA_NAMESPACE}:`, {
    commitId: `structured-import-reset-${Date.now()}`
  });
  const restoreResult = await restoreStructuredImportToLocalDataRepository({
    chatState,
    collectionState,
    personaState,
    personaMemoryDocContent,
    runtimeState,
    spaceState: migratedSpaceState,
    assetEntries
  });
  if (restoreResult.skippedDomains.length > 0) {
    throw new Error(`备份已解析，但以下数据域没有恢复：${formatSkippedImportDomains(restoreResult.skippedDomains)}`);
  }
  if (restoreResult.promotionFailure) {
    throw new Error(`备份已解析，但没有激活到当前数据源：${restoreResult.promotionFailure}`);
  }
  if (restoreResult.promotionSkippedDomains.length > 0) {
    throw new Error(`备份已解析，但以下数据域没有激活：${formatPromotionSkippedImportDomains(restoreResult.promotionSkippedDomains)}`);
  }
  if (restoreResult.restoredDomains.length > 0 && restoreResult.promotedDomains.length === 0) {
    throw new Error('备份已解析，但没有任何数据域激活到当前数据源。');
  }
  await clearLegacyLocalDataKvShadowIfStoreBackendInstalled();
  options.onProgress?.({ message: '刷新导入结果' });
  await refreshImportedStoresBestEffort();
  await clearImportRollbackFile();
}
