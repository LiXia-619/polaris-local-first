import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CodeCard, RoomProject } from '../../../types/domain';
import { CodeCardGrid } from './CodeCardGrid';

function createProject(overrides: Partial<RoomProject> = {}): RoomProject {
  return {
    id: 'proj-1',
    title: 'Landing Refresh',
    slug: 'landing-refresh',
    fileIds: [],
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function createCard(overrides: Partial<CodeCard> = {}): CodeCard {
  return {
    id: 'card-1',
    title: 'index.html',
    language: 'html',
    code: '<main>Hello</main>',
    tags: [],
    source: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

describe('CodeCardGrid', () => {
  it('shows empty room projects in the collection shelf', () => {
    const html = renderToStaticMarkup(createElement(CodeCardGrid, {
      cardsExpanded: false,
      viewMode: 'cards',
      roomTags: [],
      cards: [],
      projectFiles: [],
      roomProjects: [createProject()],
      activeCardId: null,
      spotlightCardId: null,
      resolveOriginCopy: () => null,
      onOpenProject: () => {},
      onOpenCard: () => {},
      onRunCard: () => {},
      onDeleteCard: () => {},
      onToggleCardPinned: () => {},
      onToggleProjectPinned: () => {}
    }));

    expect(html).toContain('Landing Refresh');
    expect(html).toContain('0 文件');
  });

  it('keeps standalone cards visible alongside projects', () => {
    const html = renderToStaticMarkup(createElement(CodeCardGrid, {
      cardsExpanded: false,
      viewMode: 'cards',
      roomTags: [],
      cards: [createCard()],
      projectFiles: [],
      roomProjects: [createProject()],
      activeCardId: null,
      spotlightCardId: null,
      resolveOriginCopy: () => null,
      onOpenProject: () => {},
      onOpenCard: () => {},
      onRunCard: () => {},
      onDeleteCard: () => {},
      onToggleCardPinned: () => {},
      onToggleProjectPinned: () => {}
    }));

    expect(html).toContain('Landing Refresh');
    expect(html).toContain('index.html');
  });

  it('renders markdown card faces as formatted document previews', () => {
    const html = renderToStaticMarkup(createElement(CodeCardGrid, {
      cardsExpanded: false,
      viewMode: 'cards',
      roomTags: [],
      cards: [createCard({
        title: '光遇 PC MCP 简易教程',
        language: 'markdown',
        code: [
          '# 光遇 PC MCP 简易教程',
          '',
          '这份教程对应 `sky-mcp-server-group-safe.zip`。',
          '',
          '## 适用范围',
          '- Windows 电脑',
          '- PC 版光遇已经能正常打开',
          '',
          '```text',
          'C:\\sky-mcp',
          '```'
        ].join('\n')
      })],
      projectFiles: [],
      roomProjects: [],
      activeCardId: null,
      spotlightCardId: null,
      resolveOriginCopy: () => null,
      onOpenProject: () => {},
      onOpenCard: () => {},
      onRunCard: () => {},
      onDeleteCard: () => {},
      onToggleCardPinned: () => {},
      onToggleProjectPinned: () => {}
    }));

    expect(html).toContain('code-card-text-face');
    expect(html).toContain('code-card-markdown-preview');
    expect(html).toContain('code-card-markdown-heading');
    expect(html.match(/code-card-markdown-heading/g)).toHaveLength(1);
    expect(html).toContain('message-markdown-code-inline');
    expect(html).toContain('<ul class="code-card-markdown-list unordered-list">');
    expect(html).toContain('Windows 电脑');
    expect(html).toContain('光遇 PC MCP 简易教程');
    expect(html).not.toContain('# 光遇 PC MCP 简易教程');
    expect(html).not.toContain('- Windows 电脑');
  });

  it('keeps code card faces as raw code snippets', () => {
    const html = renderToStaticMarkup(createElement(CodeCardGrid, {
      cardsExpanded: false,
      viewMode: 'cards',
      roomTags: [],
      cards: [createCard({
        title: 'index.html',
        language: 'html',
        code: '<main>Hello</main>'
      })],
      projectFiles: [],
      roomProjects: [],
      activeCardId: null,
      spotlightCardId: null,
      resolveOriginCopy: () => null,
      onOpenProject: () => {},
      onOpenCard: () => {},
      onRunCard: () => {},
      onDeleteCard: () => {},
      onToggleCardPinned: () => {},
      onToggleProjectPinned: () => {}
    }));

    expect(html).toContain('<pre class="code-card-snippet">');
    expect(html).not.toContain('code-card-markdown-preview');
  });

  it('keeps injected card face css hidden from the visible grid flow', () => {
    const html = renderToStaticMarkup(createElement(CodeCardGrid, {
      cardsExpanded: false,
      viewMode: 'cards',
      roomTags: [],
      cards: [createCard({
        cardFaceCss: '& .code-card-main { color: #123; }'
      })],
      projectFiles: [],
      roomProjects: [createProject({
        coverStyle: '& .project-cover-title { color: #456; }'
      })],
      activeCardId: null,
      spotlightCardId: null,
      resolveOriginCopy: () => null,
      onOpenProject: () => {},
      onOpenCard: () => {},
      onRunCard: () => {},
      onDeleteCard: () => {},
      onToggleCardPinned: () => {},
      onToggleProjectPinned: () => {}
    }));

    expect(html).not.toContain('&amp; .code-card-main');
    expect(html).not.toContain('&amp; .project-cover-title');
    expect(html).not.toContain('[data-polaris-card-id=&quot;card-1&quot;] .code-card-main');
    expect(html).not.toContain('[data-polaris-card-id=&quot;proj-1&quot;] .project-cover-title');
  });
});
