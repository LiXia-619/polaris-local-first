import { describe, expect, it } from 'vitest';
import type { CodeCard, ImageAssetCard, ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../../types/domain';
import {
  buildCollectionLocalDataUnitOfWork,
  getCollectionDomainMetaLocalDataRef,
  getCollectionObjectLocalDataRef,
  toCollectionObjectId
} from './collectionRows';

function card(seed: Partial<CodeCard> & Pick<CodeCard, 'id'>): CodeCard {
  return {
    title: seed.id,
    language: 'html',
    code: '',
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

function image(seed: Partial<ImageAssetCard> & Pick<ImageAssetCard, 'id' | 'assetId'>): ImageAssetCard {
  return {
    title: seed.id,
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

function project(seed: Partial<RoomProject> & Pick<RoomProject, 'id'>): RoomProject {
  return {
    title: seed.id,
    slug: seed.id,
    fileIds: [],
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    pinnedAt: null,
    ...seed
  };
}

function file(seed: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId'>): ProjectFile {
  return {
    filePath: 'index.html',
    language: 'html',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

function doc(seed: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'projectId'>): WorkspaceReferenceDoc {
  return {
    title: seed.id,
    summary: '',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...seed
  };
}

describe('buildCollectionLocalDataUnitOfWork', () => {
  it('projects collection objects into independent complete rows plus domain metadata', () => {
    const unit = buildCollectionLocalDataUnitOfWork({
      id: 'collection-migration',
      activeProjectId: 'project-1',
      version: 2,
      updatedAt: 30,
      state: {
        cards: [card({
          id: 'card-1',
          ownerCollaboratorId: 'pharos',
          code: 'background:url(polaris-asset://asset-card)'
        })],
        imageCards: [image({ id: 'image-1', assetId: 'asset-image' })],
        roomProjects: [project({ id: 'project-1', ownerCollaboratorId: 'pharos' })],
        projectFiles: [file({
          id: 'file-1',
          projectId: 'project-1',
          content: 'url(polaris-asset://asset-file)'
        })],
        workspaceReferenceDocs: [doc({
          id: 'doc-1',
          projectId: 'project-1',
          content: 'polaris-asset://asset-doc'
        })]
      }
    });

    expect(unit).toEqual(expect.objectContaining({
      id: 'collection-migration',
      domain: 'collection',
      version: 2
    }));
    expect(unit.mutations).toHaveLength(6);
    expect(unit.mutations[0]).toEqual(expect.objectContaining({
      type: 'put',
      row: expect.objectContaining({
        ref: getCollectionDomainMetaLocalDataRef(),
        value: expect.objectContaining({
          activeProjectId: 'project-1',
          activeObjectCount: 5,
          objectCounts: {
            card: 1,
            'image-card': 1,
            project: 1,
            'project-file': 1,
            'workspace-doc': 1
          }
        })
      })
    }));
    expect(unit.mutations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getCollectionObjectLocalDataRef('card', 'card-1'),
          value: expect.objectContaining({
            objectId: toCollectionObjectId('card', 'card-1'),
            ownerCollaboratorId: 'pharos',
            assetRefs: ['asset-card']
          })
        })
      }),
      expect.objectContaining({
        row: expect.objectContaining({
          ref: getCollectionObjectLocalDataRef('image-card', 'image-1'),
          value: expect.objectContaining({
            assetRefs: ['asset-image']
          })
        })
      })
    ]));
  });
});
