# 布局边界契约

日期：2026-04-09

这份文件只回答一件事：布局 / viewport / 键盘这条链里，谁有权决定什么。

如果你要改键盘、输入框、世界切换、移动 web 高度、或 theme 挂到的结构节点，先读这份，再读 [layout-viewport-keyboard-refactor-plan-20260409.md](/docs/layout-viewport-keyboard-refactor-plan-20260409.md)。

## 单点 owner

- 只有 [useViewportShellVars.ts](/src/ui/useViewportShellVars.ts) 能写 `--app-height`、`--viewport-height`、`--viewport-offset-top`、`--keyboard-offset`、`html[data-keyboard-open]`；唯一例外是 [nativeShellBootstrap.ts](/src/app/bootstrap/nativeShellBootstrap.ts) 可以在 React 挂载前一次性预写 `--app-height` 和 native 平台标记，作为启动遮罩高度，挂载后立刻由 `useViewportShellVars.ts` 接管并覆盖/清理
- 只有 root / shell 这条链能消费 `--app-height` 作为壳体高度
- `chat-dock` 消费键盘几何来决定聊天输入区底边；iOS app 内键盘覆盖时，`viewportFocusVisibility.ts` 可以在聊天输入区获得焦点后把 `.chat-flow` 贴回底部，让滚动区跟随键盘可见区恢复；`scroll-contract.css` 里的纵向滚动 owner 可以消费同一个键盘变量作为底部 `scroll-padding` / 内容留白，保证 sheet 表单在键盘上方可滚动；`.chat-composer` 只能做内容和视觉，不拥有 viewport
- 只有 [useWorldFramePresence.ts](/src/ui/useWorldFramePresence.ts) 能决定 `render / hide / unmount`
- theme 只改 look，不改 geometry
- 世界框架只负责裁切和挂载状态；具体页面滚动由 `scroll-contract.css` 里的内层 scroll owner 承担

## 明确禁止

- 产品路径里重新引入 `100dvh`、`100vh`、`100svh` 作为布局高度来源
- 在别处重复计算 keyboard offset 或 keyboard open；非聊天表单只能消费 `useViewportShellVars.ts` 已写好的变量，不能自己测键盘
- 让 `.chat-composer` 直接依赖 `data-keyboard-open`、`--keyboard-offset`、`position: fixed`、或键盘态 padding
- 让 world switch 动画、streaming 补丁、body scroll lock 反过来接管布局几何
- 让 theme CSS 通过 `height`、`padding-bottom`、`transform`、`position` 之类的结构属性去顶布局
- 让 `.world-frame` / `.collection-frame.active` 这类世界外壳和内部页面同时滚动

## 滚动归属

- 裁切壳负责 `overflow: hidden`、高度继承和 `min-height: 0`
- 纵向 scroll owner 负责 `overflow-y: auto`、`overscroll-behavior-y: contain`、`-webkit-overflow-scrolling: touch`、`touch-action: pan-y`，以及键盘打开时的底部 `scroll-padding` / 可滚留白
- 横向条负责 `overflow-x: auto`、`overscroll-behavior-x: contain`、`touch-action: pan-x`
- 卡片、chip、记忆条目这类可点击内容如果位于纵向滚动区内，只放行纵向拖拽，不自己成为滚动 owner

## 结构锚点

下面这些类名是 theme 会挂到的结构锚点，没有结构性理由不要改名，也不要挪丢：

- `.app-shell`
- `.app-stage`
- `.world-chat`
- `.chat-box`
- `.topbar`

## 改动顺序

- 先定 owner，再删旧补丁
- 先收 root / shell 高度，再摘 document 级 scroll reset
- 先画 world presence 状态机，再改 world switch
- 如果结构和视觉纠缠，先拆边界，再动代码

## 验收问题

改完以后，必须能立刻回答这五句：

- 键盘高度谁说了算
- app 高度谁说了算
- chat 输入区底边谁说了算
- chat / collection 谁现在挂着谁说了算
- theme 到底能改什么不能改什么

如果其中任何一句还需要去翻三四个文件，这次改动就还没收干净。
