# Getting Started

This page covers local development for the source tree. It does not imply that this checkout
is the live web selfhost source, Android release source, iOS/TestFlight release source, Mac desktop
package source, or App Store review source.

## Install

```bash
npm i
```

## Run The Web App

```bash
npm run dev
```

The Vite dev server serves the shared frontend. It does not start a backend by itself. For
split-origin backend development, copy `.env.example` to `.env.local` and set
`VITE_POLARIS_API_ORIGIN` to a deployer-owned API origin.

## Build

```bash
npm run build
```

This runs TypeScript project build and the Vite production build.

## Core Verification

Use these commands before treating a source change as done:

```bash
npm run typecheck
npm test
npm run build
```

For data-boundary work, also run:

```bash
npm run test:data-boundary
```

For a broad release-style source check:

```bash
npm run verify
```

`npm run verify` includes extra typechecks, worker typecheck, full tests, and a production build.
It may do more work than a small documentation or pure UI pass needs, but it is the correct gate
before a publication or release claim.

## Native Wrappers

The native wrappers consume the same shared frontend:

```bash
npm run android:sync
npm run ios:sync
```

Build commands are available for Android debug/release and iOS simulator/device targets. Native
build success is a channel-specific proof; it is separate from source-level TypeScript and web
build success.

## Desktop Host Preview

```bash
npm run desktop:dev
npm run desktop:preview
```

These commands exercise desktop host-capability work. Web, iOS, and Android
surfaces should keep using their own platform bridges instead of pretending to
have desktop file or terminal access.

## Where To Start Reading

- Product structure: [Architecture](ARCHITECTURE.md)
- Data model: [Data And Storage](DATA_AND_STORAGE.md)
- Module ownership: [Module notes](README.md#module-notes)
- Backend/selfhost setup: [../connect-your-own-backend.md](../connect-your-own-backend.md)

## Data Rule

Use `.env.example` for configuration shape and synthetic fixtures for
reproduction cases.
