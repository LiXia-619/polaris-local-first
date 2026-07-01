# 后端与自托管意图

Polaris 使用明确的后端所有权。后端 route 是可选能力面：部署者可以使用 same-origin API、自己的 relay，或禁用相关能力。

## 目标

- 本地开发使用明确配置的 API origin 或 same-origin API route。
- 公开 fork 可以部署自己的 `/api/...` route。
- Relay、search、diagnostics 等后端能力必须说明已实现什么、还缺什么。
- 文档不能暗示未实现 handler 已经可用。

## 当前形态

- `api/`：当前公开源码里具体的 serverless handler surface。
- `workers/polaris-api/`：较小的 Cloudflare Worker gateway 形态。
- `server/`：当前保存 shared relay-target validators 等共享后端逻辑，不是完整 standalone Node selfhost app。
- `VITE_POLARIS_API_ORIGIN`：显式配置远端 API origin 的入口。
- same-origin `/api/...`：公开 selfhost 的优先默认路径。

## 验证重点

- API origin 配置明确。
- Web、Android、iOS 共享产品 runtime。
- 缺失的 route 以 planned/missing handler 状态呈现。

## 安全边界

文档记录 route 名、env var 名、部署形态和验证命令。

## 继续阅读

- [Connect your own backend](../../connect-your-own-backend.md)
- [Architecture overview](architecture-overview.md)
- [Open-source principles](open-source-principles.md)
