import { describe, expect, it } from 'vitest';
import type { ProjectFile, RoomProject } from '../types/domain';
import { buildRoomProjectPreview, checkRoomProjectPreview } from './roomProjectPreview';

function makeProjectFile(
  seed: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId' | 'filePath' | 'language' | 'content' | 'source' | 'createdAt' | 'updatedAt'>
): ProjectFile {
  return {
    ...seed
  };
}

describe('buildRoomProjectPreview', () => {
  it('inlines project css and script files into the entry html preview', () => {
    const project: RoomProject = {
      id: 'proj-1',
      title: 'Landing Refresh',
      slug: 'landing-refresh',
      entryFileId: 'card-html',
      fileIds: ['card-html', 'card-css', 'card-js'],
      tags: [],
      source: 'chat-generated',
      createdAt: 1,
      updatedAt: 1
    };

    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-1',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        content: '<!doctype html><html><head><link rel="stylesheet" href="./styles/main.css"></head><body><div class="login-card">hi</div><script src="./scripts/app.js"></script></body></html>',
        source: 'chat-generated',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-css',
        projectId: 'proj-1',
        filePath: 'styles/main.css',
        fileRole: 'style',
        language: 'css',
        content: '.login-card { color: hotpink; }',
        source: 'chat-generated',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-js',
        projectId: 'proj-1',
        filePath: 'scripts/app.js',
        fileRole: 'logic',
        language: 'javascript',
        content: 'console.log("hello");',
        source: 'chat-generated',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const preview = buildRoomProjectPreview(project, projectFiles);

    expect(preview?.entryFileId).toBe('card-html');
    expect(preview?.srcDoc).toContain('<style data-room-project-path="styles/main.css">');
    expect(preview?.srcDoc).toContain('.login-card { color: hotpink; }');
    expect(preview?.srcDoc).toContain('data-room-project-path="scripts/app.js"');
    expect(preview?.srcDoc).toContain('console.log("hello");');
    expect(preview?.srcDoc).toContain('data-room-project-probe="start"');
    expect(preview?.srcDoc).toContain('filePath:"scripts/app.js"');
    expect(preview?.srcDoc).toContain('//# sourceURL=polaris-project:///scripts/app.js');
    expect(preview?.content).toContain('// index.html [entry]');
    expect(preview?.content).toContain('// styles/main.css');
    expect(preview?.presentation).toBe('code');
  });

  it('annotates inline entry scripts with source labels for runtime diagnostics', () => {
    const project: RoomProject = {
      id: 'proj-inline',
      title: 'Inline App',
      slug: 'inline-app',
      entryFileId: 'inline-html',
      fileIds: ['inline-html'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };
    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'inline-html',
        projectId: 'proj-inline',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        content: '<!doctype html><html><body><script>window.ready = true;</script></body></html>',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const preview = buildRoomProjectPreview(project, projectFiles);

    expect(preview?.srcDoc).toContain('filePath:"index.html#inline-script-1"');
    expect(preview?.srcDoc).toContain('//# sourceURL=polaris-project:///index.html%23inline-script-1');
    expect(preview?.srcDoc).toContain('window.__polarisRuntimeScriptProbe=null;');
  });

  it('prefers a real html entry even when the stored entry card points at css', () => {
    const project: RoomProject = {
      id: 'proj-css-entry',
      title: 'Theme Lab',
      slug: 'theme-lab',
      entryFileId: 'card-css',
      fileIds: ['card-css', 'card-html'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };

    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-css',
        projectId: 'proj-css-entry',
        filePath: 'styles/theme.css',
        fileRole: 'style',
        language: 'css',
        content: '.sample { color: hotpink; }',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-css-entry',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        content: '<!doctype html><html><head><link rel="stylesheet" href="./styles/theme.css"></head><body><div class="sample">hello</div></body></html>',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const preview = buildRoomProjectPreview(project, projectFiles);

    expect(preview?.entryFileId).toBe('card-html');
    expect(preview?.presentation).toBe('code');
    expect(preview?.srcDoc).toContain('<style data-room-project-path="styles/theme.css">');
    expect(preview?.srcDoc).not.toContain('Polaris Preview');
  });

  it('returns an explicit non-runnable project note when no html entry exists', () => {
    const project: RoomProject = {
      id: 'proj-no-html',
      title: 'Theme Only',
      slug: 'theme-only',
      entryFileId: 'card-css',
      fileIds: ['card-css'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };

    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-css',
        projectId: 'proj-no-html',
        filePath: 'styles/theme.css',
        fileRole: 'style',
        language: 'css',
        content: '.sample { color: hotpink; }',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const preview = buildRoomProjectPreview(project, projectFiles);

    expect(preview?.entryFileId).toBeNull();
    expect(preview?.presentation).toBe('text');
    expect(preview?.srcDoc).toBeNull();
    expect(preview?.content).toContain('这个工作区现在还没有可运行的 HTML 入口');
    expect(preview?.content).toContain('// styles/theme.css');
  });

  it('reports project script syntax errors before runtime inspection', () => {
    const project: RoomProject = {
      id: 'proj-broken-js',
      title: 'Broken JS',
      slug: 'broken-js',
      entryFileId: 'card-html',
      fileIds: ['card-html', 'card-js'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };
    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-broken-js',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        content: '<!doctype html><html><body><script src="./scripts/level1.js"></script></body></html>',
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      }),
      makeProjectFile({
        id: 'card-js',
        projectId: 'proj-broken-js',
        filePath: 'scripts/level1.js',
        fileRole: 'logic',
        language: 'javascript',
        content: [
          'const scenes = {',
          '  intro: { text: "hello" }'
        ].join('\n'),
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const check = checkRoomProjectPreview(project, projectFiles);
    const error = check.diagnostics.find((diagnostic) => diagnostic.severity === 'error');

    expect(error).toMatchObject({
      severity: 'error',
      filePath: 'scripts/level1.js',
      lineNumber: 1
    });
    expect(error?.message).toContain('没有对应的 }');
    expect(error?.excerpt).toContain('> 1: const scenes = {');
  });

  it('maps inline script syntax errors back to the entry file line', () => {
    const project: RoomProject = {
      id: 'proj-inline-broken',
      title: 'Inline Broken',
      slug: 'inline-broken',
      entryFileId: 'card-html',
      fileIds: ['card-html'],
      tags: [],
      source: 'manual',
      createdAt: 1,
      updatedAt: 1
    };
    const projectFiles: ProjectFile[] = [
      makeProjectFile({
        id: 'card-html',
        projectId: 'proj-inline-broken',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        content: [
          '<!doctype html>',
          '<html>',
          '<body>',
          '<script>',
          'const label = "broken;',
          '</script>',
          '</body>',
          '</html>'
        ].join('\n'),
        source: 'manual',
        createdAt: 1,
        updatedAt: 1
      })
    ];

    const check = checkRoomProjectPreview(project, projectFiles);
    const error = check.diagnostics.find((diagnostic) => diagnostic.severity === 'error');

    expect(error).toMatchObject({
      severity: 'error',
      filePath: 'index.html#inline-script-1',
      lineNumber: 5
    });
    expect(error?.message).toContain('字符串没有闭合');
  });
});
