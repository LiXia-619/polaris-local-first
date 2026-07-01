# Module Guide

This guide records the intended ownership of major Polaris modules. It is a design map, not a claim that every file already perfectly matches the target.

When refactoring, preserve the responsibility boundary and keep each module's ownership easy to explain.

## App Shell

**Purpose:** provide the frame where product worlds appear.

**Owns:** first paint, hydration lifecycle coordination, navigation, global menu/sheet entrypoints, app-level status surfaces.

**Does not own:** chat semantics, provider request construction, LocalData migration rules, collection storage.

**Main paths:** `src/ui/AppShell.tsx`, `src/app/shell/`, `src/ui/app-shell/`.

## Layout Surfaces

**Purpose:** decide whether the shared runtime is arranged as phone, tablet, or desktop.

**Owns:** layout surface resolution, sidebar eligibility, desktop-sidebar auto-collapse, explicit layout bootstrap facts.

**Does not own:** iOS/Android bridge permissions, desktop-host permissions, release-channel status, chat or collection semantics, viewport/keyboard geometry outside the layout contract.

**Main paths:** `src/app/shell/appLayoutSurface.ts`, `src/ui/app-shell/useAppLayoutSurface.ts`, `src/app/bootstrap/appLayoutSurfaceBootstrap.ts`, `docs/layout-contract.md`.

## Chat

**Purpose:** run conversation workflows with collaborators, models, context, and tools.

**Owns:** submit, stop, retry, edit, fork, message timeline state, request lifecycle, tool invocation lifecycle, memory/context use.

**Does not own:** durable row schemas, provider credential policy, collection project storage, native platform behavior.

**Main paths:** `src/ui/worlds/ChatWorld.tsx`, `src/app/chat/`, `src/engines/chat-api/`.

**Related intent note:** [Memory and group chat intent](memory-and-group-chat-intent.md) explains how request memory lanes and group-room request shaping extend the chat runtime without turning memory into a single history blob.

## Collection

**Purpose:** preserve useful outputs and project materials outside the linear chat turn.

**Owns:** cards, saved materials, image/file shelves, room projects, workspace files, collection filtering, collection import/export surfaces.

**Does not own:** chat turn lifecycle, provider request assembly, LocalData backend selection.

**Main paths:** `src/ui/worlds/CollectionWorld.tsx`, `src/app/collection/`, `src/ui/collection/`.

## Persona

**Purpose:** define collaborator identity, behavior settings, and long-lived reference heads.

**Owns:** persona directory, persona settings, persona builder, reference document ownership at the product level.

**Does not own:** document body storage internals, provider credentials, global request transport.

**Main paths:** `src/app/persona/`, `src/config/persona/personaBuilder.ts`, persona-related store code.

**Related intent note:** [Memory and group chat intent](memory-and-group-chat-intent.md) explains how collaborator identity and memory remain personal while a collaborator participates in a shared group room.

## Runtime And Provider

**Purpose:** decide how model requests are configured and transported.

**Owns:** provider profiles, model capability, request capability, direct provider calls, relay routing, native HTTP transport choices.

**Does not own:** UI persistence, official server defaults, chat message mutation.

**Main paths:** `src/engines/provider-runtime/`, `src/engines/request/`, `src/engines/chat-api/`, provider settings UI.

## Tool Protocol

**Purpose:** make model-visible tools reliable across prompt, parser, executor, UI evidence, and next-turn replay.

**Owns:** schemas, prompt catalog visibility, parser/canonicalizer behavior, execution result semantics, replay projection.

**Does not own:** feature-specific layout, unrelated provider limits, hidden side effects.

**Main paths:** `src/engines/tool-protocol/`, tool executors, tool UI surfaces.

## LocalData Repository

**Purpose:** be the durable facts contract for app data.

**Owns:** row states, domain ownership, commit validation, import/promotion invariants, backend abstraction.

**Does not own:** UI presentation, provider networking, undocumented storage behavior.

**Main paths:** `src/engines/localData/`, domain row writers, data-boundary tests.

## Import And Export

**Purpose:** move user-controlled packages into and out of the current data model through explicit, validated boundaries.

**Owns:** package import, package export, import diagnostics, migration checks, data validation, rollback safety.

**Does not own:** ordinary startup truth, ordinary save paths, placeholder replacement data, old-user in-place upgrade promises.

**Main paths:** import/export modules in stores and migration modules in LocalData code.

## Assets And Documents

**Purpose:** keep binary and document truth separate from UI previews.

**Owns:** asset rows, blob cache, document bodies, missing-body semantics, import/export evidence.

**Does not own:** chat conversation ownership, persona head ownership, provider transport.

**Main paths:** asset/document engines, `src/infrastructure/assetStore.ts`, collection asset code.

## Server And Selfhost

**Purpose:** provide optional deployer-owned API and relay capability.

**Owns:** provider relay endpoints, concrete serverless handlers in `api/`, Worker gateway example, shared relay-target validators, origin policy, diagnostics receiver, search helper.

**Does not own:** required default service assumptions, deployer credential policy.

**Main paths:** `api/`, `server/`, `workers/polaris-api/`, `src/engines/server/`.

**Current status:** `server/` is a shared-validator/source area, not proof that a full standalone Node selfhost app is present. Treat `api/` and `workers/polaris-api/` as the concrete public backend surfaces currently documented.

## Native Bridges

**Purpose:** expose platform capabilities to the shared runtime.

**Owns:** SQLite plugin, file picker, native HTTP, notifications, WebView shell integration.

**Does not own:** shared product semantics, duplicated chat or collection behavior, phone/tablet/desktop layout selection.

**Main paths:** `ios/`, `android/`, `src/native/`.

## Desktop And Companion

**Purpose:** expose user-owned local privileges and optional companion connectivity.

**Owns:** desktop workspace sync, companion relay connection, local privileged actions.

**Does not own:** official public server dependency, cloud account identity, unrelated model behavior, desktop layout selection by itself.

**Main paths:** `src/desktop/`, `src/app/desktop/`, `src/app/companion/`, `src/ui/companion/`.
