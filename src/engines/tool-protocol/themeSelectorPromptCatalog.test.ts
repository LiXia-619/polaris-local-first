import { describe, expect, it } from 'vitest';
import { buildThemeSelectorHints } from './themeSelectorPromptCatalog';

describe('themeSelectorPromptCatalog frontstage metadata', () => {
  it('carries registry contract metadata into creative selector hints', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'code',
      modelTier: 'medium'
    });
    const assistantBubble = hints.find((hint) => hint.alias === 'chat-bubble-assistant');
    const toolReceipt = hints.find((hint) => hint.alias === 'chat-tool-receipt');
    const topbar = hints.find((hint) => hint.alias === 'app-topbar');

    expect(assistantBubble).toMatchObject({
      name: '助手正文',
      surfaceCode: '04',
      surfaceId: 'chat-bubble-assistant',
      family: 'bubble',
      layer: 'content'
    });
    expect(assistantBubble?.selectors).toEqual(['.app-shell.chat .bubble.assistant']);
    expect(toolReceipt).toMatchObject({
      name: '工具收据',
      selectors: [
        '.world-chat .tool-event',
        '.world-chat .tool-event-icon',
        '.world-chat .tool-event-toggle',
        '.world-chat .tool-event-css-detail pre'
      ]
    });
    expect(toolReceipt?.surfaceCode).toBeUndefined();
    expect(topbar).toMatchObject({
      surfaceCode: '02',
      family: 'chrome',
      layer: 'chrome'
    });
    expect(topbar?.selectors).toEqual(['.topbar-surface']);

    expect(hints.find((hint) => hint.alias === 'app-topbar-identity')).toMatchObject({
      name: '顶栏身份区',
      selectors: expect.arrayContaining(['.topbar .world-anchor', '.topbar .brand-trigger'])
    });
    expect(hints.find((hint) => hint.alias === 'chat-code-detail')).toMatchObject({
      name: '代码详情',
      selectors: expect.arrayContaining(['.world-chat .message-code-drawer-head'])
    });
  });

  it('keeps assistant bubble selectors stable in chat avatar layout', () => {
    const normalHints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'code',
      modelTier: 'strong'
    });
    expect(normalHints.some((hint) => hint.alias === 'chat-bubble-assistant')).toBe(true);

    const avatarHints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'code',
      modelTier: 'strong',
      chatAvatarLayoutEnabled: true
    });
    expect(avatarHints.some((hint) => hint.alias === 'chat-bubble-assistant')).toBe(true);
    expect(avatarHints.some((hint) => hint.alias === 'chat-bubble-shared')).toBe(true);
  });

  it('exposes an explicit unified collection-card override selector', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'collection',
      collectionShelf: 'code',
      modelTier: 'medium'
    });
    const unifiedCardSkin = hints.find((hint) => hint.alias === 'collection-card-unified');

    expect(unifiedCardSkin).toMatchObject({
      name: '全部内容卡统一皮肤',
      selectors: [
        '.app-shell.collection .world-collection .code-card.code-card-custom-face',
        '.app-shell.collection .world-collection .card',
        '.app-shell.collection .world-collection .code-card',
        '.app-shell.collection .world-collection .conversation-card',
        '.app-shell.collection .world-collection .code-card-composer'
      ]
    });

    expect(hints.find((hint) => hint.alias === 'collection-workspace-cover')).toMatchObject({
      name: '工作区封面',
      surfaceCode: '08',
      surfaceId: 'collection-card',
      selectors: expect.arrayContaining([
        '.app-shell.collection .world-collection .room-project-card',
        '.app-shell.collection .world-collection .project-cover-card'
      ])
    });
  });

  it('adds collection bottom navigation selectors when the request mentions the bottom bar from chat', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'code',
      modelTier: 'medium',
      requestText: '那边的底栏还是白色的，帮我改成这套主题色'
    });

    expect(hints.some((hint) => hint.alias === 'collection-shelf-tabs')).toBe(true);
    expect(hints.some((hint) => hint.alias === 'chat-composer')).toBe(true);
  });

  it('adds workspace cover selectors when the request mentions project cover from chat', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'code',
      modelTier: 'medium',
      requestText: '工作区封面卡面也跟主题统一一下'
    });

    expect(hints.some((hint) => hint.alias === 'collection-workspace-cover')).toBe(true);
  });

  it('keeps small models supplied with collection selectors when a collection edit is requested from chat', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'dialogue',
      modelTier: 'small',
      requestText: '收藏区底栏改色'
    });

    expect(hints.map((hint) => hint.alias)).toEqual(expect.arrayContaining([
      'collection-background',
      'collection-shelf-tabs',
      'collection-button'
    ]));
  });

  it('routes dialogue-card wording to the dialogue card selector without the broad card alias', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'dialogue',
      modelTier: 'medium',
      requestText: '对话卡换成这套颜色'
    });

    expect(hints.find((hint) => hint.alias === 'collection-dialogue-card')).toMatchObject({
      name: '对话卡',
      selectors: ['.app-shell.collection .world-collection .conversation-card']
    });
    expect(hints.some((hint) => hint.alias === 'collection-card')).toBe(false);
  });

  it('adds inner chrome selectors when the request mentions hard frames', () => {
    const hints = buildThemeSelectorHints({
      activeWorld: 'chat',
      collectionShelf: 'code',
      modelTier: 'small',
      requestText: '顶栏和代码详情外面都有框框，帮我去掉硬边框'
    });

    expect(hints.map((hint) => hint.alias)).toEqual(expect.arrayContaining([
      'app-topbar-identity',
      'chat-tool-receipt',
      'chat-code-detail',
      'chat-message-actions',
      'chat-micro-button'
    ]));
  });
});
