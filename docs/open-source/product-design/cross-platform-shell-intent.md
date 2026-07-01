# Cross-Platform Shell Intent

The Polaris shell lets the same workspace runtime operate across web, native,
and desktop-capable hosts. The shell owns layout surfaces, navigation, platform
capability bootstrap, native bridge wiring, and top-level app frame behavior.

The product goal is one product with host-aware capability edges. Chat,
collection, collaborators, tools, memory, and LocalData keep the same product
meaning while the shell exposes the capabilities available on the current host.

## Product Principles

### One shared runtime owns product behavior

The main React runtime and app shell host the same worlds across platforms.
Platform detection changes capabilities and layout, while product semantics stay
in shared source.

Implementation evidence:

- `src/main.tsx`
- `src/ui/AppShell.tsx`
- `src/ui/app-shell/AppShellView.tsx`
- `src/ui/app-shell/useAppShellController.ts`
- `src/app/shell/buildAppShellProps.ts`

### Layout is a shell responsibility

The shell owns world frames, top bars, sidebar/mobile frames, frontstage
navigation, app layout surface state, and platform-aware viewport behavior.

Implementation evidence:

- `src/app/shell/appLayoutSurface.ts`
- `src/ui/app-shell/useAppLayoutSurface.ts`
- `src/ui/app-shell/WorldFrameBoundary.tsx`
- `src/ui/app-shell/DesktopAppShellFrame.tsx`
- `src/ui/app-shell/MobileAppShellFrame.tsx`

### Native bridges expose host capabilities

Native code and bootstrap modules expose SQLite, file picking, backup files,
photo album access, push registration, and native shell facts to the shared
runtime.

Implementation evidence:

- `src/app/bootstrap/nativeShellBootstrap.ts`
- `src/native/localDataSqlite.ts`
- `src/native/systemPickedFiles.ts`
- `src/native/systemBackupFiles.ts`
- `src/native/photoAlbum.ts`
- `ios/`
- `android/`

## Adjacent Responsibilities

- Feature worlds own chat, collection, group, and collaborator behavior.
- LocalData owns durable storage semantics after a native backend is available.
- Provider and backend surfaces own model transport.
- Desktop companion owns desktop-local privileges when the desktop host exposes
  them.
