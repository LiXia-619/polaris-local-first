import { describe, expect, it } from 'vitest';
import { patchWorkspaceReferenceDocs } from './collectionStoreWorkspaceReferences';
import type { WorkspaceReferenceDoc } from '../types/domain';

function makeDoc(patch: Partial<WorkspaceReferenceDoc> = {}): WorkspaceReferenceDoc {
  return {
    id: 'doc-1',
    projectId: 'project-1',
    title: 'Reference',
    summary: '',
    content: '',
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...patch
  };
}

describe('patchWorkspaceReferenceDocs', () => {
  it('does not let an empty patch erase an unloaded body count', () => {
    const [doc] = patchWorkspaceReferenceDocs([
      makeDoc({
        charCount: 42,
        contentLoaded: false
      })
    ], 'doc-1', {
      content: '',
      charCount: 0,
      contentLoaded: true
    });

    expect(doc).toEqual(expect.objectContaining({
      content: '',
      charCount: 42,
      contentLoaded: false
    }));
  });

  it('allows clearing a body after the document is loaded', () => {
    const [doc] = patchWorkspaceReferenceDocs([
      makeDoc({
        content: 'loaded body',
        charCount: 'loaded body'.length,
        contentLoaded: true
      })
    ], 'doc-1', {
      content: ''
    });

    expect(doc).toEqual(expect.objectContaining({
      content: '',
      charCount: 0,
      contentLoaded: true
    }));
  });
});
