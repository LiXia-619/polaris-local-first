import { describe, expect, it } from 'vitest';
import type { CodeCard, CodeCardFileRole, ProjectFile } from '../types/domain';
import {
  createProjectFileEntry,
  migrateLegacyProjectCards,
  patchProjectFiles,
  projectFileFromLegacyCard
} from './collectionStoreProjectFiles';

type LegacyProjectBackedCard = CodeCard & {
  projectId?: string;
  filePath?: string;
  fileRole?: CodeCardFileRole;
};

function makeCard(
  seed: Partial<LegacyProjectBackedCard> & Pick<CodeCard, 'id' | 'title' | 'language' | 'code' | 'source' | 'createdAt' | 'updatedAt'>
): LegacyProjectBackedCard {
  return {
    tags: [],
    ...seed
  };
}

function makeProjectFile(seed: ProjectFile): ProjectFile {
  return seed;
}

describe('projectFileFromLegacyCard', () => {
  it('derives a project file from legacy project-aware card fields', () => {
    expect(projectFileFromLegacyCard(makeCard({
      id: 'card-1',
      title: 'index.html',
      language: 'html',
      code: '<main />',
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 2,
      projectId: 'mini-phone',
      filePath: './index.html',
      fileRole: 'entry'
    }))).toEqual(makeProjectFile({
      id: 'card-1',
      projectId: 'mini-phone',
      filePath: 'index.html',
      fileRole: 'entry',
      language: 'html',
      content: '<main />',
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 2
    }));
  });

  it('ignores cards that are not project-backed files', () => {
    expect(projectFileFromLegacyCard(makeCard({
      id: 'card-1',
      title: 'Loose Card',
      language: 'markdown',
      code: '# hi',
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    }))).toBeNull();
  });
});

describe('migrateLegacyProjectCards', () => {
  it('extracts legacy project-backed cards into projectFiles and removes them from cards', () => {
    const migrated = migrateLegacyProjectCards({
      projectFiles: [],
      cards: [
      makeCard({
        id: 'card-1',
        title: 'index.html',
        language: 'html',
        code: '<main />',
        source: 'chat-generated',
        createdAt: 1,
        updatedAt: 4,
        projectId: 'mini-phone',
        filePath: 'index.html',
        fileRole: 'entry'
      })
      ]
    });

    expect(migrated.cards).toEqual([]);
    expect(migrated.projectFiles).toHaveLength(1);
    expect(migrated.projectFiles[0]?.id).toBe('card-1');
    expect(migrated.projectFiles[0]?.filePath).toBe('index.html');
    expect(migrated.projectFiles[0]?.content).toBe('<main />');
  });

  it('prefers live legacy-card content over stale persisted projectFiles with the same id', () => {
    const migrated = migrateLegacyProjectCards({
      projectFiles: [
        makeProjectFile({
          id: 'card-1',
          projectId: 'mini-phone',
          filePath: 'index.html',
          fileRole: 'entry',
          language: 'html',
          content: '<stale />',
          source: 'manual',
          createdAt: 1,
          updatedAt: 1
        })
      ],
      cards: [
        makeCard({
          id: 'card-1',
          title: 'index.html',
          language: 'html',
          code: '<fresh />',
          source: 'manual',
          createdAt: 1,
          updatedAt: 10,
          projectId: 'mini-phone',
          filePath: 'index.html',
          fileRole: 'entry'
        })
      ]
    });

    expect(migrated.projectFiles).toHaveLength(1);
    expect(migrated.projectFiles[0]?.content).toBe('<fresh />');
    expect(migrated.projectFiles[0]?.updatedAt).toBe(10);
  });

  it('keeps standalone cards in the card collection', () => {
    const standaloneCard = makeCard({
      id: 'card-2',
      title: 'Loose Card',
      language: 'markdown',
      code: '# hi',
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    });

    const migrated = migrateLegacyProjectCards({
      projectFiles: [],
      cards: [standaloneCard]
    });

    expect(migrated.cards).toEqual([standaloneCard]);
    expect(migrated.projectFiles).toEqual([]);
  });
});

describe('project file mutations', () => {
  it('creates standalone project files without legacy cards', () => {
    const file = createProjectFileEntry({
      projectId: 'mini-phone',
      filePath: './styles/app.css',
      content: 'body {}',
      source: 'chat-generated'
    });

    expect(file.projectId).toBe('mini-phone');
    expect(file.filePath).toBe('styles/app.css');
    expect(file.language).toBe('css');
    expect(file.content).toBe('body {}');
  });

  it('patches project file content in place', () => {
    const [updated] = patchProjectFiles([
      makeProjectFile({
        id: 'file-1',
        projectId: 'mini-phone',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        content: '<main />',
        source: 'chat-generated',
        createdAt: 1,
        updatedAt: 1
      })
    ], 'file-1', {
      content: '<main><section /></main>'
    });

    expect(updated?.content).toBe('<main><section /></main>');
    expect(updated?.filePath).toBe('index.html');
  });
});
