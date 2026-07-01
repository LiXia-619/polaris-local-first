import type { ThemeToolScope, World } from '../../types/domain';

export type ThemeCoordinateSurface =
  | 'background'
  | 'topbar'
  | 'chat-user-bubble'
  | 'chat-ai-bubble'
  | 'composer'
  | 'system-note'
  | 'panel'
  | 'card';

export type ThemeSurfaceFamily =
  | 'background'
  | 'chrome'
  | 'bubble'
  | 'input'
  | 'feedback'
  | 'panel'
  | 'card';

export type ThemeSurfaceLayer = 'world' | 'chrome' | 'content' | 'overlay';
export type ThemeSurfaceContractGroup =
  | 'world-background'
  | 'world-chrome'
  | 'content-surface';
export type ThemeSurfaceMotionScope =
  | 'world-level'
  | 'world-local'
  | 'content-append'
  | 'surface-open-close'
  | 'micro';
export type ThemeSurfaceSlot =
  | 'fill'
  | 'text'
  | 'accent'
  | 'border'
  | 'radius'
  | 'shadow'
  | 'blur'
  | 'opacity'
  | 'texture'
  | 'gradient';

export type ThemeSurfaceRegistryEntry = {
  surface: ThemeCoordinateSurface;
  code: string;
  id: string;
  label: string;
  aiLabel: string;
  promptHint: string;
  prefix: string;
  scope: ThemeToolScope;
  world: World | 'app';
  layer: ThemeSurfaceLayer;
  family: ThemeSurfaceFamily;
  contractGroup: ThemeSurfaceContractGroup;
  motionScopes: readonly ThemeSurfaceMotionScope[];
  slots: readonly ThemeSurfaceSlot[];
  selectorAliases: readonly string[];
  refs: readonly string[];
};

export const THEME_SURFACE_REGISTRY: ThemeSurfaceRegistryEntry[] = [
  {
    surface: 'background',
    code: '01',
    id: 'world-background',
    label: '背景',
    aiLabel: 'background',
    promptHint: '当前世界的主底色和整片底板',
    prefix: 'bg',
    scope: 'app',
    world: 'app',
    layer: 'world',
    family: 'background',
    contractGroup: 'world-background',
    motionScopes: ['world-level'],
    slots: ['fill', 'opacity', 'texture', 'gradient'],
    selectorAliases: ['chat-background', 'collection-background', 'app-background'],
    refs: ['background', 'bg', '背景']
  },
  {
    surface: 'topbar',
    code: '02',
    id: 'world-topbar',
    label: '顶栏',
    aiLabel: 'topbar',
    promptHint: '顶部连续顶栏和主导航壳',
    prefix: 'topbar',
    scope: 'app',
    world: 'app',
    layer: 'chrome',
    family: 'chrome',
    contractGroup: 'world-chrome',
    motionScopes: ['world-level', 'micro'],
    slots: ['fill', 'text', 'accent', 'border', 'shadow', 'blur', 'opacity', 'gradient'],
    selectorAliases: ['chat-topbar', 'app-topbar'],
    refs: ['topbar', '顶栏']
  },
  {
    surface: 'chat-user-bubble',
    code: '03',
    id: 'chat-bubble-user',
    label: '右侧气泡',
    aiLabel: 'user bubble',
    promptHint: '你发出的消息气泡',
    prefix: 'user',
    scope: 'chat',
    world: 'chat',
    layer: 'content',
    family: 'bubble',
    contractGroup: 'content-surface',
    motionScopes: ['content-append', 'micro'],
    slots: ['fill', 'text', 'accent', 'border', 'radius', 'shadow', 'blur', 'opacity', 'gradient'],
    selectorAliases: ['chat-bubble-user'],
    refs: ['chat-user-bubble', 'user-bubble', 'user bubble', 'user', '我的气泡', '右侧气泡', '用户气泡', '你的气泡', '气泡']
  },
  {
    surface: 'chat-ai-bubble',
    code: '04',
    id: 'chat-bubble-assistant',
    label: '回复正文',
    aiLabel: 'assistant reply text',
    promptHint: '助手回复正文的阅读层，默认不是气泡胶囊',
    prefix: 'assistant',
    scope: 'chat',
    world: 'chat',
    layer: 'content',
    family: 'bubble',
    contractGroup: 'content-surface',
    motionScopes: ['content-append', 'micro'],
    slots: ['fill', 'text', 'accent', 'border', 'radius', 'shadow', 'blur', 'opacity', 'gradient'],
    selectorAliases: ['chat-bubble-assistant'],
    refs: ['chat-ai-bubble', 'ai-bubble', 'assistant-bubble', 'assistant bubble', 'ai', 'assistant', '左侧正文', '助手正文', '回复正文', '左侧气泡', 'ai气泡', 'ai 气泡', '助手气泡', '回复气泡']
  },
  {
    surface: 'composer',
    code: '05',
    id: 'chat-composer',
    label: '发送栏',
    aiLabel: 'composer',
    promptHint: '底部输入框和发送区域',
    prefix: 'composer',
    scope: 'chat',
    world: 'chat',
    layer: 'content',
    family: 'input',
    contractGroup: 'content-surface',
    motionScopes: ['world-local', 'micro'],
    slots: ['fill', 'text', 'accent', 'border', 'radius', 'shadow', 'blur', 'opacity', 'gradient'],
    selectorAliases: ['chat-composer'],
    refs: ['composer', 'send-bar', 'send bar', '发送栏']
  },
  {
    surface: 'system-note',
    code: '06',
    id: 'system-note',
    label: '系统框',
    aiLabel: 'system note',
    promptHint: '系统提示、状态提示和说明条',
    prefix: 'note',
    scope: 'chat',
    world: 'chat',
    layer: 'content',
    family: 'feedback',
    contractGroup: 'content-surface',
    motionScopes: ['world-local', 'content-append'],
    slots: ['fill', 'text', 'accent', 'border', 'radius', 'shadow', 'blur', 'opacity'],
    selectorAliases: ['chat-system-note', 'app-preview-banner'],
    refs: ['system-note', 'system note', 'note', '系统框', '系统提示', '提示框', '状态框']
  },
  {
    surface: 'panel',
    code: '07',
    id: 'supporting-panel',
    label: '面板',
    aiLabel: 'panel',
    promptHint: '辅助面板、弹窗和浮层',
    prefix: 'panel',
    scope: 'app',
    world: 'app',
    layer: 'overlay',
    family: 'panel',
    contractGroup: 'content-surface',
    motionScopes: ['surface-open-close', 'micro'],
    slots: ['fill', 'text', 'accent', 'border', 'radius', 'shadow', 'blur', 'opacity', 'texture', 'gradient'],
    selectorAliases: ['chat-thinking-box', 'app-sheet', 'app-provider-sheet', 'app-theme-studio'],
    refs: ['panel', 'panels', '面板', '弹窗', '浮层', '设置面板']
  },
  {
    surface: 'card',
    code: '08',
    id: 'collection-card',
    label: '卡片',
    aiLabel: 'card',
    promptHint: '收藏区内容卡总类；对话卡、代码卡/房间卡和工作区封面有各自专用 selector alias，点名对话卡时用 collection-dialogue-card',
    prefix: 'card',
    scope: 'collection',
    world: 'collection',
    layer: 'content',
    family: 'card',
    contractGroup: 'content-surface',
    motionScopes: ['world-local', 'content-append', 'micro'],
    slots: ['fill', 'text', 'accent', 'border', 'radius', 'shadow', 'blur', 'opacity', 'texture', 'gradient'],
    selectorAliases: ['collection-dialogue-card', 'collection-code-card', 'collection-card', 'collection-workspace-cover'],
    refs: ['card', 'cards', '卡片', '收藏卡', '对话卡', '房间卡', '图片卡']
  }
];

