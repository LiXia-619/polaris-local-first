import { describe, expect, it } from 'vitest';
import { extractProjectFileDraftActions } from './assistantProjectFileDrafts';

describe('extractProjectFileDraftActions', () => {
  it('turns a visible project file block into file actions for the current workspace', () => {
    const result = extractProjectFileDraftActions([
      '先落入口文件。',
      '```polaris-project-file {"projectId":"mini-phone","projectTitle":"Mini Phone","filePath":"index.html","language":"html","fileRole":"entry","mode":"replace"}',
      '<main>Hello</main>',
      '```'
    ].join('\n'));

    expect(result.issues).toEqual([]);
    expect(result.displayContent.trim()).toBe('先落入口文件。');
    expect(result.actions).toEqual([{
      kind: 'writeProjectFiles',
      projectId: 'mini-phone',
      files: [{
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        code: '<main>Hello</main>\n',
        replaceContent: true
      }],
      openInCollection: false
    }]);
  });

  it('keeps an unfinished project file block executable with the partial body', () => {
    const result = extractProjectFileDraftActions([
      '```polaris-project-file {"projectId":"mini-phone","filePath":"scripts/app.js","mode":"append"}',
      'const ready = true;'
    ].join('\n'));

    expect(result.issues).toEqual([]);
    expect(result.displayContent).toBe('');
    expect(result.actions).toEqual([
      {
        kind: 'createProjectFile',
        file: {
          projectId: 'mini-phone',
          filePath: 'scripts/app.js',
          fileRole: undefined,
          language: 'javascript',
          code: '',
          replaceContent: false
        },
        openInCollection: false
      },
      {
        kind: 'appendProjectFile',
        projectId: 'mini-phone',
        filePath: 'scripts/app.js',
        code: 'const ready = true;',
        openInCollection: false
      }
    ]);
  });

  it('keeps a header-only replace block as an empty file shell', () => {
    const result = extractProjectFileDraftActions(
      '```polaris-project-file {"projectId":"mini-phone","filePath":"notes/todo.md","language":"markdown","mode":"replace"}\n```'
    );

    expect(result.issues).toEqual([]);
    expect(result.actions).toEqual([{
      kind: 'writeProjectFiles',
      projectId: 'mini-phone',
      files: [{
        filePath: 'notes/todo.md',
        fileRole: undefined,
        language: 'markdown',
        code: '',
        replaceContent: true
      }],
      openInCollection: false
    }]);
  });

  it('can project the draft body as code for streaming display', () => {
    const result = extractProjectFileDraftActions([
      '```polaris-project-file {"projectId":"mini-phone","filePath":"scripts/app.js","mode":"append"}',
      'const ready = true;'
    ].join('\n'), { preserveDraftBodyInDisplay: true });

    expect(result.issues).toEqual([]);
    expect(result.displayContent).toContain('```javascript\nconst ready = true;\n```');
    expect(result.actions[1]).toMatchObject({
      kind: 'appendProjectFile',
      projectId: 'mini-phone',
      filePath: 'scripts/app.js',
      code: 'const ready = true;'
    });
  });
});
