import { describe, expect, it } from 'vitest';
import { describeWorkspaceEditorInvariantViolation } from './workspaceEditorInvariant';

describe('describeWorkspaceEditorInvariantViolation', () => {
  it('stays quiet outside edit mode', () => {
    expect(describeWorkspaceEditorInvariantViolation({
      workshopMode: 'create',
      activeCardId: null,
      activeProjectFileId: null,
      hasActiveCard: false,
      hasActiveProjectFile: false
    })).toBeNull();
  });

  it('flags edit mode without any active owner', () => {
    expect(describeWorkspaceEditorInvariantViolation({
      workshopMode: 'edit',
      activeCardId: null,
      activeProjectFileId: null,
      hasActiveCard: false,
      hasActiveProjectFile: false
    })).toBe('edit mode opened without an active room card or project file.');
  });

  it('flags edit mode that points at both a card and a project file', () => {
    expect(describeWorkspaceEditorInvariantViolation({
      workshopMode: 'edit',
      activeCardId: 'card-1',
      activeProjectFileId: 'file-1',
      hasActiveCard: true,
      hasActiveProjectFile: true
    })).toBe('edit mode cannot target both a room card and a project file at the same time.');
  });

  it('flags missing project file owners separately from missing cards', () => {
    expect(describeWorkspaceEditorInvariantViolation({
      workshopMode: 'edit',
      activeCardId: null,
      activeProjectFileId: 'file-9',
      hasActiveCard: false,
      hasActiveProjectFile: false
    })).toBe('edit mode targeted missing project file file-9.');
  });
});
