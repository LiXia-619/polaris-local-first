# Product Intent

Polaris is a local-first AI workspace for sustained work with models, collaborators, saved materials, tools, and personal project context.

It creates an environment where a model can use real local context, real user-owned state, explicit tools, and stable collaborator identity.

## Core Design Philosophy

Polaris is built around AI intuition. The app arranges the surrounding environment so the model can understand where it is, who is present, what materials exist, what tools can act, and which facts are stable enough to rely on.

The product gives model judgment a clear place to stand.

## Core Product Goal

Polaris should help a user keep continuity across long work:

- conversations and collaborator state survive restarts
- saved cards, assets, notes, and project materials stay attached to the work they came from
- provider and relay choices stay explicit
- memory, summaries, raw recent wording, documents, tools, and room events keep separate authority labels
- existing local data enters through explicit import and migration paths
- the model receives clear context and tool results instead of vague UI-only signals

The application gives the model a stable working environment for long-running work.

## Design Principles

### Shape the environment around model intuition

The model should see a coherent scene. Context, tools, collaborators, room state, project materials, and recent events should be arranged in a way that makes the right action feel natural.

### Context is terrain, not prompt padding

Request context should be assembled by responsibility. Confirmed memory, semantic recall, summaries, raw conversation tail, tool results, reference documents, and room events keep distinct roles and authority labels.

### Durable facts support the scene

Durable facts should have one clear owner. UI stores cache and present facts through documented data owners.

### User-owned infrastructure

Public builds use explicit backend configuration. Backend routes are optional capability surfaces that deployers can self-host or replace.

### Tools are real contracts

A model-visible tool is only complete when the model can see it, call it, receive a meaningful result, the user can inspect what happened, and the next request can replay the important evidence.

### Existing data enters through import

Existing local data matters. It should enter the clean system through explicit import and migration boundaries, then become normal current data once validated.

### Native shells expose platform capability

iOS, Android, web, and desktop host surfaces should share product behavior through the shared runtime. Native and host code should expose platform capabilities such as files, SQLite, HTTP, notifications, and WebView integration.

## Engineering Boundaries

Docs should keep release facts separate:

- source is buildable
- tests pass
- migration is safe
- a channel has shipped
- the repository is licensed as open source

Those are different facts. They should not be flattened into one status claim.

## Product Scope

Polaris provides a local-first workspace, explicit provider/backend configuration, visible tool evidence, import/export paths, and shared runtime behavior across web and native shells.

## Documentation Goal

The docs explain why the code is organized around explicit data ownership, explicit backend ownership, and explicit module responsibilities. Code and docs stay consistent — divergence is fixed in the same development slice.
