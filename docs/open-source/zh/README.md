# Polaris 公开文档

Polaris 源码许可证为 `AGPL-3.0-only`。各发布渠道（Source、Web selfhost、Android APK、iOS/TestFlight、App Store）状态独立。

## 先读这些

- [产品意图](product-intent.md)
- [开源原则](open-source-principles.md)
- [架构概览](architecture-overview.md)
- [模块指南](module-guide.md)
- [记忆与群聊意图实现对照](memory-and-group-chat-intent.md)
- [数据与存储意图](data-and-storage-intent.md)
- [后端与自托管意图](backend-and-selfhost-intent.md)
- [公开包边界](public-package-boundary.md)
- [发布检查清单](publication-checklist.md)
- [文档政策](documentation-policy.md)
- [模块设计模板](module-design-template.md)
- [审计与证明阅读路线](audits-and-proofs.md)

## 模块对照

- [模块设计说明索引](modules/README.md)
- [Chat](modules/chat.md)
- [Collection](modules/collection.md)
- [Persona](modules/persona.md)
- [Runtime and provider](modules/runtime-provider.md)
- [Tools](modules/tools.md)
- [LocalData](modules/local-data.md)
- [Import and export](modules/import-export.md)
- [Layout surfaces](modules/layout-surfaces.md)
- [Native bridges](modules/native-bridges.md)
- [Server and selfhost](modules/server-selfhost.md)
- [Desktop and companion](modules/desktop-companion.md)

## 英文正本

中文对照不替代英文正本。需要完整逐项证据时，回到英文文档：

- [English public docs](../README.md)
- [Native SQLite runtime proof](../native-sqlite-runtime-proof.md)
- [Data source decisions](../data-source-decisions.md)

## 公开范围

中文文档覆盖以下内容：

- 产品意图和架构决策
- 模块所有权和责任边界
- 命令名、pass/fail 状态、聚合数量和 invariant 名称
- source readiness、publication gate 和 release-channel 状态
