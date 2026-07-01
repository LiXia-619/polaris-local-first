# Server And Selfhost

## Purpose

Server/selfhost 提供可选、部署者拥有的 API 和 relay 能力。

## Owns

- Provider relay endpoints。
- `api/` 中的 serverless handlers。
- `workers/polaris-api/` Worker gateway example。
- Shared relay-target validators。
- Origin policy。
- Diagnostics receiver。
- Search helper。

## Does Not Own

- 本地/公开使用必须依赖的默认 Polaris 服务。
- 默认服务假设。
- Shared product semantics。

## Main Entrypoints

- `api/`
- `server/`
- `workers/polaris-api/`
- `src/engines/server/`

## Current Status

`server/` 当前是 shared-validator/source area，不是完整 standalone Node selfhost app。公开 concrete backend surfaces 是 `api/` 和 `workers/polaris-api/`。

## Public Rule

部署可以使用 same-origin API route，或显式配置 `VITE_POLARIS_API_ORIGIN` 到自己拥有的后端。
