import { searchProjectFiles } from './projectFileInspection';
import { resolveRoomProjectFiles } from './roomProjects';
import { toProjectFileFactFromDomain } from './toolExecutorCollectionProjectFiles';
import {
  buildReferenceExcerpt,
  findWorkspaceReferenceDoc,
  formatReadableContextCandidates,
  formatWorkspaceReferenceDirectory,
  formatWorkspaceReferenceSearch,
  normalizeReferenceSearchText,
  searchWorkspaceReferenceDocs,
  toWorkspaceReferenceFact
} from './toolExecutorCollectionReferences';
import { buildWholeFileEffect } from './toolExecutorCollectionTextEdit';
import type { ToolAction, ToolContext, ToolExecutionResult } from './toolExecutorTypes';
import type {
  CollectionShelf,
  ReadableContextCandidate,
  WorkspaceReferenceDoc
} from '../types/domain';

export type CollectionWorkspaceReferenceAction = Extract<
  ToolAction,
  {
    kind:
      | 'listWorkspaceReferences'
      | 'searchWorkspaceReferences'
      | 'readWorkspaceReference'
      | 'promoteWorkspaceReferenceToProjectFile'
      | 'pinProjectFileAsReference'
      | 'searchReadableContext';
  }
>;

function revealCollectionShelf(ctx: ToolContext, shelf: CollectionShelf) {
  ctx.setCollectionShelf(shelf);
  ctx.setWorld('collection');
}

async function loadWorkspaceReferenceDocForTool(ctx: ToolContext, doc: WorkspaceReferenceDoc) {
  const content = ctx.readWorkspaceReferenceDocContent
    ? await ctx.readWorkspaceReferenceDocContent(doc)
    : doc.content;
  return {
    ...doc,
    content,
    charCount: content.length,
    contentLoaded: true
  } satisfies WorkspaceReferenceDoc;
}

async function loadWorkspaceReferenceDocResult(ctx: ToolContext, doc: WorkspaceReferenceDoc) {
  try {
    return {
      ok: true as const,
      doc: await loadWorkspaceReferenceDocForTool(ctx, doc)
    };
  } catch {
    return {
      ok: false as const,
      error: `工作区参考资料目录还在，但正文没有在当前本机数据里找到：${doc.title || doc.id}`
    };
  }
}

async function loadWorkspaceReferenceDocsForTool(ctx: ToolContext, docs: WorkspaceReferenceDoc[]) {
  if (!ctx.readWorkspaceReferenceDocContent) return docs;
  const results = await Promise.allSettled(docs.map((doc) => loadWorkspaceReferenceDocForTool(ctx, doc)));
  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return [result.value];
    const doc = docs[index];
    return doc ? [doc] : [];
  });
}

