# 模块指南

这份指南记录 Polaris 主要模块的意图所有权。它是设计地图，不是声称每个文件已经完美匹配目标。

重构时要保护责任边界，让每个模块为什么存在、负责什么、不能负责什么都容易解释。

## App Shell

**Purpose:** 提供产品 world 出现的外框。

**Owns:** 首屏、hydration 生命周期协调、导航、全局菜单/sheet 入口、应用级状态面。

**Does not own:** chat 语义、provider 请求构造、LocalData 迁移规则、collection 存储。

**Main paths:** `src/ui/AppShell.tsx`, `src/app/shell/`, `src/ui/app-shell/`.

## Layout Surfaces

**Purpose:** 决定共享 runtime 按 phone、tablet 还是 desktop 排布。

**Owns:** layout surface resolution、sidebar 条件、desktop-sidebar 自动折叠、明确布局 bootstrap facts。

**Does not own:** iOS/Android bridge permission、desktop-host permission、release-channel status、chat/collection 语义、viewport/keyboard geometry。

**Main paths:** `src/app/shell/appLayoutSurface.ts`, `src/ui/app-shell/useAppLayoutSurface.ts`, `src/app/bootstrap/appLayoutSurfaceBootstrap.ts`, `docs/layout-contract.md`.

## Chat

**Purpose:** 和协作者、模型、上下文、工具一起运行对话工作流。

**Owns:** submit、stop、retry、edit、fork、message timeline、request lifecycle、tool invocation lifecycle、memory/context use。

**Does not own:** 持久 row schema、provider credential policy、collection project storage、native platform behavior。

**Main paths:** `src/ui/worlds/ChatWorld.tsx`, `src/app/chat/`, `src/app/group/`, `src/engines/chat-api/`.

**Related:** [记忆与群聊意图实现对照](memory-and-group-chat-intent.md)。

## Collection

**Purpose:** 在线性 chat turn 之外保存有用输出和项目材料。

**Owns:** cards、saved materials、image/file shelves、room projects、workspace files、collection filtering、collection import/export surfaces。

**Does not own:** chat turn lifecycle、provider request assembly、LocalData backend selection。

**Main paths:** `src/ui/worlds/CollectionWorld.tsx`, `src/app/collection/`, `src/ui/collection/`.

## Persona

**Purpose:** 定义协作者身份、行为设置和长期 reference heads。

**Owns:** persona directory、persona settings、persona builder、reference document 的产品层所有权。

**Does not own:** document body storage internals、provider credentials、global request transport。

**Main paths:** `src/app/persona/`, `src/config/persona/personaBuilder.ts`, persona store code.

**Related:** [记忆与群聊意图实现对照](memory-and-group-chat-intent.md)。

## Runtime And Provider

**Purpose:** 决定模型请求如何配置和传输。

**Owns:** provider profiles、model capability、request capability、direct provider calls、relay routing、native HTTP transport choices。

**Does not own:** UI persistence、official server defaults、chat message mutation。

**Main paths:** `src/engines/provider-runtime/`, `src/engines/request/`, `src/engines/chat-api/`, provider settings UI.

## Tool Protocol

**Purpose:** 让模型可见工具在 prompt、parser、executor、UI evidence 和 next-turn replay 中可靠。

**Owns:** schemas、prompt catalog visibility、parser/canonicalizer、execution result semantics、replay projection。

**Does not own:** feature-specific layout、unrelated provider limits、hidden side effects。

**Main paths:** `src/engines/tool-protocol/`, tool executors, tool UI surfaces.

## LocalData Repository

**Purpose:** 做应用数据的持久事实合同。

**Owns:** row states、domain ownership、commit validation、import/promotion invariant、backend abstraction。

**Does not own:** UI presentation、provider networking、undocumented storage behavior。

**Main paths:** `src/engines/localData/`, domain row writers, data-boundary tests.

## Import And Export

**Purpose:** 通过显式验证边界，把用户控制的 package 移入或移出当前数据模型。

**Owns:** package import/export、import diagnostics、migration checks、data validation、rollback safety。

**Does not own:** ordinary startup truth、ordinary save paths、placeholder replacement data、old-user in-place upgrade promises。

## Assets And Documents

**Purpose:** 把二进制和 document truth 与 UI preview 分开。

**Owns:** asset rows、blob cache、document bodies、missing-body semantics、import/export evidence。

**Does not own:** chat conversation ownership、persona head ownership、provider transport。

## Server And Selfhost

**Purpose:** 提供可选、部署者拥有的 API 和 relay 能力。

**Owns:** provider relay endpoint、`api/` serverless handlers、Worker gateway example、shared relay-target validators、origin policy、diagnostics receiver、search helper。

**Does not own:** 默认服务假设、deployer credential policy。

## Native Bridges

**Purpose:** 把平台能力暴露给共享 runtime。

**Owns:** SQLite plugin、file picker、native HTTP、notifications、WebView shell integration。

**Does not own:** 共享产品语义、重复 chat/collection 行为、phone/tablet/desktop layout selection。

## Desktop And Companion

**Purpose:** 暴露用户拥有的本地权限和可选 companion connectivity。
