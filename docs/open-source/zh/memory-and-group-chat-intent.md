# 记忆与群聊意图实现对照

记忆和群聊是同一个 Polaris 原则的两个表达：context 应该被塑造成模型能读懂的环境，lane、room、tool 和 fact 都有自己的命名位置。proof 是代码里的责任边界：哪个模块拥有哪条上下文车道、房间行为、工具面和持久证据。

## 为什么这两个系统要一起讲

Polaris 构造的是一个能让模型重新回到真实工作现场的环境：证据清楚、权威清楚、房间边界清楚。

记忆和群聊共享同一个底层想法：

- context 被组装成命名 lane
- 应用要告诉模型每块 context 从哪里来
- stable facts、recent wording、summary、document、tool、room events 保持不同权威
- 协作者进入 shared space 时仍保留自己的身份
- 系统通过结构、状态和工具塑造环境

## 意图到实现

| 产品意图 | 实现形态 | 为什么重要 |
| --- | --- | --- |
| 记忆是分层 context compiler | `requestPreparation.ts` 分别组装 memory、summary、recall、history、tools 和 conversation messages | 请求路径保持可检查 |
| 确认事实和召回线索权威不同 | `requestMemoryPlan.ts`, `requestSemanticRecallPlan.ts`, `requestContextContent.ts` 渲染不同 segment | 向量命中不能伪装成规则或确认事实 |
| 长资料应该可展开 | memory/reference docs 先作为目录进入，需要时通过工具读取 | 大材料可用，但不淹没每次请求 |
| summary pipeline 和 request visibility 不能混淆 | `memoryReleaseGates.ts` 可控制生成/存储/UI 与请求注入 | 生成数据存在不等于每轮回复都受它影响 |
| 群聊是房间面 | `src/app/group/` 拥有 turn-taking、group request shaping、private lanes、tabs、settings、room artifacts | 群聊行为来自房间结构 |
| 协作者进群后仍是自己 | Group request 保留成员 identity 和可选 memory recall，同时收窄 room-level tools | 同一个协作者能把个人连续性带进共享空间 |
| 共享产物需要房间和作者归属 | Group artifact selectors 收集 room-lineage cards/files/images 并保留 owner | 用户和模型都不会混淆协作痕迹 |

## 记忆合同

实现把 cross-conversation memory、vector memory 和 long-term reference documents 分开。它们属于同一个记忆大类，但不是同一种材料。

基础记忆系统站在直接连续性材料上：

- prior conversation 的原话帮助模型恢复语气、关注点和连续性
- confirmed memory entries 承载稳定用户或项目事实
- long reference documents 保持为可读文档，不塞进每次请求

小模型辅助会增加生成材料：profile-like summaries、recent-topic summaries、用于 vector retrieval 的 semantic text。地基是当前 raw tail、协作者身份、confirmed memory、recent wording 和 reference docs；summary 可用时再增加结构。

## 记忆是 context compiler 的燃料

记忆架构关心的是认知地形，不只是 token 优化。Polaris 在把记忆放进请求前，需要知道每块材料的职责：

- hard rules 是规则
- persona defaults 描述交互姿态
- active task context 告诉模型当前站在哪张桌子前
- confirmed memory 是可复用背景
- semantic recall 是候选连续性材料
- summaries 是有损解释
- reference documents 是可展开来源
- raw recent history 是刚刚发生事实的最强证据
- latest user message 是最高优先级实时输入

Memory 在请求路径中进入不同 lane。

| Lane | 用途 | 当前实现 |
| --- | --- | --- |
| Confirmed memory | 给协作者选出的稳定事实和偏好 | `requestMemoryPlan.ts`, `buildMemorySegment()` |
| Memory reference docs | 长材料先暴露目录，再由工具读取 | `buildMemorySegment()` 和 memory-doc tools |
| Conversation summaries | profile/recent-topic summary，不是 quote 或 rule | `requestConversationSummaryPlan.ts`, `buildConversationSummarySegment()` |
| Semantic recall | prior wording 和 retrieved continuity clues | `requestSemanticRecallPlan.ts`, vector recall helpers, `buildSemanticRecallSegment()` |
| History summary | 被裁掉旧历史的降级材料，不是跨对话记忆 | `requestContextPlan.ts` |
| Raw tail | 最近真实 conversation events | `src/engines/request/` 的 history assembly |

