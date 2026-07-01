import {
  SURFACE_TOKEN_GRADIENT_MODES,
  SURFACE_TOKEN_TEXTURES
} from '../theme-coordinate/themeCoordinateSurfaceTokens';
import type { PolarisToolDefinition } from './toolRegistryShared';
import type { AssistantToolActionKind } from '../toolActionTypes';
import {
  buildThemeSharedRules,
  numberProperty,
  objectParameters,
  stringProperty
} from './toolRegistryShared';

type ThemeToolKind = Extract<
  AssistantToolActionKind,
  | 'applyThemeCoordinates'
  | 'applySurfaceTokens'
  | 'patchRawCss'
  | 'readThemeCss'
  | 'editThemeCss'
  | 'appendThemeCss'
  | 'insertThemeCss'
  | 'deleteThemeCss'
  | 'replaceThemeCss'
  | 'inspectThemeRender'
  | 'applyPreset'
>;

export const THEME_TOOL_DEFINITION_MAP = {
  applyThemeCoordinates: {
    name: 'applyThemeCoordinates',
    group: 'theme-stable',
    brief: '稳态整体换肤，四轴坐标',
    schema: {
      name: 'applyThemeCoordinates',
      description: '稳态整体换肤。targets 表示全局或多个编号范围；hue、hueCount、emotion、meaning 四个数字表示主题方向，系统会生成整页主题预览。',
      parameters: objectParameters({
        targets: {
          description: '目标范围。整页用 all；多个编号区域用 01-08 的编号数组。只要不是恰好 1 个编号，都属于整体坐标工具。',
          oneOf: [
            { type: 'string', enum: ['all'] },
            {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 8
            }
          ]
        },
        hue: numberProperty('主色倾向，0 到 360。比如薄荷偏青绿，晚霞偏橙粉，雨天窗边偏蓝灰。'),
        hueCount: numberProperty('整页色彩复杂度，1 到 9。越小越克制干净，越大越丰富活。'),
        emotion: numberProperty('情绪张力，-10 到 10。越大越热烈张扬，越小或负数越冷静轻。'),
        meaning: numberProperty('存在感方向，-10 到 10。越小越像空气、光、雾、洗开的颜色；越大越像纸、布、纤维、涂层等可触碰材料。不要把“有画面”直接当成更大。'),
        baseColor: stringProperty('可选完整底色，写十六进制色值，比如 #f3b7c8。适合“材质要对，但别被系统自动压成深色”的浅粉纸本、奶油纸卡这类意图。'),
        label: stringProperty('可选的短标签，用来给这版试穿命名。'),
        seed: numberProperty('可选。需要一点随机变化时再给。')
      }, ['targets', 'hue', 'hueCount', 'emotion', 'meaning'])
    },
    buildRules: buildThemeSharedRules
  },
  applySurfaceTokens: {
    name: 'applySurfaceTokens',
    group: 'theme-stable',
    brief: '稳态单点精修，结构化 token',
    schema: {
      name: 'applySurfaceTokens',
      description: '稳态单点精修。targets 指定恰好 1 个 01-08 编号；结构化 token 会编译成稳定的局部样式预览。',
      parameters: objectParameters({
        targets: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 1,
          description: '目标区域编号数组，但这里只能有 1 个 01-08 编号。'
        },
        spell: stringProperty('1 到 3 个风格关键词，用空格分隔。'),
        hue: numberProperty('主色相，0-360。'),
        saturation: numberProperty('饱和度，0-100。'),
        lightness: numberProperty('亮度，0-100。'),
        opacity: numberProperty('背景不透明度，0-100。'),
        radius: numberProperty('圆角，0-48。'),
        borderW: numberProperty('边框粗细，0-8。'),
        blur: numberProperty('毛玻璃强度，0-40。'),
        shadowDepth: numberProperty('阴影深度，0-5。'),
        texture: stringProperty('材质纹理。', { enum: [...SURFACE_TOKEN_TEXTURES] }),
        gradientMode: stringProperty('渐变方式。', { enum: [...SURFACE_TOKEN_GRADIENT_MODES] }),
        gradientAngle: numberProperty('渐变角度，0-360。'),
        accentHue: numberProperty('强调色色相，0-360。'),
        label: stringProperty('可选短标签。')
      }, ['targets', 'spell'])
    },
    rules: [
      '- `applySurfaceTokens` 只在 `targets` 恰好 1 个编号时合法。',
      '- 局部精修先写 `spell`，再补结构化 token，不要反过来。'
    ]
  },
  patchRawCss: {
    name: 'patchRawCss',
    group: 'theme-creative',
    brief: '追加 CSS 到当前 theme.css，可用 appendThemeCss 代替',
    schema: {
      name: 'patchRawCss',
      description: '兼容入口。追加一段 CSS 到当前虚拟 theme.css 的 generated 可写层并进入试穿。新工具名是 appendThemeCss。',
      parameters: objectParameters({
        css: stringProperty('完整 CSS 规则。这里直接写 selector + 花括号。'),
        label: stringProperty('可选短标签。')
      }, ['css'])
    },
    buildRules: buildThemeSharedRules
  },
  readThemeCss: {
    name: 'readThemeCss',
    group: 'theme-creative',
    resultReplayMode: 'full-detail',
    brief: '读取当前虚拟 theme.css',
    schema: {
      name: 'readThemeCss',
      description: '读取当前完整虚拟 theme.css。返回 blank-base、preset、custom、generated 的真实 cascade 顺序；blank-base/preset 是只读底座，custom/generated 是可编辑层。',
      parameters: objectParameters({})
    },
    buildRules: buildThemeSharedRules
  },
  editThemeCss: {
    name: 'editThemeCss',
    group: 'theme-creative',
    brief: '精确编辑当前主题 CSS',
    schema: {
      name: 'editThemeCss',
      description: '局部精确修改当前主题 CSS。它保留现有 CSS，只替换匹配到的原文片段；完整换一套皮肤由 replaceThemeCss 承载。系统会进入试穿，不会直接落库。',
      parameters: objectParameters({
        oldString: stringProperty('要替换的原文 CSS 片段。应来自最近一次 readThemeCss 返回的 custom 或 generated 可写层，或来自本轮上下文里已经明确可见的可写层原文。'),
        newString: stringProperty('替换后的 CSS 片段。'),
        layer: stringProperty('可选。指定 custom 或 generated；不填时系统会在两个可写层里找唯一匹配。', { enum: ['custom', 'generated'] }),
        label: stringProperty('可选短标签。')
      }, ['oldString', 'newString'])
    },
    buildRules: buildThemeSharedRules
  },
  appendThemeCss: {
    name: 'appendThemeCss',
    group: 'theme-creative',
    brief: '向当前 theme.css 追加新 CSS',
    schema: {
      name: 'appendThemeCss',
      description: '向当前虚拟 theme.css 的可写层末尾追加新 CSS，并进入试穿。适合新增一个 selector、补一段局部样式、给还不存在的区域写规则；不需要 oldString。',
      parameters: objectParameters({
        css: stringProperty('要追加的完整 CSS 规则，直接写 selector + 花括号。'),
        layer: stringProperty('可选。追加到 custom 或 generated；不填默认 generated，让新增规则压在最后。', { enum: ['custom', 'generated'] }),
        label: stringProperty('可选短标签。')
      }, ['css'])
    },
    buildRules: buildThemeSharedRules
  },
  insertThemeCss: {
    name: 'insertThemeCss',
    group: 'theme-creative',
    brief: '在当前 theme.css 某段前后插入 CSS',
    schema: {
      name: 'insertThemeCss',
      description: '在当前虚拟 theme.css 的可写层里，以 anchorString 为锚点，在前面或后面插入新 CSS，并进入试穿。适合想把新增规则放到某个已有区域旁边；如果只是末尾新增，用 appendThemeCss。',
      parameters: objectParameters({
        anchorString: stringProperty('锚点原文片段。必须来自最近一次 readThemeCss 返回的 custom/generated 可写层，且在可写层里唯一。'),
        css: stringProperty('要插入的完整 CSS 规则。'),
        position: stringProperty('插入到锚点 before 或 after；不填默认 after。', { enum: ['before', 'after'] }),
        layer: stringProperty('可选。指定 custom 或 generated；不填时系统会在两个可写层里找唯一锚点。', { enum: ['custom', 'generated'] }),
        label: stringProperty('可选短标签。')
      }, ['anchorString', 'css'])
    },
    buildRules: buildThemeSharedRules
  },
  deleteThemeCss: {
    name: 'deleteThemeCss',
    group: 'theme-creative',
    brief: '从当前 theme.css 删除一段 CSS',
    schema: {
      name: 'deleteThemeCss',
      description: '从当前虚拟 theme.css 的可写层删除一段现有 CSS，并进入试穿。适合移除上一轮误写的规则或删掉不想要的局部样式；删除前需要已经看见或明确知道 oldString。',
      parameters: objectParameters({
        oldString: stringProperty('要删除的原文 CSS 片段。必须来自 custom/generated 可写层，且在可写层里唯一。'),
        layer: stringProperty('可选。指定 custom 或 generated；不填时系统会在两个可写层里找唯一匹配。', { enum: ['custom', 'generated'] }),
        label: stringProperty('可选短标签。')
      }, ['oldString'])
    },
    buildRules: buildThemeSharedRules
  },
  replaceThemeCss: {
    name: 'replaceThemeCss',
    group: 'theme-creative',
    brief: '完整替换成独立皮肤 CSS',
    schema: {
      name: 'replaceThemeCss',
      description: '完整换一套独立皮肤。清掉 preset 底座，从纯自定义底座开始，把 css 作为完整 custom CSS 写入并进入试穿。',
      parameters: objectParameters({
        css: stringProperty('完整主题 CSS。必须覆盖这套皮肤需要的主要变量、背景、表面和文字可读性。'),
        label: stringProperty('可选短标签。')
      }, ['css'])
    },
    buildRules: buildThemeSharedRules
  },
  inspectThemeRender: {
    name: 'inspectThemeRender',
    group: 'theme-creative',
    resultReplayMode: 'full-detail',
    brief: '检查当前主题实际渲染样式',
    schema: {
      name: 'inspectThemeRender',
      description: '读取当前页面关键区域的 computed style 和基础对比信息，用来检查刚才的 theme.css 修改是否真的渲染正确。',
      parameters: objectParameters({})
    },
    buildRules: buildThemeSharedRules
  },
  applyPreset: {
    name: 'applyPreset',
    group: 'theme-creative',
    brief: '应用预设主题',
    schema: {
      name: 'applyPreset',
      description: '应用一套预设主题底座。只在明确全局请求时使用。',
      parameters: objectParameters({
        presetId: stringProperty('预设主题 id。按 prompt 里给出的 presetId 清单填写。')
      }, ['presetId'])
    },
    rules: [
      '- applyPreset 会影响整套底座，只在明确全局请求时才用。',
      '- 用户点名“收藏区 / 对话区 / 卡片本身”时不要用它偷换范围。'
    ]
  }
} satisfies Record<ThemeToolKind, PolarisToolDefinition<ThemeToolKind>>;

export const THEME_TOOL_DEFINITIONS = Object.values(THEME_TOOL_DEFINITION_MAP);
