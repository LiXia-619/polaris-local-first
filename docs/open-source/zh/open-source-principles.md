# 开源原则

Polaris 源码许可证是 `AGPL-3.0-only`。这份原则定义项目在文档、数据所有权和发布边界上的立场。

## 1. 描述当前产品

文档应该解释当前架构、产品意图和已知发布 gate。

文档覆盖 Polaris 当前形态和每个发布渠道适用的验证 gate。

## 2. 源码就绪不等于渠道就绪

源码 checkout 变绿，不等于 Web selfhost、Android APK、iOS/TestFlight 或 App Store 已经发布。公开状态必须分渠道报告。

报告状态时使用这些标签：

- Source
- Web selfhost
- Android APK
- iOS/TestFlight
- App Store

## 3. 设计上公开

仓库可以包含验证证据：命令名、pass/fail 状态、聚合数量、模块名、边界名和设计决策。

publication gate 的目标是让源码树聚焦在源码、文档、模板、测试和验证证据上。

## 4. Local-first 必须是真的

Polaris 应该可以通过部署者拥有的后端运行。普通本地开发使用明确配置的 API origin 或 same-origin API route。

后端文档要讲清楚自托管形态、已经实现什么、还计划什么，不能暗示不存在的 relay handler 已经可用。

## 5. 数据所有权必须明确

持久事实属于 LocalData 层。Runtime 和 UI store 是投影，不是隐藏的第二数据库。

当前数据应该有一个普通读写源。旧 package 数据可以通过显式导入、迁移和诊断边界进入，但这些边界必须被命名为边界，不能混入普通启动或普通保存路径。

## 6. SQLite 是底座，不是故事

SQLite readiness 只能按已经证明的状态描述。某个平台用 SQLite 作为已安装 LocalData backend，就这么说；某个平台仍用 KV backend，也要这么说。不要在默认产品路径和平台 proof 完成前把整个项目描述成 SQLite-first。

## 7. 兼容层停在显式边界

旧存储格式停在显式导入、迁移、验证和诊断边界。普通产品架构使用当前数据模型，新用户普通写入使用当前路径。

当一个边界不再服务于支持的 package import、migration validation 或 diagnostics，就移除对应退休分支。

## 8. 模块应该解释自己的意图

每个主要产品区域都应该有公开设计说明，讲清：

- 它负责什么
- 它依赖什么
- 它不能负责什么
- 它的持久事实在哪里
- 哪些边界测试或人工 gate 保护它

## 9. 文档和源码一起动

当一个改动移动责任边界、存储来源、后端路由、原生桥、工具合同或发布 gate，同一轮就更新公开文档。

文档不能永远跟在代码后面补，也不能承诺源码还没有实现的未来形态。

## 10. 选许可证不等于发布

许可证适用于源码。每个发布渠道（Web selfhost、Android APK、iOS/TestFlight、App Store）有各自的验证 gate。

发布前：

- 跑 `npm run publication:gate`
- 分别确认 release-channel 状态
- 确认分发树来自 tracked source
