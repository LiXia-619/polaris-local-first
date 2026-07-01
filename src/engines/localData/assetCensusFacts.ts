import type { PersistedDbEntry } from '../../infrastructure/persistence';
import { isLegacyLifecycleAssetState } from './assetRows';
import { LOCAL_DATA_NAMESPACE, type AssetObjectState } from './types';

export type LocalDataAssetRepositoryFacts = {
  assetIds: Set<string>;
  metaIds: Set<string>;
  binaryIds: Set<string>;
  previewIds: Set<string>;
  ownedIds: Set<string>;
  previewOnlyIds: Set<string>;
  missingMetaIds: Set<string>;
  missingBinaryIds: Set<string>;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readBoolean(value: unknown) {
  return value === true;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function hasOwnerRefs(payload: Record<string, unknown>) {
  return Array.isArray(payload.ownerRefs)
    && payload.ownerRefs.some((owner) => isPlainRecord(owner) && Boolean(readString(owner.id)));
}

function readAssetRowPayload(row: Record<string, unknown>) {
  if (row.state === 'complete' && isPlainRecord(row.value)) return row.value;
  if (row.state === 'incomplete' && isPlainRecord(row.meta)) return row.meta;
  return null;
}

export function collectLocalDataAssetRepositoryFacts(kv: PersistedDbEntry[]): LocalDataAssetRepositoryFacts {
  const facts: LocalDataAssetRepositoryFacts = {
    assetIds: new Set(),
    metaIds: new Set(),
    binaryIds: new Set(),
    previewIds: new Set(),
    ownedIds: new Set(),
    previewOnlyIds: new Set(),
    missingMetaIds: new Set(),
    missingBinaryIds: new Set()
  };
  const rowPrefix = `${LOCAL_DATA_NAMESPACE}:row:asset:`;

  kv.forEach((entry) => {
    if (!entry.key.startsWith(rowPrefix) || !isPlainRecord(entry.value)) return;
    const row = entry.value;
    const ref = isPlainRecord(row.ref) ? row.ref : null;
    if (ref?.domain !== 'asset' || ref.kind !== 'asset') return;
    const id = readString(ref.id);
    if (!id) return;
    const payload = readAssetRowPayload(row);
    if (!payload) return;
    // Sealed legacy lifecycle rows (archive / recovering / quarantine / missing-body) are recovery
    // evidence, not live repository assets — exclude them so the census never classifies a sealed
    // archive as a live meta/binary/owned asset. The live legacy blob stores still contribute their
    // own ids to the census separately (that union is intentional recovery-evidence accounting).
    if (isLegacyLifecycleAssetState(payload.state as AssetObjectState | undefined)) return;

    const hasMeta = readBoolean(payload.hasMeta);
    const hasBinary = readBoolean(payload.hasBinary);
    const hasPreview = readBoolean(payload.hasPreview);
    facts.assetIds.add(id);
    if (hasMeta) facts.metaIds.add(id);
    if (hasBinary) facts.binaryIds.add(id);
    if (hasPreview) facts.previewIds.add(id);
    if (hasOwnerRefs(payload)) facts.ownedIds.add(id);
    if (hasPreview && !hasMeta && !hasBinary) facts.previewOnlyIds.add(id);
    if (!hasMeta && hasBinary) facts.missingMetaIds.add(id);
    if (hasMeta && !hasBinary) facts.missingBinaryIds.add(id);
  });

  return facts;
}
