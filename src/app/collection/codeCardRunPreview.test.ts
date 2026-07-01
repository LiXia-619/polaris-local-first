import { describe, expect, it } from 'vitest';
import { buildCodeCardRunPreview } from './codeCardRunPreview';

describe('buildCodeCardRunPreview', () => {
  it('builds executable preview state for code cards', () => {
    const preview = buildCodeCardRunPreview({
      id: 'card-1',
      title: 'Mini App',
      language: 'html',
      code: '<button>Hello</button>'
    });

    expect(preview).toMatchObject({
      previewItemId: 'card-1',
      projectId: null,
      projectFileCount: null,
      title: 'Mini App',
      language: 'html',
      content: '<button>Hello</button>',
      presentation: 'code'
    });
    expect(preview.srcDoc).toContain('<button>Hello</button>');
  });

  it('keeps markdown cards in text reading mode', () => {
    const preview = buildCodeCardRunPreview({
      id: 'card-2',
      title: 'Notes',
      language: 'md',
      code: '# Hello'
    });

    expect(preview).toMatchObject({
      previewItemId: 'card-2',
      title: 'Notes',
      language: 'md',
      content: '# Hello',
      presentation: 'text',
      srcDoc: null
    });
  });
});
