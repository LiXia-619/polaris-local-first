import type { ProductDocSection } from './types';

export const THEME_BEAUTIFICATION_SELECTOR_GUIDE_SECTION: ProductDocSection = {
  heading: '如果你想找主题美化选区',
  body: [
    '用户要求改主题外观时，先把自然语言落到真实可改对象上，再选工具。主题 CSS 改的是应用 UI 壳、颜色、边框、阴影、背景、文字和装饰，不会改用户上传图片本身的像素。头像尤其要分清：用户或协作者自己上传的头像图，应该通过头像图片编辑、换图或图片变体处理；主题 CSS 只能改头像外框、占位底、阴影、边框、圆角、大小附近的视觉感。',
    '找不到选区时，不要编造“用户头像背景”这类不存在的稳定 surface。可以在创意模式里用下面的 selector 改真实 DOM；稳定模式只能改主题 surface registry 里已有的背景、顶栏、用户气泡、回复正文、输入区、系统提示、面板和卡片。'
  ],
  bullets: [
    '“对话背景 / 聊天底色 / 整个聊天页”：用 chat-background，对应 .app-shell.chat。',
    '“顶栏 / 顶部胶囊 / 标题栏”：用 chat-topbar；如果是顶栏里的名字、世界入口、文字外框，用 app-topbar-identity。',
    '“我的气泡 / 用户气泡 / 右侧气泡”：用 chat-bubble-user，对应 .app-shell.chat .bubble.user。',
    '“助手正文 / 回复正文 / 左侧正文 / AI 气泡”：用 chat-bubble-assistant，对应 .app-shell.chat .bubble.assistant。头像模式也继续使用这个气泡壳，所以皮肤不需要另找一套 selector。',
    '“气泡贴纸 / 气泡角标 / 小尾巴 / 浮在气泡外的装饰”：优先用 chat-bubble-frame-user 或 chat-bubble-frame-assistant，挂到 .bubble-frame.*::before / ::after，并在必要时放开 msg-row、bubble-frame、bubble 的 overflow。',
    '“我的头像背景 / 用户头像底色 / 右侧头像壳”：用 chat-user-avatar-frame。只能改头像外框或无图 fallback 底色；如果用户已经上传真实头像图，主题不能把图片内容改成另一个颜色。',
    '“助手头像背景 / AI 头像底色 / 左侧头像壳”：用 chat-assistant-avatar-frame。只能改协作者头像外框或 fallback 底色；要改头像图本身，需要换头像或处理图片。',
    '“两边头像统一 / 头像大小阴影边框”：用 chat-avatar-frame，同步改聊天里的用户和助手头像壳。',
    '“输入框 / 底部发送区”：用 chat-composer；只改视觉，不接管键盘高度或固定定位。',
    '“发送按钮”：用 chat-send-button。',
    '“工具记录 / 试穿记录 / 执行收据”：用 chat-tool-receipt，不要误改助手正文。',
    '“思考框 / 正在想 / 推理摘要”：用 chat-thinking-box 或 chat-streaming-hint。',
    '“对话卡 / 聊天记录卡”：用 collection-dialogue-card。',
    '“房间卡 / 代码卡 / 小页面卡”：用 collection-code-card；只在明确要所有卡统一时才用 collection-card-unified。',
    '“工作区封面 / 项目封面”：用 collection-workspace-cover；当前工作区封面优先考虑 patchRoomProject 的 coverStyle。',
    '“收藏底栏 / 房间导航栏”：用 collection-shelf-tabs。',
    '“弹窗 / 设置面板 / 模型面板壳”：用 app-sheet、app-provider-sheet 或 app-theme-studio，按实际面板选。'
  ]
};
