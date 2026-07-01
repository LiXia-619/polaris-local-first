import { describe, expect, it } from 'vitest';
import { executeCollectionWorkspaceReferenceAction } from './toolExecutorCollectionWorkspaceReferences';
import type { ToolContext } from './toolExecutorTypes';
import type { ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../types/domain';

function makeProject(): RoomProject {
  return {
    id: 'project-1',
    title: 'Project',
    slug: 'project',
    fileIds: [],
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1
  };
}

function makeReference(patch: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'title'>): WorkspaceReferenceDoc {
  return {
    projectId: 'project-1',
    summary: '',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...patch
  };
}

function makeFile(patch: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'filePath'>): ProjectFile {
  return {
    projectId: 'project-1',
    language: 'markdown',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...patch
  };
}

function makeContext(args?: {
  files?: ProjectFile[];
  docs?: WorkspaceReferenceDoc[];
  readWorkspaceReferenceDocContent?: ToolContext['readWorkspaceReferenceDocContent'];
}) {
  const project = makeProject();
  const files = [...(args?.files ?? [])];
  const docs = [...(args?.docs ?? [])];

  const ctx = {
    readRoomProject: (projectId: string) => projectId === project.id ? project : null,
    listProjectFiles: (projectId: string) => files.filter((file) => file.projectId === projectId),
    readProjectFile: (fileId: string) => files.find((file) => file.id === fileId) ?? null,
    createProjectFile: (file: { projectId: string; filePath: string; language?: string; fileRole?: ProjectFile['fileRole']; code: string; replaceContent?: boolean }) => {
      const existing = files.find((entry) => entry.projectId === file.projectId && entry.filePath === file.filePath);
      if (existing) {
        existing.content = file.replaceContent === false ? existing.content : file.code;
        existing.language = file.language ?? existing.language;
        existing.fileRole = file.fileRole;
        existing.updatedAt += 1;
        return existing.id;
      }
      const id = `file-${files.length + 1}`;
      files.push(makeFile({
        id,
        projectId: file.projectId,
        filePath: file.filePath,
        language: file.language ?? 'markdown',
        fileRole: file.fileRole,
        content: file.code,
        source: 'chat-generated'
      }));
      return id;
    },
    listWorkspaceReferenceDocs: (projectId: string) => docs.filter((doc) => doc.projectId === projectId),
    readWorkspaceReferenceDoc: (docId: string) => docs.find((doc) => doc.id === docId) ?? null,
    deleteWorkspaceReferenceDoc: (docId: string) => {
      const index = docs.findIndex((doc) => doc.id === docId);
      if (index < 0) return false;
      docs.splice(index, 1);
      return true;
    },
    createWorkspaceReferenceDoc: (doc: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'projectId' | 'title'>) => {
      const id = `doc-${docs.length + 1}`;
      docs.push(makeReference({
        id,
        projectId: doc.projectId,
        title: doc.title,
        summary: doc.summary ?? '',
        content: doc.content ?? '',
        source: 'chat-generated'
      }));
      return id;
    },
    readWorkspaceReferenceDocContent: args?.readWorkspaceReferenceDocContent,
    deleteProjectFile: (fileId: string) => {
      const index = files.findIndex((file) => file.id === fileId);
      if (index < 0) return false;
      files.splice(index, 1);
      return true;
    },
    setCollectionShelf: () => undefined,
    setWorld: () => undefined
  } as unknown as ToolContext;

  return { ctx, files, docs };
}

describe('executeCollectionWorkspaceReferenceAction conversions', () => {
  it('moves a workspace reference into an editable project file', async () => {
    const { ctx, files, docs } = makeContext({
      docs: [makeReference({
        id: 'ref-1',
        title: '资料',
        content: '# 资料正文'
      })]
    });

    const result = await executeCollectionWorkspaceReferenceAction({
      kind: 'promoteWorkspaceReferenceToProjectFile',
      projectId: 'project-1',
      docId: 'ref-1',
      filePath: 'docs/ref.md',
      language: 'markdown',
      fileRole: 'content'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(files).toHaveLength(1);
    expect(docs).toHaveLength(0);
    expect(files[0]).toMatchObject({
      filePath: 'docs/ref.md',
      content: '# 资料正文',
      fileRole: 'content'
    });
    expect(result.ok ? result.projectFileEffects?.[0] : null).toMatchObject({
      operation: 'created',
      filePath: 'docs/ref.md'
    });
    expect(result.ok ? result.workspaceReferenceDocReads?.[0] : null).toMatchObject({
      kind: 'doc',
      projectId: 'project-1'
    });
  });

  it('moves a project file into a workspace reference', async () => {
    const sourceFile = makeFile({
      id: 'file-1',
      filePath: 'drafts/archive.md',
      content: '暂时不运行，但要保留给模型看。'
    });
    const { ctx, files, docs } = makeContext({ files: [sourceFile] });

    const result = await executeCollectionWorkspaceReferenceAction({
      kind: 'pinProjectFileAsReference',
      projectId: 'project-1',
      fileId: 'file-1',
      title: '归档说明'
    }, ctx);

    expect(result.ok).toBe(true);
    expect(files).toHaveLength(0);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      title: '归档说明',
      content: '暂时不运行，但要保留给模型看。'
    });
    expect(result.ok ? result.workspaceReferenceDocTitle : null).toBe('归档说明');
    expect(result.ok ? result.projectFiles?.[0] : null).toMatchObject({
      filePath: 'drafts/archive.md'
    });
    expect(result.ok ? result.projectFileEffects?.[0] : null).toMatchObject({
      operation: 'deleted',
      filePath: 'drafts/archive.md'
    });
  });

  it('reports an unreadable workspace reference body without throwing', async () => {
    const { ctx } = makeContext({
      docs: [makeReference({
        id: 'ref-missing',
        title: '缺正文资料',
        content: '',
        charCount: 12,
        contentLoaded: false
      })],
      readWorkspaceReferenceDocContent: async () => {
        throw new Error('Workspace reference document content is missing: ref-missing');
      }
    });

    const result = await executeCollectionWorkspaceReferenceAction({
      kind: 'readWorkspaceReference',
      projectId: 'project-1',
      docId: 'ref-missing'
    }, ctx);

    expect(result).toEqual({
      ok: false,
      error: '工作区参考资料目录还在，但正文没有在当前本机数据里找到：缺正文资料'
    });
  });

  it('keeps readable context search alive when one reference body is missing', async () => {
    const { ctx } = makeContext({
      docs: [
        makeReference({
          id: 'ref-missing',
          title: '白树目录',
          summary: '白树资料的目录仍然存在',
          content: '',
          charCount: 12,
          contentLoaded: false
        }),
        makeReference({
          id: 'ref-loaded',
          title: '健康资料',
          content: '这里有白树正文',
          contentLoaded: true
        })
      ],
      readWorkspaceReferenceDocContent: async (doc) => {
        if (doc.id === 'ref-missing') {
          throw new Error('Workspace reference document content is missing: ref-missing');
        }
        return doc.content;
      }
    });

    const result = await executeCollectionWorkspaceReferenceAction({
      kind: 'searchReadableContext',
      projectId: 'project-1',
      query: '白树',
      maxResults: 5
    }, ctx);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.readableContextCandidates?.map((candidate) => candidate.id) : []).toEqual([
      'ref-missing',
      'ref-loaded'
    ]);
  });
});
