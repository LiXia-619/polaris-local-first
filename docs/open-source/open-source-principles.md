# Open-Source Principles

Polaris source code is licensed under AGPL-3.0-only. These principles define
the project's stance on documentation, data ownership, and release boundaries.

## Principle 1: Describe The Current Product

Docs should explain the current architecture, product intent, and verification
gates.

The docs cover what Polaris is and which verification gates apply to each
release channel.

## Principle 2: Source Readiness Is Not Release Readiness

A green source checkout does not mean Web selfhost, Android APK, iOS/TestFlight,
or App Store distribution has shipped. Public status must keep these channels
separate.

Use these labels when reporting readiness:

- Source
- Web selfhost
- Android APK
- iOS/TestFlight
- App Store

## Principle 3: Source Tree As Product Explanation

The repository should describe product facts, command names, pass/fail status,
aggregate counts, module names, boundary names, design decisions, and templates.

The publication gate keeps the tree focused on source, docs, tests, templates,
and verification evidence.

## Principle 4: Local-First Must Be Real

Polaris should run without a Polaris-owned server. A deployer may connect their
own backend, but ordinary local development should not require an official
service.

Backend docs should explain the shape of self-hosting, what is implemented, and
what remains planned. They must not imply that unavailable relay handlers are
ready.

## Principle 5: Data Ownership Must Be Explicit

Durable facts belong in the LocalData layer. Runtime and UI stores are
projections, not hidden second databases.

Current data should have one ordinary read/write source. Existing package data may
enter through explicit import, migration, and diagnostics boundaries.
Those boundaries should be named as boundaries, not mixed into normal startup
or ordinary save paths.

## Principle 6: SQLite Is A Substrate, Not A Story

SQLite readiness should be described only as far as it is proven. If a platform
uses SQLite as the installed LocalData backend, say so. If a platform still uses
the KV backend, say so. Do not describe the whole project as SQLite-first until
the default product path and platform proof are complete.

## Principle 7: Compatibility Stays At Explicit Boundaries

Old storage formats stay in explicit import, migration, validation, and
diagnostics boundaries. Normal product architecture uses current data models,
and new-user ordinary writes use current paths.

When a boundary no longer protects supported package import, migration
validation, or diagnostics, remove the retired branch.

## Principle 8: Modules Should Explain Their Intent

Each major product area should have a public design note that explains:

- what the module owns
- what it depends on
- what it must not own
- where its durable facts live
- which boundary tests or manual gates protect it

This keeps the project self-documenting.

## Principle 9: Docs And Source Move Together

When a change moves a responsibility boundary, storage source, backend route,
native bridge, tool contract, or publication gate, update the public docs in the
same work round.

Docs should not trail the code as an afterthought, and they should not promise a
future shape that the source does not yet implement.

## Principle 10: License Choice Is Not Publication

License choice applies to the source. Each release channel (Web selfhost,
Android APK, iOS/TestFlight, App Store) has its own verification gate.

Pre-release checklist:

- run `npm run publication:gate`
- confirm release-channel status separately
- confirm the distribution tree is generated from tracked source
