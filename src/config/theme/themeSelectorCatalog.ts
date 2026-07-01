import type { ThemeToolScope } from '../../types/domain';

export type SelectorEntry = {
  name: string;
  alias: string;
  selectors: string[];
  hint: string;
  group: 'chat' | 'collection' | 'app';
};

export const SELECTOR_CATALOG: SelectorEntry[] = [
  { name: '对话背景', alias: 'chat-background', selectors: ['.app-shell.chat'], hint: '对话世界的整片底色', group: 'chat' },
  { name: '右侧气泡', alias: 'chat-bubble-user', selectors: ['.app-shell.chat .bubble.user'], hint: '你发出的消息气泡；适合改气泡底、圆角、文字色和正文内边距；贴纸、小尾巴、角标优先挂到 chat-bubble-frame-user 的 ::before / ::after', group: 'chat' },
  { name: '助手正文', alias: 'chat-bubble-assistant', selectors: ['.app-shell.chat .bubble.assistant'], hint: '助手回复正文的阅读容器；头像模式也继续使用这个真实气泡壳，所以主题皮肤只改这一处即可。适合改正文底、文字色、圆角和阅读区域；不包含工具收据、系统提示或通知卡；贴纸、小尾巴、角标优先挂到 chat-bubble-frame-assistant 的 ::before / ::after', group: 'chat' },
  { name: '两种气泡', alias: 'chat-bubble-shared', selectors: ['.app-shell.chat .bubble.user', '.app-shell.chat .bubble.assistant'], hint: '同时改两种气泡', group: 'chat' },
  { name: '右侧气泡外层', alias: 'chat-bubble-frame-user', selectors: ['.app-shell.chat .msg-row.user', '.app-shell.chat .bubble-frame.user'], hint: '右侧气泡的行容器和外层框，适合改宽度、位置、浮动、留白；做贴纸、小尾巴、角标时优先写 .bubble-frame.user::before / .bubble-frame.user::after，必要时同步放开 msg-row / bubble-frame / bubble 的 overflow', group: 'chat' },
  { name: '回复正文外层', alias: 'chat-bubble-frame-assistant', selectors: ['.app-shell.chat .msg-row.assistant', '.app-shell.chat .bubble-frame.assistant'], hint: '回复正文的行容器和外层框，适合改宽度、位置、浮动、留白；做贴纸、小尾巴、角标时优先写 .bubble-frame.assistant::before / .bubble-frame.assistant::after，必要时同步放开 msg-row / bubble-frame / bubble 的 overflow', group: 'chat' },
  { name: '两种气泡外层', alias: 'chat-bubble-frame-shared', selectors: ['.app-shell.chat .msg-row.user', '.app-shell.chat .bubble-frame.user', '.app-shell.chat .msg-row.assistant', '.app-shell.chat .bubble-frame.assistant'], hint: '同时改两种气泡的容器层', group: 'chat' },
  { name: '用户头像壳', alias: 'chat-user-avatar-frame', selectors: ['.world-chat .message-avatar-slot.user .message-avatar', '.world-chat .message-avatar-slot.user .persona-avatar', '.world-chat .message-avatar-slot.user .persona-avatar--user'], hint: '聊天里用户头像的外框、占位底、边框、阴影和圆角。只能改头像 UI 壳或无图 fallback 底色；如果用户上传了真实头像图，不要说主题 CSS 能改图片本身颜色，改图请走图片处理或换头像。', group: 'chat' },
  { name: '助手头像壳', alias: 'chat-assistant-avatar-frame', selectors: ['.world-chat .message-avatar-slot.assistant .message-avatar', '.world-chat .message-avatar-slot.assistant .persona-avatar'], hint: '聊天里助手头像的外框、占位底、边框、阴影和圆角。只能改头像 UI 壳或 fallback 底色；如果协作者头像是图片，不要把主题 CSS 当成图片编辑。', group: 'chat' },
  { name: '两种头像壳', alias: 'chat-avatar-frame', selectors: ['.world-chat .message-avatar', '.world-chat .persona-avatar', '.world-chat .message-avatar-slot.user .persona-avatar', '.world-chat .message-avatar-slot.assistant .persona-avatar'], hint: '同时改聊天里的用户和助手头像壳。适合统一头像外框、阴影、边框、圆角和无图占位底；不改已上传图片本体。', group: 'chat' },
  { name: '对话顶栏', alias: 'chat-topbar', selectors: ['.app-shell.chat .topbar-surface'], hint: '对话页最上面的主导航胶囊，不包含 safe-area 空白和下面那排试穿提示', group: 'chat' },
  { name: '思考框', alias: 'chat-thinking-box', selectors: ['.world-chat .message-thinking-projection', '.world-chat .thinking-inline-trigger'], hint: '思路投影框和思路摘要触发器，不包含 assistant 身份条、系统提示或流式状态条', group: 'chat' },
  { name: '流式提示', alias: 'chat-streaming-hint', selectors: ['.world-chat .assistant-stage-live', '.world-chat .assistant-streaming-hint'], hint: '回复还在生成时的“正在想”提示和流式状态条', group: 'chat' },
  { name: '系统提示', alias: 'chat-system-note', selectors: ['.world-chat .system-inline-note'], hint: '聊天流里的系统说明条，比如“这次只是口头说明，还没有实际改动”', group: 'chat' },
  { name: '工具收据', alias: 'chat-tool-receipt', selectors: ['.world-chat .tool-event', '.world-chat .tool-event-icon', '.world-chat .tool-event-toggle', '.world-chat .tool-event-css-detail pre'], hint: '工具动作、试穿、应用和运行结果的执行收据；tool-event 是外层胶囊，icon/toggle/css-detail 是内层小壳。用户说工具记录旁边有小框、代码详情有框或图标外面有框时，不要只改外层。', group: 'chat' },
  { name: '代码详情', alias: 'chat-code-detail', selectors: ['.world-chat .message-code-drawer-head', '.world-chat .message-code-drawer-head-icon', '.world-chat .message-code-drawer-toggle', '.world-chat .message-code-card'], hint: '助手消息里的“代码详情 / 展开详情”抽屉和代码卡。用户说代码详情外面有框、按钮像硬框或图标框残留时，优先处理这些 selector。', group: 'chat' },
  { name: '附件条', alias: 'chat-attachment', selectors: ['.world-chat .attachment-strip', '.world-chat .attachment-chip', '.world-chat .attachment-remove-btn'], hint: '消息附件条和附件胶囊', group: 'chat' },
  { name: '输入区', alias: 'chat-composer', selectors: ['.chat-box'], hint: '底部输入框区域', group: 'chat' },
  { name: '发送按钮', alias: 'chat-send-button', selectors: ['.chat-box .send-btn'], hint: '发送按钮', group: 'chat' },
  { name: '消息操作', alias: 'chat-message-actions', selectors: ['.world-chat .message-inline-actions', '.world-chat .message-inline-actions .btn-secondary', '.world-chat .message-inline-actions .micro-action-btn'], hint: '每条消息下方的复制、重试、保存等动作', group: 'chat' },
  { name: '小动作按钮', alias: 'chat-micro-button', selectors: ['.world-chat .micro-action-btn'], hint: '复制、重试等小按钮', group: 'chat' },
  { name: '收藏背景', alias: 'collection-background', selectors: ['.app-shell.collection', '.world-collection'], hint: '收藏页整体背景', group: 'collection' },
  { name: '卡片架卡片', alias: 'collection-card', selectors: ['.app-shell.collection .world-collection .code-card', '.app-shell.collection .world-collection .code-card-composer'], hint: '卡片架里的代码卡、笔记卡和可运行小页面；不包含对话架里的对话卡', group: 'collection' },
  { name: '全部内容卡统一皮肤', alias: 'collection-card-unified', selectors: ['.app-shell.collection .world-collection .code-card.code-card-custom-face', '.app-shell.collection .world-collection .card', '.app-shell.collection .world-collection .code-card', '.app-shell.collection .world-collection .conversation-card', '.app-shell.collection .world-collection .code-card-composer'], hint: '只有明确要把对话卡、代码卡等所有内容卡一起统一时使用；点名对话卡时优先用 collection-dialogue-card，点名代码/房间卡时优先用 collection-code-card', group: 'collection' },
  { name: '对话卡', alias: 'collection-dialogue-card', selectors: ['.app-shell.collection .world-collection .conversation-card'], hint: '对话架里的对话记录卡；用户说对话卡、对话列表、聊天记录卡时用这个，不要绕到 collection-card', group: 'collection' },
  { name: '对话卡操作', alias: 'collection-dialogue-actions', selectors: ['.app-shell.collection .world-collection .conversation-card-actions', '.app-shell.collection .world-collection .conversation-card-state', '.app-shell.collection .world-collection .conversation-stats'], hint: '对话卡右上角操作、底部状态和统计文字', group: 'collection' },
  { name: '代码卡 / 房间卡', alias: 'collection-code-card', selectors: ['.app-shell.collection .world-collection .code-card', '.app-shell.collection .world-collection .code-card-composer'], hint: '卡片架里的代码卡、笔记卡和房间卡；不包含对话卡', group: 'collection' },
  {
    name: '工作区封面',
    alias: 'collection-workspace-cover',
    selectors: [
      '.app-shell.collection .world-collection .room-project-card',
      '.app-shell.collection .world-collection .project-cover-card',
      '.app-shell.collection .world-collection .project-cover-inner',
      '.app-shell.collection .world-collection .project-cover-decoration',
      '.app-shell.collection .world-collection .project-cover-title',
      '.app-shell.collection .world-collection .project-cover-description',
      '.app-shell.collection .world-collection .project-cover-footer'
    ],
    hint: '收藏区里的工作区封面卡。room-project-card 是外层卡壳，project-cover-card 是封面根节点，project-cover-inner 是内容网格，decoration/title/description/footer 是封面内部。只改封面视觉，不要用 height / position / transform 接管收藏区布局；如果是当前工作区自己的封面，优先用 patchRoomProject 的 coverStyle。',
    group: 'collection'
  },
  { name: '代码来源条', alias: 'collection-code-source', selectors: ['.app-shell.collection .code-card-source-bar', '.app-shell.collection .code-card-source-actions'], hint: '代码卡里的来源说明和跳回入口', group: 'collection' },
  { name: '代码工坊工具条', alias: 'collection-code-toolbar', selectors: ['.app-shell.collection .code-workshop-actions', '.app-shell.collection .code-workshop-actions-main', '.app-shell.collection .code-workshop-actions-secondary', '.app-shell.collection .code-card-composer-tool'], hint: '代码工坊顶部动作区和工具按钮', group: 'collection' },
  { name: '搜索框', alias: 'collection-search', selectors: ['.world-collection .collection-search', '.world-collection .search-input'], hint: '收藏搜索区域', group: 'collection' },
  {
    name: '收藏底栏',
    alias: 'collection-shelf-tabs',
    selectors: [
      '.app-shell.collection .collection-shelf-tabs',
      '.app-shell.collection .collection-shelf-tab-row',
      '.app-shell.collection .shelf-tab',
      '.app-shell.collection .shelf-tab-icon',
      '.app-shell.collection .shelf-tab-label'
    ],
    hint: '底部房间导航栏。collection-shelf-tabs 是整条底栏，也是唯一适合承载底色/玻璃感的层；collection-shelf-tab-row 是入口轨道，shelf-tab 是每个入口，shelf-tab-icon 是图标，shelf-tab-label 是文字。不要给轨道、单个入口或图标重复加背景、边框、阴影、玻璃 blur；active 态优先用文字/图标颜色表达。',
    group: 'collection'
  },
  { name: '收藏筛选标签', alias: 'collection-filter-chips', selectors: ['.collection-filter-chips', '.dialogue-filter-chips', '.chip', '.chip-add'], hint: '筛选 chip 和过滤标签本身，不包含外层容器壳', group: 'collection' },
  { name: '收藏按钮', alias: 'collection-button', selectors: ['.world-collection .code-card-composer-tool', '.world-collection .micro-action-btn'], hint: '收藏区操作按钮，不包含筛选 chip', group: 'collection' },
  {
    name: '全局背景',
    alias: 'app-background',
    selectors: [
      '.app-shell.chat',
      '.app-shell.collection',
      '.app-shell.chat .app-stage',
      '.app-shell.collection .app-stage',
      '.app-shell.chat .world-stack',
      '.app-shell.collection .world-stack',
      '.app-shell.collection .app-stage::before'
    ],
    hint: '整个 app 背景',
    group: 'app'
  },
  { name: '全局顶栏', alias: 'app-topbar', selectors: ['.topbar-surface'], hint: 'App 级顶栏主导航胶囊，不包含外层 safe-area 命中区', group: 'app' },
  { name: '顶栏身份区', alias: 'app-topbar-identity', selectors: ['.topbar .world-anchor', '.topbar .brand-trigger', '.topbar .brand-world-mark', '.topbar .brand', '.topbar .brand h1', '.topbar .brand p'], hint: '顶栏中间/左侧显示当前协作者、世界和副标题的身份入口。用户说顶栏文字外面有方框、房间名被框住或门牌有硬边时，改这里；通常要让 world-anchor / brand-trigger 透明无边框，只保留文字、星标或柔光。', group: 'app' },
  { name: '品牌区', alias: 'app-brand', selectors: ['.brand', '.brand h1', '.brand p'], hint: '左上角 Polaris 或协作者标题和副标题的文字层，不包含外层 world-anchor / brand-trigger 框', group: 'app' },
  { name: '全局按钮', alias: 'app-button', selectors: ['.topbar .action-btn', '.topbar .brand-trigger'], hint: '顶栏动作按钮和世界切换入口', group: 'app' },
  { name: '试穿条 / 顶部提示', alias: 'app-preview-banner', selectors: ['.preview-banner-trigger'], hint: '试穿中的回到对话提示条，也可当顶部系统提示条', group: 'app' },
  { name: '设置面板 / 弹窗', alias: 'app-sheet', selectors: ['.settings-sheet', '.menu-sheet'], hint: '设置页和通用弹窗壳层；主题只改质感，不接管全屏或抽屉几何。', group: 'app' },
  { name: '菜单项', alias: 'app-settings-item', selectors: ['.settings-item', '.menu-quick-skin', '.theme-inline-action'], hint: '菜单里的设置项和快捷皮肤入口', group: 'app' },
  { name: '供应商面板', alias: 'app-provider-sheet', selectors: ['.provider-chip', '.provider-model-chip', '.provider-model-toggle', '.provider-inline-actions .btn-secondary'], hint: 'API 供应商面板里的 provider 卡片和模型快捷按钮', group: 'app' },
  { name: 'Theme Studio', alias: 'app-theme-studio', selectors: ['.theme-studio-sheet'], hint: 'Theme Studio 面板外壳', group: 'app' },
  { name: '空状态', alias: 'app-empty-state', selectors: ['.chat-empty-state', '.empty-state-floating'], hint: '无内容时的空状态提示', group: 'app' }
];

