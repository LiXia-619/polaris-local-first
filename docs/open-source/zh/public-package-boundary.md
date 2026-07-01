# 源码包边界

源码包边界用于回答：GitHub 仓库和 archive 的内容由哪些材料组成。

## 包内容

- 源码和测试
- 配置模板
- 模块设计说明、架构说明、发布 gate
- 命令名、pass/fail 状态、聚合数量
- 实现路径和责任边界

## 当前策略

直接公开 GitHub 时，第一边界是 tracked 文件本身；archive 检查只作为第二层校验。

`npm run publication:hygiene` 会检查：

- tracked sensitive/generated path pattern
- 常见凭证模式
- repository-root Markdown allowlist

它通过后，还要跑工程 gate 和 Worker audit。
