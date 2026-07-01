# 发布检查清单

这份清单用于未来公开发布前检查。它不等于当前 release 状态。

## 1. 公开包检查

运行：

```bash
npm run publication:hygiene
```

检查 hygiene report 的所有 review 项。公开包应该聚焦在源码、公开文档、
模板、测试和验证证据上；direct repository publication 前要处理完
review 项。

hygiene 命令会检查文件类别、生成产物、repository-root Markdown allowlist、
source map，以及常见 token/secret 形态。

## 2. 工程 gate

至少运行：

```bash
npm run typecheck
npm test
```

如果改了数据边界，还要跑相关 focused tests，例如：

```bash
npm run test:data-boundary
```

## 3. 公开文档一致性

检查：

- `README.md` 是否和 `docs/open-source/` 一致
- `docs/open-source/open-source-principles.md` 是否仍反映当前 publication stance
- module notes 是否跟当前源码责任边界一致
- release-channel 状态有没有被混成一个“已发布”

## 4. 后端和自托管边界

确认：

- backend ownership 和 API origin 配置明确
- `VITE_POLARIS_API_ORIGIN` 和 same-origin `/api/...` 文档清楚
- 未实现 handler 没被写成 ready
- Worker/serverless route 说明只保留公开可复用的部署形态和验证信息

## 5. 数据安全和迁移

确认：

- ordinary startup 只读当前事实源
- legacy/import/recovery path 被命名为边界，不参与普通写入
- SQLite/KV 每个平台事实源说法准确
- export 读当前事实，不复活退休 store

## 6. 分渠道报告

公开前必须分开报告：

- Source
- Web selfhost
- Android APK
- iOS/TestFlight
- App Store

不要把 source green 说成所有渠道都已经发布。
