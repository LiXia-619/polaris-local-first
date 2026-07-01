import { findThemeSurfaceEntryByAlias } from '../../config/theme/themeSurfaceRegistry';
import { findSelectorEntry } from '../../config/theme/themeSelectorCatalog';
import type { CollectionShelf, ModelTier, World } from '../../types/domain';

export type ThemeSelectorHint = {
  name: string;
  alias?: string;
  selectors?: string[];
  surfaceCode?: string;
  surfaceId?: string;
  family?: string;
  layer?: string;
};

function buildHints(aliases: string[]) {
  return aliases.flatMap<ThemeSelectorHint>((alias) => {
    const entry = findSelectorEntry(alias);
    if (!entry) return [];
    const surface = findThemeSurfaceEntryByAlias(alias);
    return [{
      name: entry.name,
      alias: entry.alias,
      selectors: entry.selectors,
      surfaceCode: surface?.code,
      surfaceId: surface?.id,
      family: surface?.family,
      layer: surface?.layer
    }];
  });
}

function buildWorldSelectorAliases(args: {
  activeWorld: World;
  collectionShelf: CollectionShelf;
}) {
  if (args.activeWorld === 'chat') {
    return [
      'chat-background',
      'chat-bubble-user',
      'chat-bubble-assistant',
      'chat-bubble-frame-user',
      'chat-bubble-frame-assistant',
      'chat-bubble-frame-shared',
      'chat-composer',
      'chat-send-button',
      'chat-attachment',
      'chat-thinking-box',
      'chat-streaming-hint',
      'chat-system-note',
      'chat-tool-receipt',
      'chat-code-detail',
      'chat-message-actions',
      'chat-micro-button',
      'chat-topbar'
    ];
  }

  return args.collectionShelf === 'dialogue'
    ? [
      'collection-dialogue-card',
      'collection-background',
      'collection-dialogue-actions',
      'collection-search',
      'collection-shelf-tabs',
      'collection-filter-chips',
      'collection-button'
    ]
    : args.collectionShelf === 'image'
      ? [
        'collection-card',
        'collection-card-unified',
        'collection-background',
        'collection-search',
        'collection-shelf-tabs',
        'collection-filter-chips',
        'collection-button'
      ]
      : args.collectionShelf === 'info'
        ? [
          'collection-background',
          'collection-shelf-tabs',
          'collection-button'
        ]
        : [
          'collection-code-card',
          'collection-card',
          'collection-card-unified',
          'collection-background',
          'collection-workspace-cover',
          'collection-code-source',
          'collection-code-toolbar',
          'collection-search',
          'collection-shelf-tabs',
          'collection-filter-chips',
          'collection-button'
        ];
}

function buildAppSelectorAliases() {
  return [
    'app-background',
    'app-topbar',
    'app-topbar-identity',
    'app-brand',
    'app-button',
    'app-preview-banner',
    'app-sheet',
    'app-settings-item',
    'app-provider-sheet',
    'app-theme-studio',
    'app-empty-state'
  ];
}

function dedupeAliases(aliases: string[]) {
  return Array.from(new Set(aliases));
}

function inferRequestedSelectorAliases(requestText?: string) {
  const normalized = requestText?.trim();
  if (!normalized) return [];

  const aliases: string[] = [];
  const mentionsDialogueCard =
    /对话卡|对话列表|对话架|聊天记录卡|conversation-card/.test(normalized);
  const mentionsCodeOrRoomCard =
    /代码卡|房间卡|笔记卡|卡片架|可运行小页面/.test(normalized);
  const mentionsUnifiedCards =
    /(?:全部|所有|统一|一起|都).*(?:卡片|卡面|卡)|(?:卡片|卡面|卡).*(?:全部|所有|统一|一起|都)/.test(normalized);
  const mentionsCollection =
    /收藏|房间|工作区|项目|代码卡|对话卡|图片卡|卡片|对话列表|对话架/.test(normalized);
  const mentionsBottomNavigation =
    /底栏|底部导航|导航栏|标签栏|tab|入口轨道|视图切换/.test(normalized);
  const mentionsWorkspaceCover =
    /工作区.*(?:封面|卡面|外壳|卡片)|项目.*(?:封面|卡面|外壳)|coverStyle|project-cover/.test(normalized);

  if (mentionsCollection) {
    aliases.push(
      'collection-background',
      'collection-shelf-tabs',
      'collection-button'
    );
  }
  if (mentionsDialogueCard) {
    aliases.push('collection-dialogue-card', 'collection-dialogue-actions');
  }
  if (mentionsCodeOrRoomCard || (!mentionsDialogueCard && /卡片/.test(normalized))) {
    aliases.push('collection-card', 'collection-code-card');
  }
  if (mentionsUnifiedCards) {
    aliases.push('collection-card-unified');
  }
  if (mentionsWorkspaceCover) {
    aliases.push('collection-workspace-cover');
  }
  if (mentionsBottomNavigation) {
    aliases.push(
      'collection-shelf-tabs',
      'chat-composer',
      'chat-send-button'
    );
  }
  if (/搜索|筛选/.test(normalized)) {
    aliases.push('collection-search', 'collection-filter-chips');
  }
  if (/工具条|toolbar|工坊/.test(normalized)) {
    aliases.push('collection-code-toolbar');
  }
  if (/框框|外框|边框|硬框|框住|轮廓/.test(normalized)) {
    aliases.push(
      'app-topbar',
      'app-topbar-identity',
      'chat-tool-receipt',
      'chat-code-detail',
      'chat-message-actions',
      'chat-micro-button'
    );
  }

  return aliases;
}

