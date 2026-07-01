import { buildThemePresetSummaryLine } from './themePresetPromptCatalog';
import { buildSelectorCatalogPromptLines, formatThemeSelectorHintLine } from './themeSelectorPromptCatalog';
import type { AssistantToolContext } from './assistantToolProtocolTypes';

const THEME_PRESET_SUMMARY_LINE = buildThemePresetSummaryLine();

function buildThemeImageAssetLines(context: AssistantToolContext | undefined) {
  const imageAssets = (context?.attachmentSnapshot?.available ?? [])
    .filter((attachment) => attachment.kind === 'image' && attachment.assetId)
    .slice(-6);
  const libraryAssets = (context?.imageAssetSnapshot?.available ?? []).slice(0, 8);
  if (imageAssets.length === 0 && libraryAssets.length === 0) return [];

  const lines = [
    '当前可用于换肤的本地图片素材：',
    ...libraryAssets.map((asset) =>
      `- 图片库 ${asset.title} id=${asset.id}${asset.tags.length ? ` tags=${asset.tags.join('、')}` : ''}：\`${asset.cssUrl}\``
    ),
    ...imageAssets.map((attachment) =>
      `- 对话附件 ${attachment.name} id=${attachment.id}：\`url("polaris-asset://${attachment.assetId}")\``
    )
  ];
  return lines;
}

function buildCreativeThemeExampleLines(context: AssistantToolContext | undefined) {
  const activeWorld = context?.uiSnapshot?.activeWorld ?? 'chat';
  const collectionShelf = context?.uiSnapshot?.collectionShelf ?? 'code';

  if (activeWorld === 'chat') {
    return [
      'CSS 示例：`replaceThemeCss.css` 接收完整 CSS；`appendThemeCss.css` 接收新增规则；`editThemeCss.newString` 接收基于当前 theme.css 的替换片段。',
      '```css\n.app-shell.chat {\n  background: radial-gradient(circle at top, rgba(255,236,244,0.92), rgba(255,248,241,0.96));\n}\n\n.app-shell.chat .bubble.user {\n  background: linear-gradient(135deg, #ffe8f3, #fff2ea);\n  border-radius: 22px;\n  border: 1px solid rgba(255,182,208,0.42);\n}\n\n.app-shell.chat .bubble.assistant {\n  background: transparent;\n  border: 0;\n  box-shadow: none;\n}\n\n.world-chat .tool-event {\n  background: color-mix(in srgb, var(--surface) 10%, transparent);\n  border: 0;\n  border-left: 2px solid color-mix(in srgb, var(--accent) 34%, transparent);\n  box-shadow: none;\n}\n```'
    ];
  }

  if (collectionShelf === 'dialogue') {
    return [
      'CSS 示例：`replaceThemeCss.css` 接收完整 CSS；`appendThemeCss.css` 接收新增规则；`editThemeCss.newString` 接收基于当前 theme.css 的替换片段。',
      '```css\n.app-shell.collection .world-collection .conversation-card-actions {\n  background: color-mix(in srgb, var(--accent-soft) 58%, transparent);\n  border-radius: 16px;\n  color: var(--text);\n}\n```'
    ];
  }

  return [
    'CSS 示例：`replaceThemeCss.css` 接收完整 CSS；`appendThemeCss.css` 接收新增规则；`editThemeCss.newString` 接收基于当前 theme.css 的替换片段。',
    '```css\n.app-shell.collection {\n  background: linear-gradient(180deg, #fff2f6 0%, #fff7fb 100%);\n}\n\n.app-shell.collection .world-collection .card {\n  background: rgba(255,255,255,0.88);\n  border: 1px solid rgba(255,196,214,0.52);\n  box-shadow: 0 16px 30px rgba(255,196,214,0.14);\n}\n```'
  ];
}

function buildCreativeSelectorCatalogLines(context: AssistantToolContext | undefined) {
  const selectorHints = context?.uiSnapshot?.selectorHints;
  if (selectorHints?.length) {
    return [
      '创意模式 selector：',
      ...selectorHints.map((hint) => formatThemeSelectorHintLine(hint))
    ];
  }

  return buildSelectorCatalogPromptLines({
    activeWorld: context?.uiSnapshot?.activeWorld,
    collectionShelf: context?.uiSnapshot?.collectionShelf,
    modelTier: context?.modelTier,
    chatAvatarLayoutEnabled: context?.uiSnapshot?.chatAvatarLayoutEnabled
  });
}

