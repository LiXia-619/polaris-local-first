import { reportPersistenceError } from '../../infrastructure/persistenceDiagnostics';
import type { CodeCard, ImageAssetCard, ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../../types/domain';
import {
  commitCollectionRowChangesFromStateActivating,
  readCollectionStateFromLocalDataRepositoryIfActive,
  type CollectionLegacyLifecycleMap
} from './localData';
import { runExclusiveCollectionPersistenceCommit } from '../collectionPersistenceCommitQueue';
import {
  clearStagedWorkspaceReferenceDocContent,
  writeWorkspaceReferenceDocContentForDocs
} from '../workspaceReferenceDocContentPersistence';

export type PersistedCollectionState = {
  cards: CodeCard[];
  projectFiles: ProjectFile[];
  workspaceReferenceDocs: WorkspaceReferenceDoc[];
  roomProjects: RoomProject[];
  imageCards: ImageAssetCard[];
  deletedBundledCardIds?: string[];
  // Legacy lifecycle object rows (archive / recovering / quarantine / missing-body), surfaced as
  // read-only historical markers. The active-repository read path populates it; ordinary write
  // callers omit it so these rows stay out of the live product snapshot.
  legacyLifecycleByObjectId?: CollectionLegacyLifecycleMap;
};

export async function readCollectionState(
  options: { throwOnReadFailure?: boolean } = {}
): Promise<PersistedCollectionState | null> {
  try {
    const repositoryState = await readCollectionStateFromLocalDataRepositoryIfActive();
    if (repositoryState) return repositoryState;
    return null;
  } catch (e) {
    reportPersistenceError({ label: '[store:persist]', store: 'collection', operation: 'read' }, e);
    if (options.throwOnReadFailure) {
      throw e;
    }
    return null;
  }
}

export async function writeCollectionState(state: PersistedCollectionState) {
  try {
    // One serialized save path owns calling both owners: the workspace reference doc
    // bodies (document rows when active, else legacy chunked KV) and the collection
    // object directory rows. The collection row writer does not re-acquire this queue.
    await runExclusiveCollectionPersistenceCommit(async () => {
      await writeWorkspaceReferenceDocContentForDocs(state.workspaceReferenceDocs);
      await commitCollectionRowChangesFromStateActivating(state);
      clearStagedWorkspaceReferenceDocContent();
    });
  } catch (e) {
    reportPersistenceError({ label: '[store:persist]', store: 'collection', operation: 'write' }, e);
    throw e;
  }
}
