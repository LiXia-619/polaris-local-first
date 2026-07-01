# 文档政策

这份政策说明文档层应该如何描述 Polaris 当前形态。

## 文档内容

- 当前产品意图。
- 当前架构形状。
- 模块责任和不能负责的边界。
- 数据所有权和存储来源。
- 后端、自托管、原生桥、工具协议说明。
- 发布 gate、验证命令、pass/fail 状态。
- release-channel 分层。

## 证据写法

如果某个结论来自本地检查，记录命令名、数量、invariant 名称和
pass/fail 状态。文档记录源码边界，不复述本机操作过程。

## 写法标准

公开文档要说当前事实，不要把未来计划写成已实现。需要区分：

- source state
- local build/test state
- publication hygiene state
- direct GitHub publication state
- Web selfhost state
- Android APK state
- iOS/TestFlight state
- App Store state

当代码移动责任边界、存储来源、工具合同、后端 route 或原生桥，同一轮更新公开文档。文档不是事后包装，它是架构边界的一部分。

## 中英文关系

英文文档是详细正本。中文对照提供当前公开形状的快速参照。较长的证明材料以英文为完整证据源，中文页给阅读路线和结论边界。