function normalizeSurfaceRef(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

const THEME_SURFACE_REGISTRY_REF_MAP = new Map<string, ThemeSurfaceRegistryEntry>();

function registerRef(value: string, entry: ThemeSurfaceRegistryEntry) {
  const normalized = normalizeSurfaceRef(value);
  if (!normalized) return;
  THEME_SURFACE_REGISTRY_REF_MAP.set(normalized, entry);
}

for (const entry of THEME_SURFACE_REGISTRY) {
  registerRef(entry.surface, entry);
  registerRef(entry.code, entry);
  registerRef(entry.id, entry);
  registerRef(entry.label, entry);
  registerRef(entry.aiLabel, entry);
  for (const alias of entry.selectorAliases) registerRef(alias, entry);
  for (const ref of entry.refs) registerRef(ref, entry);
}

export function findThemeSurfaceEntryBySurface(surface: ThemeCoordinateSurface) {
  return THEME_SURFACE_REGISTRY.find((entry) => entry.surface === surface) ?? null;
}

export function findThemeSurfaceEntryByCode(code: string) {
  return THEME_SURFACE_REGISTRY_REF_MAP.get(normalizeSurfaceRef(code)) ?? null;
}

export function findThemeSurfaceEntryByAlias(alias: string) {
  return THEME_SURFACE_REGISTRY_REF_MAP.get(normalizeSurfaceRef(alias)) ?? null;
}

export function findThemeSurfaceEntryByRef(value: string) {
  return THEME_SURFACE_REGISTRY_REF_MAP.get(normalizeSurfaceRef(value)) ?? null;
}

export function findThemeSurfaceEntriesByWorld(world: ThemeSurfaceRegistryEntry['world']) {
  return THEME_SURFACE_REGISTRY.filter((entry) => entry.world === world);
}

export function findThemeSurfaceEntriesByLayer(layer: ThemeSurfaceLayer) {
  return THEME_SURFACE_REGISTRY.filter((entry) => entry.layer === layer);
}

export function findThemeSurfaceEntriesByFamily(family: ThemeSurfaceFamily) {
  return THEME_SURFACE_REGISTRY.filter((entry) => entry.family === family);
}

export function findThemeSurfaceEntriesByContractGroup(group: ThemeSurfaceContractGroup) {
  return THEME_SURFACE_REGISTRY.filter((entry) => entry.contractGroup === group);
}

export function findThemeSurfaceEntriesByMotionScope(scope: ThemeSurfaceMotionScope) {
  return THEME_SURFACE_REGISTRY.filter((entry) => entry.motionScopes.includes(scope));
}

export function findThemeSurfaceEntriesBySlot(slot: ThemeSurfaceSlot) {
  return THEME_SURFACE_REGISTRY.filter((entry) => entry.slots.includes(slot));
}
