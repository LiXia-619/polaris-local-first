import { describe, expect, it } from 'vitest';
import { recoverTruncatedNativeProjectActions } from './chatTruncatedProjectRecovery';

describe('recoverTruncatedNativeProjectActions', () => {
  it('recovers a project file shell and partial code from an unfinished native tool call', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'createProjectFile',
      argumentsText: '{"projectId":"mini-phone","filePath":"index.html","language":"html","code":"<main>\\n  <section>'
    }]);

    expect(actions).toEqual([{
      kind: 'createProjectFile',
      file: {
        projectId: 'mini-phone',
        filePath: 'index.html',
        fileRole: undefined,
        language: 'html',
        code: '<main>\n  <section>'
      },
      openInCollection: false
    }]);
  });

  it('recovers appendProjectFile chunks with project file coordinates', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'appendProjectFile',
      argumentsText: '{"project_id":"mini-phone","file_path":"scripts/app.js","code":"const ready = true;'
    }]);

    expect(actions).toEqual([{
      kind: 'appendProjectFile',
      projectId: 'mini-phone',
      filePath: 'scripts/app.js',
      code: 'const ready = true;',
      openInCollection: false
    }]);
  });

  it('recovers insertProjectFile chunks with project file coordinates and anchors', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'insertProjectFile',
      argumentsText: '{"project_id":"mini-phone","file_path":"styles/main.css","before_selector":".app-shell {","code":".phone-frame { overflow: hidden; }'
    }]);

    expect(actions).toEqual([{
      kind: 'insertProjectFile',
      projectId: 'mini-phone',
      filePath: 'styles/main.css',
      beforeString: '.app-shell {',
      afterString: undefined,
      code: '.phone-frame { overflow: hidden; }',
      openInCollection: false
    }]);
  });

  it('keeps appendCodeCard as a room append even if stale project coordinates are present', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'appendCodeCard',
      argumentsText: '{"project_id":"mini-phone","file_path":"scripts/app.js","code":"const ready = true;'
    }]);

    expect(actions).toEqual([{
      kind: 'appendCodeCard',
      target: undefined,
      code: 'const ready = true;',
      openInCollection: false
    }]);
  });

  it('recovers editProjectFileText chunks with project file coordinates', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'editProjectFileText',
      argumentsText:
        '{"project_id":"mini-phone","file_path":"scripts/app.js","old_string":"const ready = false;","new_string":"const ready = true;'
    }]);

    expect(actions).toEqual([{
      kind: 'editProjectFileText',
      projectId: 'mini-phone',
      filePath: 'scripts/app.js',
      oldString: 'const ready = false;',
      newString: 'const ready = true;',
      openInCollection: false
    }]);
  });

  it('recovers replaceProjectFileLines chunks with project file coordinates and line numbers', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'replaceProjectFileLines',
      argumentsText:
        '{"project_id":"mini-phone","file_path":"index.html","start_line":675,"end_line":677,"code":"  <button>Random</button>'
    }]);

    expect(actions).toEqual([{
      kind: 'replaceProjectFileLines',
      projectId: 'mini-phone',
      filePath: 'index.html',
      startLine: 675,
      endLine: 677,
      code: '  <button>Random</button>',
      openInCollection: false
    }]);
  });

  it('keeps editCodeCardText as a room edit even if stale project coordinates are present', () => {
    const actions = recoverTruncatedNativeProjectActions([{
      name: 'editCodeCardText',
      argumentsText:
        '{"project_id":"mini-phone","file_path":"scripts/app.js","old_string":"const ready = false;","new_string":"const ready = true;'
    }]);

    expect(actions).toEqual([{
      kind: 'editCodeCardText',
      target: undefined,
      oldString: 'const ready = false;',
      newString: 'const ready = true;',
      openInCollection: false
    }]);
  });
});
