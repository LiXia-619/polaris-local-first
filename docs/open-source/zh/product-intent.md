# 产品意图

Polaris 是一个 local-first 的 AI 工作空间，用来和模型、协作者、保存材料、工具和个人项目上下文持续工作。它让模型能稳定看见真实本地上下文、真实用户状态、明确工具结果和稳定协作者身份。

## 核心设计哲学

Polaris 按 AI 的直觉来造环境。应用把周围环境摆清楚：模型在哪里，谁在场，有哪些材料，哪些工具能行动，哪些事实足够稳定。

产品给模型判断一个清楚的落脚点。

核心目标是连续性：对话和协作者状态能跨重启存在，卡片、资产、笔记和项目材料能留在它们产生的工作脉络里，provider 和 relay 选择是显式的，memory、summary、原话、document、tool、room event 保持不同权威标签，旧本地数据通过明确导入或迁移边界进入系统，模型收到的是清楚的上下文和工具证据，而不是只有 UI 看见的模糊信号。

## 设计原则

**围绕模型直觉塑造环境。** 模型看到的是一个连贯现场。context、tools、collaborators、room state、project materials 和 recent events 要被摆成模型自然能理解并行动的形状。

**Context 是地形。** request context 应该按职责组装。confirmed memory、semantic recall、summary、raw conversation tail、tool results、reference documents、room events 保持不同角色和权威标签。

**持久事实支撑现场。** 持久事实必须有清楚 owner。UI store 通过文档化的数据 owner 缓存和展示事实。

**用户拥有自己的基础设施。** 后端路由是可选能力面，部署者可以自托管或替换，API origin 必须显式配置。

**工具是真合同。** 一个模型可见工具只有在模型能看见、能调用、能收到清楚结果、用户能检查发生了什么、下一轮请求能回放重要证据时才算完成。

**旧数据通过导入进入。** 已存在的本地数据通过显式导入、迁移和验证边界进入当前数据模型。

**原生壳暴露平台能力。** iOS、Android 和 Web 共享 `src/` 里的产品行为。原生代码负责文件、SQLite、HTTP、通知、WebView 等平台能力。

## 工程边界

文档保持事实分层：源码能构建、测试通过、迁移安全、某个渠道已发布、仓库已开源授权，是不同事实，要分开说明。

## 产品范围

Polaris 提供本地优先的工作空间、显式 provider/relay 配置、导入迁移边界、可检查的工具证据，以及跨端共享的产品 runtime。

## 文档目标

文档说明 Polaris 围绕明确数据所有权、明确后端所有权和明确模块责任组织的原因。代码和文档不一致时，同一轮工作修正。
