# Layout Surfaces

## Purpose

Layout surfaces 决定共享 runtime 以 phone、tablet 还是 desktop 排布。它们是布局面，不是平台能力，也不是 release channel。

## Owns

- Layout surface resolution。
- Sidebar eligibility。
- Desktop-sidebar auto-collapse。
- Explicit layout bootstrap facts。

## Does Not Own

- iOS/Android bridge permissions。
- Desktop-host permissions。
- Release-channel status。
- Chat 或 collection semantics。
- Layout contract 外的 viewport/keyboard geometry。

## Main Entrypoints

- `src/app/shell/appLayoutSurface.ts`
- `src/ui/app-shell/useAppLayoutSurface.ts`
- `src/app/bootstrap/appLayoutSurfaceBootstrap.ts`
- `docs/layout-contract.md`

## Boundary

`phone/tablet/desktop` 是布局面；`web/iOS/Android/desktop host` 是运行平台；Web selfhost/Android APK/iOS TestFlight 是发布渠道。不要把这三条轴混成“平台版逻辑”。
