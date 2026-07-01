import { kvGet } from '../infrastructure/persistence';
import type {
  CodeCard,
  ImageAssetCard,
  ProjectFile,
  RoomProject,
  WorkspaceReferenceDoc
} from '../types/domain';
import type { PersistedCollectionState } from './collectionStorePersistence';
import {
  stageWorkspaceReferenceDocContentFromDocs,
  stripWorkspaceReferenceDocContent
} from './workspaceReferenceDocContentPersistence';

const LEGACY_COLLECTION_STATE_KEY = 'collection-state-v2';

type LegacyCollectionStatePayload = {
  cards?: CodeCard[];
  projectFiles?: ProjectFile[];
  workspaceReferenceDocs?: WorkspaceReferenceDoc[];
  roomProjects?: RoomProject[];
  imageCards?: ImageAssetCard[];
  deletedBundledCardIds?: string[];
};

function listOrEmpty<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Explicit legacy boundary reader for old collection directory payloads. Normal collection
 * startup and ordinary saves do not import this file; migration / recovery-adjacent code may use
 * it to turn old `collection-state-v2` evidence into LocalData rows.
 */
export async function readLegacyCollectionStateForBoundary(): Promise<PersistedCollectionState | null> {
  const payload = await kvGet<LegacyCollectionStatePayload>(LEGACY_COLLECTION_STATE_KEY);
  if (!payload || typeof payload !== 'object') return null;

  const workspaceReferenceDocs = listOrEmpty(payload.workspaceReferenceDocs);
  stageWorkspaceReferenceDocContentFromDocs(workspaceReferenceDocs);
  return {
    cards: listOrEmpty(payload.cards),
    projectFiles: listOrEmpty(payload.projectFiles),
    workspaceReferenceDocs: stripWorkspaceReferenceDocContent(workspaceReferenceDocs),
    roomProjects: listOrEmpty(payload.roomProjects),
    imageCards: listOrEmpty(payload.imageCards),
    deletedBundledCardIds: listOrEmpty(payload.deletedBundledCardIds)
  };
}
