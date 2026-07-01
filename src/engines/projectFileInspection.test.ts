import { describe, expect, it } from 'vitest';
import { searchProjectFiles } from './projectFileInspection';
import type { ResolvedRoomProjectFile } from './roomProjects';

function projectFile(seed: Partial<ResolvedRoomProjectFile> & Pick<ResolvedRoomProjectFile, 'fileId' | 'path' | 'content'>): ResolvedRoomProjectFile {
  const file: ResolvedRoomProjectFile = {
    title: seed.path.split('/').pop() || seed.path,
    language: seed.language ?? 'javascript',
    isEntry: seed.isEntry ?? false,
    ...seed
  };
  if (seed.role) file.role = seed.role;
  return file;
}

describe('searchProjectFiles', () => {
  it('returns context windows for exact code matches', () => {
    const result = searchProjectFiles([
      projectFile({
        fileId: 'engine',
        path: 'engine.js',
        content: [
          'function loadGame() {',
          '  hydrateState();',
          '  return true;',
          '}',
          'renderSaveSlots();'
        ].join('\n')
      })
    ], {
      query: 'return true',
      maxResults: 5
    });

    expect(result.totalMatches).toBe(1);
    expect(result.returnedMatches[0]).toMatchObject({
      filePath: 'engine.js',
      lineNumber: 3,
      matchKind: 'content',
      matchReason: '精确匹配',
      excerptStartLine: 1,
      excerptEndLine: 5
    });
    expect(result.returnedMatches[0]?.excerpt).toContain('2:   hydrateState();');
    expect(result.returnedMatches[0]?.excerpt).toContain('4: }');
  });

  it('locates code with case-insensitive and multi-term matching', () => {
    const result = searchProjectFiles([
      projectFile({
        fileId: 'app',
        path: 'scripts/app.js',
        content: [
          'const currentSaveSlot = getSelectedSlot();',
          'renderSaveSlots(currentSaveSlot);'
        ].join('\n')
      })
    ], {
      query: 'render save slots',
      maxResults: 5
    });

    expect(result.totalMatches).toBe(1);
    expect(result.returnedMatches[0]).toMatchObject({
      filePath: 'scripts/app.js',
      lineNumber: 2,
      matchReason: '多词匹配'
    });
  });

  it('matches file paths so models can find likely files before reading them', () => {
    const result = searchProjectFiles([
      projectFile({
        fileId: 'styles',
        path: 'styles/save-slots.css',
        language: 'css',
        content: '.slot-grid { display: grid; }'
      })
    ], {
      query: 'save slots',
      maxResults: 5
    });

    expect(result.totalMatches).toBe(1);
    expect(result.returnedMatches[0]).toMatchObject({
      filePath: 'styles/save-slots.css',
      matchKind: 'path',
      matchReason: '路径匹配'
    });
  });
});