function findByAlias(alias: string) {
  return SELECTOR_CATALOG.find((entry) => entry.alias === alias) ?? null;
}

type ResolvedSelectorToken = {
  entry: SelectorEntry;
  suffix: string;
};

function resolveSelectorToken(selector: string): ResolvedSelectorToken | null {
  const normalized = selector.trim();
  if (!normalized) return null;

  const exactAlias = findByAlias(normalized);
  if (exactAlias) {
    return { entry: exactAlias, suffix: '' };
  }

  for (const entry of SELECTOR_CATALOG) {
    if (!normalized.startsWith(entry.alias)) continue;
    const suffix = normalized.slice(entry.alias.length);
    if (!suffix || /^[\s:.[>#~+]/.test(suffix)) {
      return { entry, suffix };
    }
  }

  return null;
}

function groupToScope(group: SelectorEntry['group']): ThemeToolScope {
  switch (group) {
    case 'chat':
      return 'chat';
    case 'collection':
      return 'collection';
    default:
      return 'app';
  }
}

function selectorMatchesCatalogSelector(selector: string, catalogSelector: string) {
  if (selector === catalogSelector) return true;
  if (!selector.startsWith(catalogSelector)) return false;
  const suffix = selector.slice(catalogSelector.length);
  return Boolean(suffix) && /^[\s:.[>#~+]/.test(suffix);
}

export function findSelectorEntry(selector: string): SelectorEntry | null {
  const normalized = selector.trim();
  if (!normalized) return null;
  return resolveSelectorToken(normalized)?.entry
    ?? SELECTOR_CATALOG.find((entry) => entry.selectors.includes(normalized))
    ?? null;
}

export function findSelectorEntryForCssSelector(selector: string): SelectorEntry | null {
  const normalized = selector.trim();
  if (!normalized) return null;
  const directEntry = findSelectorEntry(normalized);
  if (directEntry) return directEntry;

  let bestEntry: SelectorEntry | null = null;
  let bestSelectorLength = -1;
  SELECTOR_CATALOG.forEach((entry) => {
    entry.selectors.forEach((candidate) => {
      if (!selectorMatchesCatalogSelector(normalized, candidate)) return;
      if (candidate.length > bestSelectorLength) {
        bestEntry = entry;
        bestSelectorLength = candidate.length;
      }
    });
  });

  return bestEntry;
}

export function describeSelectorTarget(selector: string): string | null {
  const entry = findSelectorEntry(selector);
  return entry?.name ?? null;
}

export function resolveFromCatalog(selector: string): string[] | null {
  const resolved = resolveSelectorToken(selector);
  if (resolved) {
    return resolved.entry.selectors.map((entrySelector) => `${entrySelector}${resolved.suffix}`);
  }

  return findSelectorEntry(selector)?.selectors ?? null;
}

export function extractSelectorAliases(selector: string): string[] {
  return Array.from(new Set(
    selector
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => resolveSelectorToken(part)?.entry.alias ?? findSelectorEntry(part)?.alias ?? null)
      .filter((alias): alias is string => Boolean(alias))
  ));
}

export function resolveSelectorScope(selector: string): ThemeToolScope {
  const entry = findSelectorEntry(selector);
  return entry ? groupToScope(entry.group) : 'app';
}
