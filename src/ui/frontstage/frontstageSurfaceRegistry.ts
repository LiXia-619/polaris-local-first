export type FrontstageSurfaceId =
  | 'world-anchor'
  | 'collaborator-switch-panel'
  | 'collaborator-switch-library'
  | 'collaborator-studio-entry'
  | 'tab-strip'
  | 'action-cluster'
  | 'filter-chip-row'
  | 'empty-state-whisper'
  | 'archive-card'
  | 'prompt-board'
  | 'editor-board'
  | 'preview-chrome'
  | 'preview-stage';

type FrontstageSurfaceSpec = {
  id: FrontstageSurfaceId;
  worlds: readonly ('collection' | 'chat' | 'viewer')[];
  role: string;
  note: string;
};

export const FRONTSTAGE_SURFACE_REGISTRY: Record<FrontstageSurfaceId, FrontstageSurfaceSpec> = {
  'world-anchor': {
    id: 'world-anchor',
    worlds: ['collection', 'chat'],
    role: 'world 顶部左侧负责宣告当前房间身份和切换入口的锚点',
    note: '它是门牌和入口，不是普通品牌字样，也不该继续和 action cluster 混在同一个无名顶栏块里。'
  },
  'collaborator-switch-panel': {
    id: 'collaborator-switch-panel',
    worlds: ['chat', 'collection'],
    role: '承载当前协作者闭环切换的轻面板',
    note: '它优先负责快速换人和进入当前协作者闭环，不该继续和深设置编辑混成同一坨无名内容。'
  },
  'collaborator-switch-library': {
    id: 'collaborator-switch-library',
    worlds: ['chat', 'collection'],
    role: '协作者快速切换区，负责当前闭环里的候选对象',
    note: '它是 quick switch，不是 studio，也不是完整协作者资料页。'
  },
  'collaborator-studio-entry': {
    id: 'collaborator-studio-entry',
    worlds: ['chat', 'collection'],
    role: '从轻切换层进入协作者编辑和新建流的入口区',
    note: '它承接进入 builder / full sheet 的动作，不和 quick switch 混在同一层语义里。'
  },
  'tab-strip': {
    id: 'tab-strip',
    worlds: ['collection'],
    role: '房间里切换对话/卡片/工作区/图片的世界内部导航',
    note: '它是 world 内部导航，不是内容层，也不应该和 filter chips 混成一排。'
  },
  'action-cluster': {
    id: 'action-cluster',
    worlds: ['collection'],
    role: '房间里负责发起创建或进入工作态的动作簇',
    note: '它是世界动作，不是筛选条件本身。'
  },
  'filter-chip-row': {
    id: 'filter-chip-row',
    worlds: ['collection'],
    role: '房间里按 persona 等条件缩小内容范围的筛选排',
    note: '它是 supporting navigation，不该再承担创建动作的身份。'
  },
  'empty-state-whisper': {
    id: 'empty-state-whisper',
    worlds: ['collection'],
    role: '房间里承载空状态提示和引导动作的轻声对象',
    note: '它是世界里的空白提示，不是 archive-card 的替代卡片，也不该散成几段无主文案。'
  },
  'archive-card': {
    id: 'archive-card',
    worlds: ['collection'],
    role: '房间里被浏览的卡片家族',
    note: '它是被挑选、被浏览的对象，不应该和工坊里的工作面混成同一个物种。'
  },
  'prompt-board': {
    id: 'prompt-board',
    worlds: ['collection'],
    role: '房间 workshop 态里的工作台面',
    note: '它是正在工作的面，不是普通信息卡，也不是 archive-card 的换皮版本。'
  },
  'editor-board': {
    id: 'editor-board',
    worlds: ['collection'],
    role: '真正承载编辑输入的可写面',
    note: '它负责承接用户输入和代码内容，应该能独立换肤，不靠外层卡片语法活着。'
  },
  'preview-chrome': {
    id: 'preview-chrome',
    worlds: ['collection'],
    role: '预览台自己的说明和控制条',
    note: '它负责交代当前预览状态和运行动作，不该再和 preview-stage 本体混成一个盒子。'
  },
  'preview-stage': {
    id: 'preview-stage',
    worlds: ['collection'],
    role: '收藏工坊里真正承载运行结果或源代码回退的预览台',
    note: '它是被观看和被运行的面，不是 editor-board，也不是 prompt-board 的附属装饰。'
  }
};

export const COLLECTION_FRONTSTAGE_SURFACES = {
  worldAnchor: 'world-anchor',
  collaboratorSwitchPanel: 'collaborator-switch-panel',
  collaboratorSwitchLibrary: 'collaborator-switch-library',
  collaboratorStudioEntry: 'collaborator-studio-entry',
  tabStrip: 'tab-strip',
  actionCluster: 'action-cluster',
  filterChipRow: 'filter-chip-row',
  emptyStateWhisper: 'empty-state-whisper',
  archiveCard: 'archive-card',
  promptBoard: 'prompt-board',
  editorBoard: 'editor-board',
  previewChrome: 'preview-chrome',
  previewStage: 'preview-stage'
} as const satisfies Record<string, FrontstageSurfaceId>;
