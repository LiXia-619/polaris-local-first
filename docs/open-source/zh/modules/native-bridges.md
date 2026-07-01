# Native Bridges

## Purpose

Native bridges 把平台能力暴露给共享 runtime。它们不复制产品语义。

## Owns

- SQLite plugin。
- File picker。
- Native HTTP。
- Notifications。
- WebView shell integration。
- 平台能力入口和权限事实。

## Does Not Own

- Shared product semantics。
- Duplicated chat 或 collection behavior。
- Phone/tablet/desktop layout selection。
- Release-channel status 本身。

## Main Entrypoints

- `ios/`
- `android/`
- `src/native/`

## Rule

只有真实手机/平台能力才进 native bridge。聊天、换肤、工具执行、请求组装、collection 语义等共享产品行为优先在 `src/` 修。原生壳暴露能力，产品语义回到共享 runtime。

## Current Storage Note

Native iOS/Android 当前安装 SQLite LocalData backend。实体设备/渠道发布状态仍要按 release gate 单独报告，不能用 source proof 代替 channel proof。
