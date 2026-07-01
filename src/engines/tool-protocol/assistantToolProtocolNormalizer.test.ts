import { describe, expect, it } from 'vitest';
import { normalizeAssistantToolActionValue } from './assistantToolProtocolNormalizer';

describe('normalizeAssistantToolActionValue', () => {
  it('keeps non-action payloads untouched', () => {
    const payload = { action: 'createCodeCard', code: 'hello' };

    expect(normalizeAssistantToolActionValue(payload)).toBe(payload);
    expect(normalizeAssistantToolActionValue(null)).toBe(null);
    expect(normalizeAssistantToolActionValue([{ kind: 'createCodeCard' }])).toEqual([{ kind: 'createCodeCard' }]);
  });

  it('normalizes nested and flat createCodeCard payloads into the card field', () => {
    expect(normalizeAssistantToolActionValue({
      kind: 'createCodeCard',
      title: 'Flat title',
      language: 'html',
      content: '<main>hello</main>',
      cardNote: '',
      cardFaceCss: '& { color: red; }',
      tags: [' demo ', '', 'room']
    })).toMatchObject({
      kind: 'createCodeCard',
      card: {
        title: 'Flat title',
        language: 'html',
        code: '<main>hello</main>',
        cardNote: '',
        cardFaceCss: '& { color: red; }',
        tags: ['demo', 'room']
      }
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'createCodeCard',
      title: 'Outer title',
      card: {
        kind: 'tool',
        title: 'Nested title',
        html: '<section>nested</section>',
        tags: ['nested']
      }
    })).toMatchObject({
      card: {
        kind: 'tool',
        title: 'Nested title',
        code: '<section>nested</section>',
        tags: ['nested']
      }
    });
  });

  it('normalizes project file creation from nested file/card payloads and snake-case fields', () => {
    expect(normalizeAssistantToolActionValue({
      kind: 'createProjectFile',
      project_id: 'project-1',
      file_path: 'index.html',
      file_role: 'entry',
      language: 'html',
      code: '<main>flat</main>'
    })).toMatchObject({
      file: {
        projectId: 'project-1',
        filePath: 'index.html',
        fileRole: 'entry',
        language: 'html',
        code: '<main>flat</main>'
      }
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'createProjectFile',
      card: {
        project_id: 'project-card',
        file_path: 'src/main.js',
        file_role: 'logic',
        code: ''
      }
    })).toMatchObject({
      file: {
        projectId: 'project-card',
        filePath: 'src/main.js',
        fileRole: 'logic',
        code: ''
      }
    });
  });

  it('normalizes room project shell edits without mixing them with file content', () => {
    expect(normalizeAssistantToolActionValue({
      kind: 'patchRoomProject',
      project_id: 'project-1',
      project: {
        title: 'New cover',
        cover_note: 'tiny note',
        cover_css: '& { color: gold; }',
        tags: [' ui ', 'demo']
      },
      code: '<main>must not become a file body</main>'
    })).toMatchObject({
      projectId: 'project-1',
      patch: {
        title: 'New cover',
        coverNote: 'tiny note',
        coverStyle: '& { color: gold; }',
        tags: ['ui', 'demo']
      }
    });
  });

  it('normalizes append/insert/edit/delete project file aliases into explicit filePath operations', () => {
    expect(normalizeAssistantToolActionValue({
      kind: 'appendProjectFile',
      projectId: 'project-1',
      filePath: 'index.html',
      appendCode: '<footer>tail</footer>'
    })).toMatchObject({
      projectId: 'project-1',
      filePath: 'index.html',
      code: '<footer>tail</footer>'
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'insertProjectFile',
      project_id: 'project-1',
      file_path: 'index.html',
      position: 'before',
      anchor: '</main>',
      insert_code: '<aside>note</aside>'
    })).toMatchObject({
      projectId: 'project-1',
      filePath: 'index.html',
      beforeString: '</main>',
      afterString: undefined,
      code: '<aside>note</aside>'
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'editProjectFileText',
      project_id: 'project-1',
      file_path: 'src/main.js',
      find: 'old();',
      replace: ''
    })).toMatchObject({
      projectId: 'project-1',
      filePath: 'src/main.js',
      oldString: 'old();',
      newString: ''
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'deleteProjectFile',
      project_id: 'project-1',
      file_path: 'unused.css'
    })).toMatchObject({
      projectId: 'project-1',
      filePath: 'unused.css'
    });
  });

  it('normalizes multi-file writes from file array aliases while preserving replaceContent', () => {
    expect(normalizeAssistantToolActionValue({
      kind: 'writeProjectFiles',
      project_id: 'project-1',
      language: 'text',
      file: [
        {
          file_path: 'index.html',
          file_role: 'entry',
          content: '<main>Hello</main>',
          replaceContent: true
        },
        {
          filePath: 'notes.txt',
          code: '',
          replaceContent: false
        }
      ]
    })).toMatchObject({
      projectId: 'project-1',
      files: [
        {
          filePath: 'index.html',
          fileRole: 'entry',
          language: 'text',
          code: '<main>Hello</main>',
          replaceContent: true
        },
        {
          filePath: 'notes.txt',
          language: 'text',
          code: '',
          replaceContent: false
        }
      ]
    });
  });

  it('normalizes read and search aliases for project context lookups', () => {
    expect(normalizeAssistantToolActionValue({
      kind: 'readProjectFile',
      project_id: 'project-1',
      file_path: 'index.html'
    })).toMatchObject({
      projectId: 'project-1',
      filePath: 'index.html'
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'searchProjectFiles',
      project_id: 'project-1',
      needle: 'renderApp'
    })).toMatchObject({
      projectId: 'project-1',
      query: 'renderApp'
    });

    expect(normalizeAssistantToolActionValue({
      kind: 'readProjectFileContext',
      project_id: 'project-1',
      file_path: 'src/main.js',
      search: 'mount'
    })).toMatchObject({
      projectId: 'project-1',
      filePath: 'src/main.js',
      query: 'mount'
    });
  });
});
