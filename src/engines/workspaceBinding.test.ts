import { describe, expect, it } from 'vitest';
import { isWorkspaceProjectAction } from './workspaceBinding';
import type { ProjectFile } from '../types/domain';

describe('workspaceBinding', () => {
  it('treats resolved project file mutations as workspace actions', () => {
    const projectFiles: ProjectFile[] = [{
      id: 'file-1',
      projectId: 'mini-phone',
      filePath: 'index.html',
      fileRole: 'entry',
      language: 'html',
      content: '<main />',
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 1
    }];

    expect(isWorkspaceProjectAction({
      kind: 'appendProjectFile',
      fileId: 'file-1',
      code: '\n<section />'
    }, projectFiles)).toBe(true);
  });
});
