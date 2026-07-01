import { describe, expect, it } from 'vitest';
import { parseProjectFileToolAction } from './assistantToolProtocolActionProjectFiles';

describe('parseProjectFileToolAction', () => {
  it('uses the active workspace id for createProjectFile when projectId is omitted', () => {
    expect(parseProjectFileToolAction({
      kind: 'createProjectFile',
      file: {
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        code: '<main>Nova</main>'
      }
    }, {
      activeProjectId: 'workspace-nova-diary'
    })).toEqual({
      action: {
        kind: 'createProjectFile',
        file: {
          projectId: 'workspace-nova-diary',
          filePath: 'index.html',
          fileRole: 'entry',
          language: 'html',
          code: '<main>Nova</main>'
        },
        targetLabel: undefined,
        openInCollection: false
      }
    });
  });

  it('uses the active workspace id for project file actions when projectId is omitted', () => {
    const context = { activeProjectId: 'workspace-nova-diary' };

    expect(parseProjectFileToolAction({
      kind: 'appendProjectFile',
      filePath: 'index.html',
      code: '<section>next</section>'
    }, context)).toMatchObject({
      action: {
        kind: 'appendProjectFile',
        projectId: 'workspace-nova-diary',
        filePath: 'index.html'
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'insertProjectFile',
      filePath: 'index.html',
      beforeString: '</main>',
      code: '<section>inserted</section>'
    }, context)).toMatchObject({
      action: {
        kind: 'insertProjectFile',
        projectId: 'workspace-nova-diary',
        filePath: 'index.html'
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'writeProjectFiles',
      files: [{
        filePath: 'notes.md',
        language: 'markdown',
        code: '# Notes'
      }]
    }, context)).toMatchObject({
      action: {
        kind: 'writeProjectFiles',
        projectId: 'workspace-nova-diary'
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'editProjectFileText',
      filePath: 'index.html',
      oldString: 'old',
      newString: 'new'
    }, context)).toMatchObject({
      action: {
        kind: 'editProjectFileText',
        projectId: 'workspace-nova-diary',
        filePath: 'index.html'
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'replaceProjectFileLines',
      filePath: 'index.html',
      startLine: 8,
      endLine: 9,
      code: 'new line'
    }, context)).toMatchObject({
      action: {
        kind: 'replaceProjectFileLines',
        projectId: 'workspace-nova-diary',
        filePath: 'index.html'
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'deleteProjectFile',
      filePath: 'stale.js'
    }, context)).toMatchObject({
      action: {
        kind: 'deleteProjectFile',
        projectId: 'workspace-nova-diary',
        filePath: 'stale.js'
      }
    });
  });

  it('keeps an explicit projectId so the workspace boundary check can reject cross-workspace writes', () => {
    expect(parseProjectFileToolAction({
      kind: 'appendProjectFile',
      projectId: 'other-workspace',
      filePath: 'index.html',
      code: '<section>wrong scope</section>'
    }, {
      activeProjectId: 'workspace-nova-diary'
    })).toMatchObject({
      action: {
        kind: 'appendProjectFile',
        projectId: 'other-workspace',
        filePath: 'index.html'
      }
    });
  });

  it('parses project file insertion by line or anchor without changing semantics', () => {
    expect(parseProjectFileToolAction({
      kind: 'insertProjectFile',
      projectId: 'mini-phone',
      filePath: 'styles/main.css',
      beforeString: '.app-shell {',
      code: '.phone-frame { overflow: hidden; }\n'
    })).toEqual({
      action: {
        kind: 'insertProjectFile',
        target: undefined,
        projectId: 'mini-phone',
        filePath: 'styles/main.css',
        targetLabel: undefined,
        beforeString: '.app-shell {',
        afterString: undefined,
        code: '.phone-frame { overflow: hidden; }\n',
        openInCollection: undefined
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'insertProjectFile',
      projectId: 'mini-phone',
      filePath: 'scenes-level1.js',
      lineNumber: 961,
      linePosition: 'after',
      code: '  endings: [],\n'
    })).toEqual({
      action: {
        kind: 'insertProjectFile',
        target: undefined,
        projectId: 'mini-phone',
        filePath: 'scenes-level1.js',
        targetLabel: undefined,
        beforeString: undefined,
        afterString: undefined,
        lineNumber: 961,
        linePosition: 'after',
        code: '  endings: [],\n',
        openInCollection: undefined
      }
    });
  });

  it('parses write batches, search, read, and text edit project file actions', () => {
    expect(parseProjectFileToolAction({
      kind: 'writeProjectFiles',
      projectId: 'mini-phone',
      files: [{
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        code: '<main />',
        replaceContent: false
      }]
    })).toEqual({
      action: {
        kind: 'writeProjectFiles',
        projectId: 'mini-phone',
        targetLabel: undefined,
        files: [{
          filePath: 'index.html',
          fileRole: 'entry',
          language: 'html',
          code: '<main />',
          replaceContent: false
        }],
        openInCollection: undefined
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'searchProjectFiles',
      projectId: 'mini-phone',
      query: 'initApi',
      maxResults: 8
    })).toMatchObject({
      action: {
        kind: 'searchProjectFiles',
        projectId: 'mini-phone',
        query: 'initApi',
        maxResults: 8
      }
    });

    expect(parseProjectFileToolAction({
      kind: 'editProjectFileText',
      projectId: 'mini-phone',
      filePath: 'index.html',
      oldString: '<main></main>',
      newString: '<main><section>lock</section></main>'
    })).toMatchObject({
      action: {
        kind: 'editProjectFileText',
        projectId: 'mini-phone',
        filePath: 'index.html',
        oldString: '<main></main>',
        newString: '<main><section>lock</section></main>'
      }
    });
  });

  it('returns null for non project-file actions and issues for invalid project-file payloads', () => {
    expect(parseProjectFileToolAction({ kind: 'readCodeCard', target: 'active' })).toBeNull();

    expect(parseProjectFileToolAction({
      kind: 'searchProjectFiles',
      query: '   '
    })).toEqual({
      action: null,
      issue: '搜索工作区文件时缺少 query。'
    });
  });
});