export function buildCreativeThemeToolRules(context?: AssistantToolContext) {
  const toolEnforcementMode = context?.toolEnforcementMode ?? 'normal';

  return [
    '创意模式把当前皮肤当作一份虚拟 `theme.css` 来编辑。',
    toolEnforcementMode === 'force'
      ? '这轮已经明确进入换肤辅助；写入工具会进入试穿，读取工具只返回 CSS 证据。'
      : null,
    '可用 action：',
    '1. readThemeCss：读取当前完整 `theme.css`，看清 blank-base / preset / custom / generated 的真实顺序。它是文件快照，不是每轮通行证。',
    '2. editThemeCss：替换已有片段时用 oldString/newString 精确改 custom 或 generated 层，像改工作区文件一样。',
    '3. appendThemeCss：新增 selector 或新增一段局部 CSS 时用它；不需要 oldString，默认追加到 generated 层末尾。',
    '4. insertThemeCss：想把新增 CSS 放到某个已有片段前后时用它；需要 anchorString。',
    '5. deleteThemeCss：删除 custom/generated 里的现有片段时用它；需要 oldString。',
    '6. replaceThemeCss：用户要完整换一套皮肤时用它；它会清掉 preset，从纯自定义底座写入完整 CSS。',
    '7. inspectThemeRender：试穿后读取关键区域 computed style，检查颜色、背景、边框和可读性。',
    '8. applyPreset：只在明确要换回某个预设底座时再用。',
    '当前换肤模式：创意模式。把皮肤当作 `theme.css` 文件编辑；replaceThemeCss 写完整 CSS，appendThemeCss 新增规则，editThemeCss 替换已有片段，readThemeCss 返回当前完整 CSS。',
    buildCreativeSelectorCatalogLines(context).join('\n'),
    THEME_PRESET_SUMMARY_LINE,
    '规则：',
    '- alias 只是目录里的记号，不是类名；真正落笔只抄上面的 selector，不要把 `chat-background` 写成 `.chat-background`，也不要给 alias 补点。',
    '- 用户点名收藏区、房间、卡片架、代码卡、房间卡或对话卡时，CSS 里必须包含 `.app-shell.collection` / `.world-collection` 这类收藏区 selector；点名对话卡优先用 `.conversation-card`，点名代码卡 / 房间卡优先用 `.code-card`，如果只写了 `.app-shell.chat`，正文不能说收藏区已经变了。',
    '- 用户要求对话区和收藏区一起变时，CSS 必须同时包含 chat selector 和 collection selector。',
    '- 界面角色决定形态：助手正文是阅读文字，工具收据是执行反馈，系统提示是轻状态，输入区是稳定底座。',
    '- 可读性是硬要求：给有文字的面改 background / border / filter 时，同一轮必须确认文字色仍清楚；必要时在同一个 selector 或它的文字子层同步写 `color`，或在 `.app-shell.chat` / `.app-shell.collection` 上同步写 `--text`、`--text-soft`、`--text-muted` 这组变量。',
    '- 不要只把 accent 当文字色直接抹到正文、按钮标签、tab label 或工具收据上；深底用接近白的文字，浅底用接近深墨的文字，弱化文字用透明度而不是低对比同色。',
    '- CSS 必须是浏览器能直接应用的完整规则：写成 `selector { property: value; }`。不要只写 selector 列表，也不要把裸声明直接丢在顶层；只改变量时写进 `.app-shell { --name: value; }`。',
    '- 小改不要清底：新增 selector 用 appendThemeCss；改已有 selector 的局部几行用 editThemeCss；删除误写片段用 deleteThemeCss。保留用户前几轮已经做过的颜色、边框或装饰。',
    '- 整套新皮肤才清底：当用户说“换一套 / 整个房间 / 整页风格”时，用 replaceThemeCss 写完整 CSS，不要把完整皮肤叠在默认 preset 上。',
    '- 小改就只编辑、追加或删除那几个 selector，大改就写一份完整 CSS。',
    '- “框框 / 外框 / 边框 / 硬框 / 框住”通常对应内层壳：顶栏身份区是 `app-topbar-identity`，代码详情是 `chat-code-detail`，工具小票/图标/展开按钮是 `chat-tool-receipt`；背景或外层 topbar 不是这些内层壳。',
    '- inspectThemeRender 只能读取当前已经挂载的界面 DOM。目标在另一个世界时，按当前 theme.css 快照和 selector 目录编辑；不要把 missing 当成 selector 不存在，也不要声称已经完成跨世界视觉检查。',
    '- 聊天气泡可以做 QQ 式图片气泡：`.bubble.user` / `.bubble.assistant` 负责气泡底和正文区域；贴纸、小尾巴、角标或漂浮装饰优先挂到 `.bubble-frame.user::before` / `.bubble-frame.user::after` 或 `.bubble-frame.assistant::before` / `.bubble-frame.assistant::after`，必要时同步让 `.msg-row.*`、`.bubble-frame.*`、`.bubble.*` `overflow: visible`；如果用户给了可访问图片 URL，可以在伪元素里写 `background-image: url("...")`，不要说聊天气泡不支持图片。',
    '- 用户想保存、复用、复制或分享某个部件样式时，把该部件 CSS 包在 `/* @polaris-part target="chat-bubble-user" name="..." */ ... /* @end-polaris-part */` 中；target 用 selector catalog alias。这样的片段粘进 CSS 框会替换同 target 的旧部件，同时保留其他部件。',
    '- 下面列出的 `polaris-asset://...` 是本地可用图片地址，可以直接写成 `url("polaris-asset://...")`；不需要外链图床。',
    '- createImageVariant 会生成 background / bubble-sticker / avatar 变体，并返回可写进 CSS 的 `polaris-asset://...`。',
    '- extractImagePalette 会从图片返回 background / surface / accent / text 建议。',
    '- 气泡装饰图只做视觉层，必须写 `pointer-events: none`，不要遮住正文、复制按钮、工具收据或输入区；正文可读性是硬边界，装饰贴图不清楚时缩小或移到气泡外沿。',
    ...buildThemeImageAssetLines(context),
    '- 动作能力：replaceThemeCss 写完整 CSS；appendThemeCss 新增片段；editThemeCss 替换已有片段；insertThemeCss 贴着锚点插入；readThemeCss 返回 CSS 快照。',
    '- 如果当前通道退到 `polaris-tools` JSON fallback，外层只保留 1 个 `actions` 数组；`css` 字段里只放纯 CSS，不要再把 `kind`、`actions` 或整段工具 JSON 塞进 `css` 里面。',
    '- patchRawCss 是旧入口；appendThemeCss 是新增 CSS 的当前入口。',
    '- 不要再输出坐标动作、surface token 动作或别的创意旧 action。',
    '- 正文自然接话，具体改动结果由系统按执行回填。',
    ...buildCreativeThemeExampleLines(context)
  ].filter((line): line is string => Boolean(line));
}
