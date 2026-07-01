import { describe, expect, it } from 'vitest';
import { classifyWorkspaceImportFile } from './workspaceImportClassification';

describe('classifyWorkspaceImportFile', () => {
  it('routes runnable project files to the project file lane', () => {
    expect(classifyWorkspaceImportFile({ name: 'index.html', type: 'text/html' })).toBe('project-file');
    expect(classifyWorkspaceImportFile({ name: 'src/App.tsx', type: 'text/plain' })).toBe('project-file');
    expect(classifyWorkspaceImportFile({ name: 'package.json', type: 'application/json' })).toBe('project-file');
  });

  it('routes document-like files to the reference lane', () => {
    expect(classifyWorkspaceImportFile({ name: 'notes.md', type: 'text/markdown' })).toBe('reference-doc');
    expect(classifyWorkspaceImportFile({ name: 'brief.pdf', type: 'application/pdf' })).toBe('reference-doc');
    expect(classifyWorkspaceImportFile({
      name: 'outline.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })).toBe('reference-doc');
  });

  it('leaves unsupported binary files out of workspace imports', () => {
    expect(classifyWorkspaceImportFile({ name: 'photo.png', type: 'image/png' })).toBe('unsupported');
    expect(classifyWorkspaceImportFile({ name: 'archive.zip', type: 'application/zip' })).toBe('unsupported');
  });
});
