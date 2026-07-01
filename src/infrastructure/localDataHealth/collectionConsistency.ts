import type { PersistedDbEntry } from '../persistence';
import { isPlainRecord } from './recordGuards';
import { COLLECTION_STATE_KEY } from './storageKeys';
import { estimateLocalDataBytes } from './buckets';

export type LocalCollectionSourceHealth = {
  projectFileCount: number;
  projectFileContentBytes: number;
  workspaceReferenceDocCount: number;
};

export function buildCollectionSourceHealth(kv: PersistedDbEntry[]): LocalCollectionSourceHealth {
  const collectionState = kv.find((entry) => entry.key === COLLECTION_STATE_KEY)?.value;
  if (!isPlainRecord(collectionState)) {
    return {
      projectFileCount: 0,
      projectFileContentBytes: 0,
      workspaceReferenceDocCount: 0
    };
  }

  const projectFiles = Array.isArray(collectionState.projectFiles) ? collectionState.projectFiles : [];
  const workspaceReferenceDocs = Array.isArray(collectionState.workspaceReferenceDocs)
    ? collectionState.workspaceReferenceDocs
    : [];

  return {
    projectFileCount: projectFiles.length,
    projectFileContentBytes: projectFiles.reduce((sum, file) => (
      sum + (isPlainRecord(file) && typeof file.content === 'string' ? estimateLocalDataBytes(file.content) : 0)
    ), 0),
    workspaceReferenceDocCount: workspaceReferenceDocs.length
  };
}
