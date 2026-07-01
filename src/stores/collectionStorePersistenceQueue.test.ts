import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('collectionStore persist queue', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('serializes overlapping collection persists and writes the latest state second', async () => {
    // The persistence queue now lives inside writeCollectionState (so it can also wrap
    // the body persistence in the same serialized save path), not in persistToDb. Drive
    // the real writeCollectionState and observe the serialized object-row commit.
    let releaseFirstCommit: () => void = () => {};
    const firstCommit = new Promise<void>((resolve) => {
      releaseFirstCommit = resolve;
    });
    const commitCollectionRowChangesFromStateActivating = vi.fn(async (_state: unknown) => {
      if (commitCollectionRowChangesFromStateActivating.mock.calls.length === 1) {
        await firstCommit;
      }
      return true;
    });
    vi.doMock('./collection/localData', () => ({
      commitCollectionRowChangesFromStateActivating,
      readCollectionStateFromLocalDataRepositoryIfActive: vi.fn(async () => null)
    }));
    vi.doMock('./workspaceReferenceDocContentPersistence', () => ({
      writeWorkspaceReferenceDocContentForDocs: vi.fn(async () => {}),
      stripWorkspaceReferenceDocContent: vi.fn((docs: unknown) => docs),
      clearStagedWorkspaceReferenceDocContent: vi.fn(),
      stageWorkspaceReferenceDocContentFromDocs: vi.fn()
    }));

    const { useCollectionStore } = await import('./collectionStore');
    const makeCard = (title: string) => ({
      id: 'card-1',
      title,
      language: 'html',
      code: '<main></main>',
      tags: [],
      source: 'manual' as const,
      createdAt: 1,
      updatedAt: 1,
      pinnedAt: null
    });

    useCollectionStore.setState({
      cards: [makeCard('first')],
      projectFiles: [],
      workspaceReferenceDocs: [],
      roomProjects: [],
      imageCards: [],
      deletedBundledCardIds: []
    });
    const firstPersist = useCollectionStore.getState().persistToDb();
    useCollectionStore.setState({ cards: [makeCard('second')] });
    const secondPersist = useCollectionStore.getState().persistToDb();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(commitCollectionRowChangesFromStateActivating).toHaveBeenCalledTimes(1);

    releaseFirstCommit();
    await Promise.all([firstPersist, secondPersist]);

    expect(commitCollectionRowChangesFromStateActivating).toHaveBeenCalledTimes(2);
    expect(commitCollectionRowChangesFromStateActivating.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      cards: [expect.objectContaining({ title: 'second' })]
    }));
  });
});
