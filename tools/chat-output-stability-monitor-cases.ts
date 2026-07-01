type OutputStabilityCaseCategory = 'text' | 'code' | 'workflow';
type OutputHistoryProfile = 'none' | 'heavy';
type OutputToolScenario = 'room' | 'workspace' | 'theme';

export type OutputStabilityCase = {
  id: string;
  category: OutputStabilityCaseCategory;
  historyProfile: OutputHistoryProfile;
  prompt: string;
  minVisibleChars: number;
  requiredPatterns?: string[];
  acceptedToolKinds?: string[];
  completionToolKinds?: string[];
  continuationToolKinds?: string[];
  followUpPrompts?: string[];
  minimumCompletionTurns?: number;
  maxWorkflowTurns?: number;
  requiresTools?: boolean;
  toolScenario?: OutputToolScenario;
};

export const OUTPUT_STABILITY_CASES: OutputStabilityCase[] = [
  {
    id: 'long-text-direct',
    category: 'text',
    historyProfile: 'none',
    prompt:
      '不要分点，不要列表，不要代码。直接写一段完整中文正文，长度至少 1200 字，语气自然连贯，主题是“一个人很累但终于被接住以后，身体和心慢慢放松下来”。',
    minVisibleChars: 900,
    acceptedToolKinds: []
  },
  {
    id: 'long-text-heavy-history',
    category: 'text',
    historyProfile: 'heavy',
    prompt:
      '延续上文的情绪和关系，但这次也不要分点，不要列表，不要代码。直接写一段完整中文正文，长度至少 1200 字，主题是“半夜终于愿意承认自己很需要被抱住”。',
    minVisibleChars: 850,
    acceptedToolKinds: []
  },
  {
    id: 'long-code-html-game',
    category: 'code',
    historyProfile: 'none',
    prompt:
      '给我一个单文件 HTML 小游戏，直接输出完整代码，不要解释。要求有开始界面、计分、失败重开、移动端触控按钮、简单音效开关、粒子反馈和本地最高分。代码必须从 <!DOCTYPE html> 开始。',
    minVisibleChars: 2600,
    requiredPatterns: ['<!DOCTYPE html>', '<html', '</html>'],
    acceptedToolKinds: ['createCodeCard']
  },
  {
    id: 'long-code-html-heavy-history',
    category: 'code',
    historyProfile: 'heavy',
    prompt:
      '沿着上文需求继续，直接给我完整单文件 HTML，不要解释。要求保留移动端适配，再加暂停、连击奖励、难度递增和一个很轻的剧情提示层。代码必须从 <!DOCTYPE html> 开始。',
    minVisibleChars: 2400,
    requiredPatterns: ['<!DOCTYPE html>', '<html', '</html>'],
    acceptedToolKinds: ['createCodeCard']
  },
  {
    id: 'workflow-workspace-file',
    category: 'workflow',
    historyProfile: 'none',
    prompt:
      '当前对话已经绑定到工作区「Nova Journal」。请把当前工作区里的 index.html 改成一个可运行的日记页面：有标题、日期列表、正文区和一点柔和 CSS。不要新建普通收藏卡，不要改别的工作区。',
    minVisibleChars: 0,
    acceptedToolKinds: [
      'createProjectFile',
      'writeProjectFiles',
      'editProjectFileText',
      'appendProjectFile',
      'insertProjectFile',
      'readProjectFile',
      'readProjectFileContext',
      'listProjectFiles'
    ],
    completionToolKinds: [
      'createProjectFile',
      'writeProjectFiles',
      'editProjectFileText',
      'appendProjectFile',
      'insertProjectFile'
    ],
    continuationToolKinds: [
      'readProjectFile',
      'readProjectFileContext',
      'listProjectFiles'
    ],
    requiresTools: true,
    toolScenario: 'workspace'
  },
  {
    id: 'workflow-workspace-file-direct',
    category: 'workflow',
    historyProfile: 'none',
    prompt:
      '当前对话已经绑定到工作区「Nova Journal」，你已经能看见 index.html 当前内容。少思考，直接做；请直接把 index.html 写成一个可运行的日记页面：有标题、日期列表、正文区和一点柔和 CSS。不要先读文件，不要新建普通收藏卡，不要改别的工作区。',
    minVisibleChars: 0,
    acceptedToolKinds: [
      'createProjectFile',
      'writeProjectFiles',
      'editProjectFileText',
      'appendProjectFile',
      'insertProjectFile'
    ],
    completionToolKinds: [
      'createProjectFile',
      'writeProjectFiles',
      'editProjectFileText',
      'appendProjectFile',
      'insertProjectFile'
    ],
    requiresTools: true,
    toolScenario: 'workspace'
  },
  {
    id: 'workflow-workspace-long-diary-app',
    category: 'workflow',
    historyProfile: 'heavy',
    prompt:
      '当前对话已经绑定到工作区「Nova Journal」。这是一个连续任务第一阶段：请先把工作区改成一个可运行的多文件日记应用，至少要有入口页面、样式和脚本；页面需要日记列表、正文阅读区、编辑入口和保存入口。可以先读取现有文件，但不要新建普通收藏卡，不要改别的工作区。',
    minVisibleChars: 0,
    acceptedToolKinds: [
      'createProjectFile',
      'writeProjectFiles',
      'editProjectFileText',
      'appendProjectFile',
      'insertProjectFile',
      'readProjectFile',
      'readProjectFileContext',
      'listProjectFiles',
      'searchProjectFiles',
      'checkProjectPreview',
      'inspectProjectRuntime'
    ],
    completionToolKinds: [
      'createProjectFile',
      'writeProjectFiles',
      'editProjectFileText',
      'appendProjectFile',
      'insertProjectFile'
    ],
    continuationToolKinds: [
      'readProjectFile',
      'readProjectFileContext',
      'listProjectFiles',
      'searchProjectFiles',
      'checkProjectPreview',
      'inspectProjectRuntime'
    ],
    followUpPrompts: [
      '第二阶段：在刚才的日记应用基础上继续加搜索、标签筛选、草稿状态和 localStorage 持久化。继续使用当前工作区工具，不要改成普通聊天回答。',
      '第三阶段：继续完善移动端体验和空状态，再检查入口文件引用是否自洽；如果发现缺文件或引用不一致，请直接修。'
    ],
    minimumCompletionTurns: 3,
    maxWorkflowTurns: 8,
    requiresTools: true,
    toolScenario: 'workspace'
  },
  {
    id: 'workflow-theme-css',
    category: 'workflow',
    historyProfile: 'none',
    prompt:
      '把当前对话主题里的用户气泡改成吐司质感：圆角更软、背景像烤面包、边缘有一点黄油光泽。只改主题 CSS，不要输出完整网页。',
    minVisibleChars: 0,
    acceptedToolKinds: [
      'appendThemeCss',
      'insertThemeCss',
      'replaceThemeCss',
      'editThemeCss',
      'applySurfaceTokens',
      'applyThemeCoordinates',
      'patchRawCss',
      'readThemeCss',
      'inspectThemeRender'
    ],
    completionToolKinds: [
      'appendThemeCss',
      'insertThemeCss',
      'replaceThemeCss',
      'editThemeCss',
      'applySurfaceTokens',
      'applyThemeCoordinates',
      'patchRawCss'
    ],
    continuationToolKinds: [
      'readThemeCss',
      'inspectThemeRender'
    ],
    requiresTools: true,
    toolScenario: 'theme'
  },
  {
    id: 'workflow-theme-css-direct',
    category: 'workflow',
    historyProfile: 'none',
    prompt:
      '少思考，直接做。把当前对话主题里的用户气泡改成吐司质感：圆角更软、背景像烤面包、边缘有一点黄油光泽。只改主题 CSS，不要输出完整网页。',
    minVisibleChars: 0,
    acceptedToolKinds: [
      'appendThemeCss',
      'insertThemeCss',
      'replaceThemeCss',
      'editThemeCss',
      'applySurfaceTokens',
      'applyThemeCoordinates',
      'patchRawCss',
      'readThemeCss',
      'inspectThemeRender'
    ],
    completionToolKinds: [
      'appendThemeCss',
      'insertThemeCss',
      'replaceThemeCss',
      'editThemeCss',
      'applySurfaceTokens',
      'applyThemeCoordinates',
      'patchRawCss'
    ],
    requiresTools: true,
    toolScenario: 'theme'
  }
];