function selectPromptSelectorAliases(args: {
  activeWorld?: World;
  collectionShelf?: CollectionShelf;
  modelTier?: ModelTier;
  requestText?: string;
  chatAvatarLayoutEnabled?: boolean;
}) {
  const modelTier = args.modelTier ?? 'medium';
  const activeWorld = args.activeWorld ?? 'chat';
  const collectionShelf = args.collectionShelf ?? 'code';
  const worldAliases = buildWorldSelectorAliases({ activeWorld, collectionShelf });
  const appAliases = buildAppSelectorAliases();
  const requestedAliases = inferRequestedSelectorAliases(args.requestText);

  if (modelTier === 'strong') {
    return dedupeAliases([
      ...worldAliases,
      ...appAliases,
      ...requestedAliases,
      'chat-bubble-shared',
      'chat-bubble-frame-user',
      'chat-bubble-frame-assistant',
      'chat-message-actions',
      'collection-dialogue-actions',
      'collection-code-source',
      'collection-workspace-cover',
      'collection-code-toolbar',
      'collection-search',
      'collection-shelf-tabs',
      'collection-filter-chips',
      'collection-button',
      'app-settings-item',
      'app-provider-sheet',
      'app-theme-studio',
      'app-empty-state'
    ]);
  }

  if (modelTier === 'small') {
    const aliases = activeWorld === 'chat'
      ? [
        'chat-background',
        'chat-bubble-user',
        'chat-bubble-assistant',
        'chat-bubble-frame-user',
        'chat-bubble-frame-assistant',
        'chat-topbar',
        'chat-thinking-box',
        'chat-streaming-hint',
        'chat-system-note',
        'chat-tool-receipt',
        'chat-code-detail',
        'chat-composer',
        'chat-send-button'
      ]
      : collectionShelf === 'dialogue'
        ? [
          'collection-dialogue-card',
          'collection-background',
          'collection-dialogue-actions',
          'collection-shelf-tabs',
          'collection-filter-chips',
          'collection-button'
        ]
        : collectionShelf === 'image'
          ? [
            'collection-card',
            'collection-card-unified',
            'collection-background',
            'collection-shelf-tabs',
            'collection-filter-chips',
            'collection-button'
          ]
          : collectionShelf === 'info'
            ? [
              'collection-background',
              'collection-shelf-tabs',
              'collection-button'
            ]
          : [
            'collection-code-card',
            'collection-card',
            'collection-card-unified',
            'collection-background',
            'collection-workspace-cover',
            'collection-code-toolbar',
            'collection-shelf-tabs',
            'collection-filter-chips',
            'collection-button'
          ];
    return dedupeAliases([...aliases, ...requestedAliases]);
  }

  return dedupeAliases([
    ...worldAliases,
    ...requestedAliases,
    'app-background',
    'app-topbar',
    'app-topbar-identity',
    'app-brand',
    'app-button',
    'app-sheet'
  ]);
}

export function buildThemeSelectorHints(args: {
  activeWorld: World;
  collectionShelf: CollectionShelf;
  modelTier?: ModelTier;
  requestText?: string;
  chatAvatarLayoutEnabled?: boolean;
}) {
  return buildHints(
    selectPromptSelectorAliases({
      activeWorld: args.activeWorld,
      collectionShelf: args.collectionShelf,
      modelTier: args.modelTier,
      requestText: args.requestText,
      chatAvatarLayoutEnabled: args.chatAvatarLayoutEnabled
    })
  );
}

export function formatThemeSelectorHintLine(hint: ThemeSelectorHint) {
  const title = hint.surfaceCode ? `${hint.surfaceCode} ${hint.name}` : hint.name;
  const selectorSummary = hint.selectors?.join(' / ') ?? '';
  return `- ${title}：\`${selectorSummary}\`${hint.alias ? ` · alias=${hint.alias}` : ''}`;
}

export function buildSelectorCatalogPromptLines(args?: {
  activeWorld?: World;
  collectionShelf?: CollectionShelf;
  modelTier?: ModelTier;
  requestText?: string;
  chatAvatarLayoutEnabled?: boolean;
}): string[] {
  return [
    '创意模式 selector：',
    ...buildHints(selectPromptSelectorAliases(args ?? {})).map((hint) => formatThemeSelectorHintLine(hint))
  ];
}
