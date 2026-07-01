import { describe, expect, it } from 'vitest';
import {
  buildNextWorkspaceFilePath,
  buildNextWorkspaceTitle,
  inferManualProjectFileRole
} from './projectWorkspaceCreation';

describe('projectWorkspaceCreation', () => {
  it('increments duplicate workspace titles instead of reusing the same label', () => {
    expect(buildNextWorkspaceTitle(['新工作区', '新工作区 2'])).toBe('新工作区 3');
  });

  it('keeps unique workspace file paths stable and dedupes duplicates in place', () => {
    expect(buildNextWorkspaceFilePath(['index.html'], 'index.html')).toBe('index-2.html');
    expect(buildNextWorkspaceFilePath(['app/index.html'], './app/index.html')).toBe('app/index-2.html');
  });

  it('infers manual project file roles from file type', () => {
    expect(inferManualProjectFileRole('index.html', 'html')).toBe('entry');
    expect(inferManualProjectFileRole('styles/app.css', 'css')).toBe('style');
    expect(inferManualProjectFileRole('scripts/app.ts', 'typescript')).toBe('logic');
    expect(inferManualProjectFileRole('notes/spec.md', 'markdown')).toBe('content');
  });
});
