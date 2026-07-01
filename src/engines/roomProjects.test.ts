import { describe, expect, it } from 'vitest';
import type { CodeCard, ProjectFile, RoomProject } from '../types/domain';
import {
  buildRoomProjectTreeSnapshots,
  createCardPromotionSnapshot,
  normalizeRoomProject,
  resolveRoomProjectFileSummaries,
  resolveRoomProjectFiles,
  sortRoomProjects,
  suggestRoomProjectPlacementForCard
} from './roomProjects';

function makeCard(seed: Partial<CodeCard> & Pick<CodeCard, 'id' | 'title' | 'language' | 'code' | 'source' | 'createdAt' | 'updatedAt'>): CodeCard {
  return {
    tags: [],
    ...seed
  };
}

function makeProjectFile(
  seed: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId' | 'filePath' | 'language' | 'content' | 'source' | 'createdAt' | 'updatedAt'>
): ProjectFile {
  return {
    ...seed
  };
}

describe('suggestRoomProjectPlacementForCard', () => {
  it('keeps preview state access disabled unless the workspace explicitly opts in', () => {
    expect(normalizeRoomProject({
      id: 'project-1',
      title: 'Private workspace'
    }).previewStateAccess).toBeUndefined();

    expect(normalizeRoomProject({
      id: 'project-1',
      title: 'Trusted workspace',
      previewStateAccess: {
        assistantReadEnabled: true,
        updatedAt: 12
      }
    }).previewStateAccess).toEqual({
      assistantReadEnabled: true,
      updatedAt: 12
    });
  });

  it('uses a stable entry placement for standalone html cards', () => {
    expect(
      suggestRoomProjectPlacementForCard({
        id: 'card-html',
        title: 'Landing Page',
        language: 'html'
      })
    ).toEqual({
      filePath: 'index.html',
      fileRole: 'entry'
    });
  });

  it('maps standalone css cards into a style slot', () => {
    expect(
      suggestRoomProjectPlacementForCard({
        id: 'card-css',
        title: 'Landing Theme',
        language: 'css'
      })
    ).toEqual({
      filePath: 'styles/main.css',
      fileRole: 'style'
    });
  });

  it('preserves existing project-aware metadata when present', () => {
    expect(
      suggestRoomProjectPlacementForCard({
        id: 'card-js',
        title: 'App Logic',
        language: 'javascript',
        filePath: 'scripts/app.js',
        fileRole: 'logic'
      })
    ).toEqual({
      filePath: 'scripts/app.js',
      fileRole: 'logic'
    });
  });

  it('keeps entry role metadata without treating non-html files as the runnable entry', () => {
    const project: RoomProject = {
      id: 'proj-1',
      title: 'Starter',
      slug: 'starter',
      entryFileId: 'card-main',
      fileIds: ['card-main', 'card-html'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };
    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-main',
        projectId: 'proj-1',
        filePath: 'src/main.tsx',
        fileRole: 'entry',
        language: 'tsx',
        content: 'export function App() { return <div />; }',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-1',
        filePath: 'index.html',
        language: 'html',
        content: '<!doctype html><html><body><div id="root"></div><script src="./src/main.tsx"></script></body></html>',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const files = resolveRoomProjectFiles(project, projectFiles);

    expect(files.find((file) => file.fileId === 'card-html')?.isEntry).toBe(true);
    expect(files.find((file) => file.fileId === 'card-main')?.isEntry).toBe(false);
    expect(files.find((file) => file.fileId === 'card-main')?.role).toBe('entry');
  });

  it('reports the runnable html file as project entry in tree snapshots', () => {
    const project: RoomProject = {
      id: 'proj-1',
      title: 'Starter',
      slug: 'starter',
      entryFileId: 'card-main',
      fileIds: ['card-main', 'card-html'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };
    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-main',
        projectId: 'proj-1',
        filePath: 'src/main.tsx',
        fileRole: 'entry',
        language: 'tsx',
        content: 'export function App() { return <div />; }',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-1',
        filePath: 'index.html',
        language: 'html',
        content: '<!doctype html><html><body><div id="root"></div></body></html>',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const snapshot = buildRoomProjectTreeSnapshots([project], projectFiles)[0];

    expect(snapshot?.entryFilePath).toBe('index.html');
    expect(snapshot?.files.find((file) => file.fileId === 'card-html')?.isEntry).toBe(true);
    expect(snapshot?.files.find((file) => file.fileId === 'card-main')?.isEntry).toBe(false);
  });

  it('builds project shelf summaries without carrying file content', () => {
    const project: RoomProject = {
      id: 'proj-1',
      title: 'Starter',
      slug: 'starter',
      entryFileId: 'card-main',
      fileIds: ['card-main', 'card-html'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };
    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-main',
        projectId: 'proj-1',
        filePath: 'src/main.tsx',
        fileRole: 'entry',
        language: 'tsx',
        content: 'export function App() { return <div />; }',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-1',
        filePath: 'index.html',
        language: 'html',
        content: '<!doctype html><html><body><div id="root"></div></body></html>',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const summaries = resolveRoomProjectFileSummaries(project, projectFiles);

    expect(summaries.map((file) => file.fileId)).toEqual(['card-main', 'card-html']);
    expect(summaries.find((file) => file.fileId === 'card-html')?.isEntry).toBe(true);
    expect(summaries.find((file) => file.fileId === 'card-main')?.isEntry).toBe(false);
    expect(summaries.some((file) => 'content' in file)).toBe(false);
  });

  it('keeps empty workspaces visible in tree snapshots', () => {
    const project: RoomProject = {
      id: 'proj-empty',
      title: '空白工作区',
      slug: 'empty',
      fileIds: [],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };

    const snapshot = buildRoomProjectTreeSnapshots([project], [], { includeProjectIds: ['proj-empty'] })[0];

    expect(snapshot).toMatchObject({
      id: 'proj-empty',
      title: '空白工作区',
      fileCount: 0,
      files: []
    });
    expect(snapshot?.entryFilePath).toBeUndefined();
  });
});

describe('createCardPromotionSnapshot', () => {
  it('preserves card identity and presentational metadata for project promotion', () => {
    expect(createCardPromotionSnapshot({
      id: 'card-1',
      title: 'Landing Hero',
      tags: ['首页', '样张'],
      cardNote: '像一张留在封面角落的小字。',
      cardFaceCss: '& { background: linear-gradient(180deg, #eef6ff, #ffffff); }',
      kind: 'card',
      source: 'chat-generated',
      originConversationId: 'conv-1',
      originMessageId: 'msg-1',
      originBlockIndex: 2,
      originBlockTitle: 'Landing Hero'
    })).toMatchObject({
      cardId: 'card-1',
      originalTitle: 'Landing Hero',
      originalTags: ['首页', '样张'],
      originalCardNote: '像一张留在封面角落的小字。',
      originalCardFaceCss: '& { background: linear-gradient(180deg, #eef6ff, #ffffff); }',
      originalKind: 'card',
      source: 'chat-generated',
      originConversationId: 'conv-1',
      originMessageId: 'msg-1',
      originBlockIndex: 2,
      originBlockTitle: 'Landing Hero'
    });
  });

  it('keeps project cover fields when normalizing room projects', () => {
    const project = normalizeRoomProject({
      id: 'proj-1',
      title: 'Landing Hero',
      coverNote: '像一张留在封面角落的小字。',
      coverStyle: '& { background: linear-gradient(180deg, #eef6ff, #ffffff); }',
      promotionSnapshot: {
        cardId: 'card-1',
        originalTitle: 'Landing Hero',
        originalTags: ['首页'],
        originalCardNote: '像一张留在封面角落的小字。',
        originalCardFaceCss: '& { background: linear-gradient(180deg, #eef6ff, #ffffff); }',
        originalKind: 'card',
        source: 'chat-generated',
        promotedAt: 1
      }
    });

    expect(project.coverNote).toBe('像一张留在封面角落的小字。');
    expect(project.coverStyle).toBe('& { background: linear-gradient(180deg, #eef6ff, #ffffff); }');
    expect(project.promotionSnapshot).toMatchObject({
      cardId: 'card-1',
      originalTitle: 'Landing Hero',
      originalTags: ['首页'],
      originalKind: 'card',
      source: 'chat-generated',
      promotedAt: 1
    });
  });
});

describe('sortRoomProjects', () => {
  it('keeps pinned workspaces before newer unpinned workspaces', () => {
    const olderPinned = normalizeRoomProject({
      id: 'older-pinned',
      title: 'Older Pinned',
      fileIds: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
      pinnedAt: 5
    });
    const newer = normalizeRoomProject({
      id: 'newer',
      title: 'Newer',
      fileIds: [],
      source: 'manual',
      createdAt: 10,
      updatedAt: 10
    });

    expect(sortRoomProjects([newer, olderPinned]).map((project) => project.id)).toEqual([
      'older-pinned',
      'newer'
    ]);
  });
});
