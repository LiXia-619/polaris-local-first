import { createDomainObjectBase } from '../engines/domainObject';
import type { WorkspaceReferenceDoc } from '../types/domain';
import { wouldEraseUnloadedReferenceDocBody } from './referenceDocBodyState';

export type WorkspaceReferenceDocPatch = Partial<
  Pick<WorkspaceReferenceDoc, 'title' | 'summary' | 'content' | 'charCount' | 'contentLoaded' | 'ownerCollaboratorId' | 'source'>
>;

export function sortWorkspaceReferenceDocs(docs: WorkspaceReferenceDoc[]) {
  return [...docs].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function normalizeWorkspaceReferenceDoc(
  doc: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'id' | 'projectId' | 'title' | 'content'>
): WorkspaceReferenceDoc {
  const createdAt = typeof doc.createdAt === 'number' ? doc.createdAt : Date.now();
  const updatedAt = typeof doc.updatedAt === 'number' ? doc.updatedAt : createdAt;
  const content = typeof doc.content === 'string' ? doc.content : '';
  const summary = typeof doc.summary === 'string' ? doc.summary.trim() : '';
  const charCount = typeof doc.charCount === 'number' ? doc.charCount : content.length;

  return {
    id: doc.id.trim(),
    projectId: doc.projectId.trim(),
    title: doc.title.trim() || '未命名资料',
    summary,
    content,
    charCount,
    contentLoaded: doc.contentLoaded === true,
    ownerCollaboratorId:
      typeof doc.ownerCollaboratorId === 'string' && doc.ownerCollaboratorId.trim()
        ? doc.ownerCollaboratorId
        : undefined,
    source: doc.source ?? 'manual',
    createdAt,
    updatedAt,
    originConversationId: doc.originConversationId,
    originMessageId: doc.originMessageId
  };
}

export function createWorkspaceReferenceDocEntry(
  seed: Partial<WorkspaceReferenceDoc> & Pick<WorkspaceReferenceDoc, 'projectId' | 'title'> & { content?: string }
) {
  return normalizeWorkspaceReferenceDoc({
    ...createDomainObjectBase('workspace-ref', seed),
    projectId: seed.projectId,
    title: seed.title,
    summary: seed.summary,
    content: seed.content ?? '',
    ownerCollaboratorId: seed.ownerCollaboratorId,
    source: seed.source,
    originConversationId: seed.originConversationId,
    originMessageId: seed.originMessageId
  });
}

export function wouldEraseUnloadedWorkspaceReferenceContent(doc: WorkspaceReferenceDoc, content: string) {
  return wouldEraseUnloadedReferenceDocBody(doc, content);
}

export function patchWorkspaceReferenceDocs(
  docs: WorkspaceReferenceDoc[],
  docId: string,
  patch: WorkspaceReferenceDocPatch
) {
  return sortWorkspaceReferenceDocs(
    docs.map((doc) => {
      if (doc.id !== docId) return doc;
      const contentPatchRejected = patch.content !== undefined
        && wouldEraseUnloadedWorkspaceReferenceContent(doc, patch.content);
      const contentPatch = patch.content !== undefined && !contentPatchRejected ? patch.content : undefined;
      const charCountPatch = contentPatchRejected
        ? doc.charCount
        : patch.charCount ?? (contentPatch !== undefined ? contentPatch.length : doc.charCount);
      const contentLoadedPatch = contentPatchRejected
        ? doc.contentLoaded
        : patch.contentLoaded ?? (contentPatch !== undefined ? true : doc.contentLoaded);
      return normalizeWorkspaceReferenceDoc({
        ...doc,
        title: patch.title ?? doc.title,
        summary: patch.summary ?? doc.summary,
        content: contentPatch ?? doc.content,
        charCount: charCountPatch,
        contentLoaded: contentLoadedPatch,
        ownerCollaboratorId:
          patch.ownerCollaboratorId !== undefined ? patch.ownerCollaboratorId : doc.ownerCollaboratorId,
        source: patch.source ?? doc.source,
        updatedAt: Date.now()
      });
    })
  );
}

export function removeWorkspaceReferenceDoc(docs: WorkspaceReferenceDoc[], docId: string) {
  return docs.filter((doc) => doc.id !== docId);
}