## 原话携带连续性

原话携带用户表达、关注点、节奏和此前 framing。工程上要标明它的权威位置；模型-facing copy 要让它成为模型能自然使用的连续性材料。

当前实现同时保留这两边：

- `buildSemanticRecallSegment()` 告诉模型 recalled snippets 是 prior user wording 和 continuity material。
- segment 仍标明它是 semantic recall，不是 confirmed memory 或 rule。
- candidate 保留 source conversation/message id，方便检查。

## 群聊合同

群聊是完整产品面。房间有自己的入口、tabs、settings、member list、background、tool permissions、artifacts、images 和 private member lanes。

用户心智模型是：

- group room 是一个 shared public conversation
- 每个协作者在房间里仍是自己
- 每个协作者能带自己的 memory 和 identity
- group outputs 属于 group，并带 authorship
- private member lanes 可承载每个协作者自己的 context 和 process
- room 决定哪些 shared tools 存在

## 群聊房间秩序

群回复先经过房间秩序，再轮到模型开口。

| Concern | 当前实现 |
| --- | --- |
| Round order | `orderGroupRoundRespondents()` 在最后真实 speaker 后旋转，并把被点名成员前置 |
| Random order | `planGroupRandomRespondents()` 选择 subset 并分配 staggered delays |
| Relay mentions | `insertRelayTargets()` 和 reply controller 把被 @ 的成员插入下一次机会 |
| Running state | `useGroupReplyController()` 追踪 per-member generation keys、stop/retry、timer 和 session |
| Silence | `GROUP_SILENCE_SENTINEL` 可按 group 开启，完成后从 public messages 中收走 |

模型仍写实际消息，但应用负责谁该说、什么时候说、`@member` 怎么改变下一次发言机会。

## 群请求形状

每个成员 turn 都会被改造成 room-shaped request：

- `buildGroupMemberSystemMessage()` 告诉当前协作者这是 public group room，不是回到 private chat。
- `labelRequestMessagesForMember()` 把其他协作者公开消息标成 named messages。
- `buildLaneDigestMessage()` 把该成员 private lane 带进本轮。
- `buildGroupTurnAnchorMessage()` 在靠近生成点的位置再次钉住 room/member identity。
- `useGroupWorldController()` 为 group request 清掉 current task、active project、workspace docs、theme tools 等单聊上下文，并按 group settings 暴露 cards/images/MCP。

## 群里的记忆

协作者在群里仍是自己，所以 room 不会替换个人记忆。当前实现点：

- `groupMemoryRecallEnabled()` 能让某个 group 关闭 member memory recall，但不删除个人记忆。
- `buildGroupToolPreferences()` 在允许时保留 personal memory 和 recall，同时让 group room 只启用当前房间需要的工具组。
- `useGroupWorldController()` 设置 `activeWorld: 'group'`，把 collection materials 收窄到 group lineage，关闭 theme tooling，清掉 task/project context。

## 私域与公开产物

每个协作者可以有 private lane：用户能进入成员 lane，看 process context，和一个成员单独说话，而不是自动广播到群里。

当前实现：

- `laneWhisperEntries()` 从 `conversation.group.privateLanes` 读取成员私域条目。
- `buildLaneDigestMessage()` 让这些条目在稍后的 group turn 中可见。
- `buildGroupLaneTimeline()` 合并 private whispers 和该成员 public-process evidence：public excerpt、thinking text、code blocks、memory recall evidence、tool events。
- `groupCards`、`groupArtifacts`、`groupImages` 在 `useGroupWorldController()` 收集 room-lineage outputs，并保留 owner name。

## 设计总结

记忆是分层 context compiler，群聊是带 per-member request shaping 的房间面。共同结构很直接：事实来源有名字，模型上下文可检查，群里的协作者不是一次性 bot instance。
