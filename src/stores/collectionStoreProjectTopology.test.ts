import { describe, expect, it } from 'vitest';
import { repairCollectionProjectTopology } from './collectionStoreProjectTopology';
import type { CodeCard, ImageAssetCard, ProjectFile } from '../types/domain';

function projectFile(seed: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId'>): ProjectFile {
  return {
    filePath: seed.filePath ?? 'index.html',
    fileRole: seed.fileRole,
    language: seed.language ?? 'html',
    content: seed.content ?? '',
    ownerCollaboratorId: seed.ownerCollaboratorId,
    source: seed.source ?? 'imported',
    createdAt: seed.createdAt ?? 10,
    updatedAt: seed.updatedAt ?? 20,
    ...seed
  };
}

describe('repairCollectionProjectTopology', () => {
  it('materializes imported room projects for orphan project files without dropping sibling state', () => {
    const cards = [{ id: 'card-1' }] as CodeCard[];
    const imageCards = [{ id: 'image-1' }] as ImageAssetCard[];
    const repaired = repairCollectionProjectTopology({
      cards,
      imageCards,
      deletedBundledCardIds: ['starter-1'],
      roomProjects: [],
      projectFiles: [
        projectFile({
          id: 'file-1',
          projectId: 'legacy-project',
          ownerCollaboratorId: 'pharos',
          fileRole: 'entry'
        })
      ],
      workspaceReferenceDocs: []
    });

    expect(repaired.cards).toBe(cards);
    expect(repaired.imageCards).toBe(imageCards);
    expect(repaired.deletedBundledCardIds).toEqual(['starter-1']);
    expect(repaired.roomProjects).toEqual([
      expect.objectContaining({
        id: 'legacy-project',
        title: '恢复的工作区 legacy-project',
        ownerCollaboratorId: 'pharos',
        entryFileId: 'file-1',
        fileIds: ['file-1'],
        source: 'imported'
      })
    ]);
  });
});
