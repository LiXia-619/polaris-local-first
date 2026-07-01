import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CodeCard } from '../../../types/domain';
import type { GroupArtifactItem } from '../../../app/group/useGroupWorldController';
import { GroupCardsTab } from './GroupCardsTab';
import type { GroupController } from './groupController';

function createCard(overrides: Partial<CodeCard> = {}): CodeCard {
  return {
    id: 'card-1',
    kind: 'card',
    title: 'Demo',
    language: 'html',
    code: '<button>Hello</button>',
    tags: [],
    source: 'chat-generated',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function createController(artifacts: GroupArtifactItem[]): GroupController {
  return {
    groupArtifacts: artifacts
  } as unknown as GroupController;
}

describe('GroupCardsTab', () => {
  it('renders a separate run button for group cards', () => {
    const html = renderToStaticMarkup(createElement(GroupCardsTab, {
      controller: createController([
        { type: 'card', card: createCard(), ownerId: 'pharos', ownerName: 'Pharos', timestamp: 1 }
      ])
    }));

    expect(html).toContain('class="group-card-summary"');
    expect(html).toContain('class="group-card-run"');
    expect(html).toContain('aria-label="运行 Demo"');
  });

  it('renders file artifacts on the same shelf without a run button', () => {
    const html = renderToStaticMarkup(createElement(GroupCardsTab, {
      controller: createController([
        {
          type: 'file',
          id: 'file-1',
          assetId: 'asset-1',
          name: '需求.txt',
          ownerId: null,
          ownerName: null,
          fromUser: true,
          timestamp: 2
        }
      ])
    }));

    expect(html).toContain('is-file');
    expect(html).toContain('需求.txt');
    expect(html).toContain('✦ 你');
    expect(html).not.toContain('group-card-run');
  });
});