export async function executeCollectionWorkspaceReferenceAction(
  action: CollectionWorkspaceReferenceAction,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  switch (action.kind) {
    case 'listWorkspaceReferences': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const docs = ctx.listWorkspaceReferenceDocs?.(project.id) ?? [];
      const facts = docs.map(toWorkspaceReferenceFact);
      return {
        ok: true,
        summary: `已列出工作区参考资料 · ${docs.length} 份`,
        detailText: formatWorkspaceReferenceDirectory(project.id, docs),
        workspaceReferenceDocs: facts,
        workspaceReferenceDocReads: [{
          kind: 'directory',
          projectId: project.id,
          totalDocs: facts.length,
          docs: facts
        }],
        roomProjectId: project.id
      };
    }
    case 'searchWorkspaceReferences': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const docs = await loadWorkspaceReferenceDocsForTool(ctx, ctx.listWorkspaceReferenceDocs?.(project.id) ?? []);
      const result = searchWorkspaceReferenceDocs(docs, action.query, action.maxResults);
      const facts = result.returnedMatches
        .map((match) => docs.find((doc) => doc.id === match.docId))
        .filter((doc): doc is WorkspaceReferenceDoc => Boolean(doc))
        .map(toWorkspaceReferenceFact);
      return {
        ok: true,
        summary: `已搜索工作区参考资料 · ${result.totalMatches} 份命中`,
        detailText: formatWorkspaceReferenceSearch(project.id, result),
        workspaceReferenceDocs: facts,
        workspaceReferenceDocReads: [{
          kind: 'search',
          projectId: project.id,
          query: result.query,
          totalMatches: result.totalMatches,
          returnedMatches: result.returnedMatches.length,
          matches: result.returnedMatches
        }],
        roomProjectId: project.id
      };
    }
    case 'readWorkspaceReference': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      const docs = ctx.listWorkspaceReferenceDocs?.(project.id) ?? [];
      const match = findWorkspaceReferenceDoc(docs, {
        docId: action.docId,
        title: action.title
      });
      if (!match.ok) {
        return { ok: false, error: match.error };
      }
      const loaded = await loadWorkspaceReferenceDocResult(ctx, match.doc);
      if (!loaded.ok) return { ok: false, error: loaded.error };
      const doc = loaded.doc;
      const fact = toWorkspaceReferenceFact(doc);
      return {
        ok: true,
        summary: `已读取工作区参考资料 · ${doc.title}`,
        detailText: [
          `资料：${doc.title}`,
          `工作区：${doc.projectId}`,
          doc.summary ? `摘要：${doc.summary}` : null,
          '',
          doc.content.trim() || '[空]'
        ].filter(Boolean).join('\n'),
        workspaceReferenceDocId: doc.id,
        workspaceReferenceDocTitle: doc.title,
        workspaceReferenceDocs: [fact],
        workspaceReferenceDocReads: [{
          kind: 'doc',
          projectId: project.id,
          doc: fact
        }],
        roomProjectId: project.id
      };
    }
    case 'promoteWorkspaceReferenceToProjectFile': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      if (!ctx.deleteWorkspaceReferenceDoc) {
        return { ok: false, error: '当前环境不能移动工作区参考资料。' };
      }
      const docs = ctx.listWorkspaceReferenceDocs?.(project.id) ?? [];
      const match = findWorkspaceReferenceDoc(docs, {
        docId: action.docId,
        title: action.title
      });
      if (!match.ok) {
        return { ok: false, error: match.error };
      }
      const loaded = await loadWorkspaceReferenceDocResult(ctx, match.doc);
      if (!loaded.ok) return { ok: false, error: loaded.error };
      const doc = loaded.doc;

      const beforeFile = ctx.listProjectFiles(project.id).find((file) => file.filePath === action.filePath);
      const fileId = ctx.createProjectFile({
        projectId: project.id,
        filePath: action.filePath,
        fileRole: action.fileRole ?? 'content',
        language: action.language ?? 'markdown',
        code: doc.content,
        replaceContent: action.replaceContent ?? true
      });
      if (!fileId) {
        return { ok: false, error: `参考资料转工作区文件失败：${action.filePath}` };
      }
      const deletedReference = ctx.deleteWorkspaceReferenceDoc(match.doc.id);
      if (!deletedReference) {
        return { ok: false, error: `参考资料已生成文件，但移出参考资料失败：${match.doc.title}` };
      }

      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }

      const createdFile = ctx.readProjectFile(fileId);
      const projectFile = createdFile ? toProjectFileFactFromDomain(createdFile) : undefined;
      const referenceFact = toWorkspaceReferenceFact(doc);
      return {
        ok: true,
        summary: `已把参考资料移成工作区文件 · ${doc.title} → ${action.filePath}`,
        detailText: [
          `参考资料：${doc.title}`,
          `目标文件：${action.filePath}`,
          beforeFile ? '动作：覆盖已有文件，并移出参考资料' : '动作：创建新文件，并移出参考资料'
        ].join('\n'),
        roomProjectId: project.id,
        projectFileId: fileId,
        projectFilePaths: [action.filePath],
        projectFiles: projectFile ? [projectFile] : undefined,
        projectFileEffects: createdFile ? [buildWholeFileEffect({
          projectId: createdFile.projectId,
          fileId,
          filePath: createdFile.filePath,
          operation: beforeFile ? 'overwritten' : 'created',
          beforeContent: beforeFile?.content,
          afterContent: createdFile.content
        })] : undefined,
        workspaceReferenceDocId: match.doc.id,
        workspaceReferenceDocTitle: doc.title,
        workspaceReferenceDocs: [referenceFact],
        workspaceReferenceDocReads: [{
          kind: 'doc',
          projectId: project.id,
          doc: referenceFact
        }]
      };
    }
    case 'pinProjectFileAsReference': {
      const project = ctx.readRoomProject(action.projectId);
      if (!project) {
        return { ok: false, error: '没有找到当前工作区。' };
      }
      if (!ctx.createWorkspaceReferenceDoc) {
        return { ok: false, error: '当前环境不能创建工作区参考资料。' };
      }
      const file = ctx.readProjectFile(action.fileId);
      if (!file || file.projectId !== project.id) {
        return { ok: false, error: '没有找到要钉为参考资料的工作区文件。' };
      }
      const title = action.title?.trim() || file.filePath;
      const summary = action.summary?.trim() || `由工作区文件 ${file.filePath} 钉为参考资料快照。`;
      const docId = ctx.createWorkspaceReferenceDoc({
        projectId: project.id,
        title,
        summary,
        content: file.content
      });
      if (!docId) {
        return { ok: false, error: `工作区文件钉为参考资料失败：${file.filePath}` };
      }
      const deletedFile = ctx.deleteProjectFile(file.id);
      if (!deletedFile) {
        return { ok: false, error: `工作区文件已生成参考资料，但移出项目文件失败：${file.filePath}` };
      }

      if (action.openInCollection) {
        revealCollectionShelf(ctx, 'project');
      }

      const doc = ctx.readWorkspaceReferenceDoc?.(docId) ?? null;
      const referenceFact = doc ? toWorkspaceReferenceFact(doc) : undefined;
      const projectFile = toProjectFileFactFromDomain(file);
      return {
        ok: true,
        summary: `已把工作区文件移为参考资料 · ${file.filePath} → ${title}`,
        detailText: [
          `源文件：${file.filePath}`,
          `参考资料：${title}`,
          '动作：创建参考资料，并移出项目文件'
        ].join('\n'),
        roomProjectId: project.id,
        projectFileId: file.id,
        projectFilePaths: [file.filePath],
        projectFiles: [projectFile],
        projectFileEffects: [buildWholeFileEffect({
          projectId: file.projectId,
          fileId: file.id,
          filePath: file.filePath,
          operation: 'deleted',
          beforeContent: file.content
        })],
        workspaceReferenceDocId: docId,
        workspaceReferenceDocTitle: title,
        workspaceReferenceDocs: referenceFact ? [referenceFact] : undefined
      };
    }
    case 'searchReadableContext': {
      const projectId = action.projectId?.trim() || '';
      const project = projectId ? ctx.readRoomProject(projectId) : null;
      const candidates: ReadableContextCandidate[] = [];

      if (project) {
        const files = resolveRoomProjectFiles(project, ctx.listProjectFiles(project.id));
        const fileResult = searchProjectFiles(files, {
          query: action.query,
          maxResults: action.maxResults
        });
        const seenFileIds = new Set<string>();
        for (const match of fileResult.returnedMatches) {
          if (seenFileIds.has(match.fileId)) continue;
          seenFileIds.add(match.fileId);
          candidates.push({
            source: 'project-file',
            id: match.fileId,
            projectId: project.id,
            title: match.filePath,
            path: match.filePath,
            matchKind: match.matchKind,
            readTool: 'readProjectFile',
            readArgs: {
              projectId: project.id,
              filePath: match.filePath
            },
            excerpt: match.excerpt || match.line
          });
        }

        const docs = await loadWorkspaceReferenceDocsForTool(ctx, ctx.listWorkspaceReferenceDocs?.(project.id) ?? []);
        const referenceResult = searchWorkspaceReferenceDocs(docs, action.query, action.maxResults);
        for (const match of referenceResult.returnedMatches) {
          candidates.push({
            source: 'workspace-reference',
            id: match.docId,
            projectId: project.id,
            title: match.title,
            matchKind: match.matchKind,
            readTool: 'readWorkspaceReference',
            readArgs: {
              projectId: project.id,
              docId: match.docId
            },
            excerpt: match.excerpt
          });
        }
      }

      const normalizedQuery = normalizeReferenceSearchText(action.query);
      const memoryDocs = ctx.listCollaboratorMemoryDocs?.() ?? [];
      for (const doc of memoryDocs) {
        if (candidates.length >= (action.maxResults ?? 12)) break;
        const docWithContent = ctx.readCollaboratorMemoryDoc
          ? await ctx.readCollaboratorMemoryDoc(doc.id).catch(() => null)
          : null;
        const content = docWithContent?.content ?? doc.content;
        const haystack = `${doc.title}\n${doc.summary}\n${content}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) continue;
        candidates.push({
          source: 'memory-doc',
          id: doc.id,
          title: doc.title,
          summary: doc.summary,
          matchKind: 'memory',
          readTool: 'readMemoryDoc',
          readArgs: {
            docId: doc.id
          },
          excerpt: buildReferenceExcerpt(content, action.query) || doc.summary
        });
      }

      const maxResults = action.maxResults ?? 12;
      const returnedCandidates = candidates.slice(0, Math.max(1, maxResults));
      return {
        ok: true,
        summary: `已搜索可读上下文 · ${returnedCandidates.length} 个候选`,
        detailText: formatReadableContextCandidates(returnedCandidates),
        readableContextCandidates: returnedCandidates,
        roomProjectId: project?.id
      };
    }
  }
}
