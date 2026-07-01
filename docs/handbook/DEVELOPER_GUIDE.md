# Developer Guide

This guide answers "where should this change go?" for common Polaris work.

## Add Product Copy Or Knowledge

- Product documentation content: `src/app/shell/productKnowledge/`.
- Product docs registry/API: `src/app/shell/productDocs.ts`.
- Module docs: `docs/handbook/MODULES/`.

Do not put long prose catalogs back into orchestration files.

## Add Static Config

Use the responsible subfolder:

```txt
src/config/persona/
src/config/theme/
src/config/prompts/
src/config/catalog/
```

Leave config root only for genuinely cross-cutting config. There is no broad config barrel; import
by the specific path so ownership stays visible.

## Add A Tool

Close the full loop:

1. Tool schema and prompt visibility.
2. Parser/canonicalizer/action type.
3. Describer and preview metadata if needed.
4. Executor or direct action runner.
5. UI evidence in tool events.
6. Request-context replay projection.
7. Focused tests.
8. Module documentation.

If the new tool is just another action description, add it to the correct
`toolExecutorDescribe<Domain>.ts` module and keep `toolExecutorDescribe.ts` as the dispatcher.

## Add Or Change Persistence

Find the domain folder first:

```txt
src/stores/chat/
src/stores/collection/
src/stores/persona/
src/stores/runtime/
src/stores/space/
src/stores/asset/
src/stores/document/
```

Use a domain facade for store-facing reads/writes, a row engine for LocalData rows, and a
`migrationPlanner.ts` only for explicit staging/migration paths.

Do not add downstream defensive checks until you trace where the value is produced and which
trust boundary already validated it.

## Add UI

Use `src/app/` for controllers, orchestration, effects, and product workflow state. Use `src/ui/`
for React presentation and interaction components.

Do not put source-of-truth decisions in UI components. Do not put layout or visual styling into
store and engine files.

## Add Theme Behavior

- Static theme catalogs and selectors: `src/config/theme/`.
- Theme math and CSS generation: `src/engines/theme-coordinate/`.
- Theme sessions and preview transactions: `src/app/theme/`.
- Theme persistence/state: `src/stores/space*`.
- Theme UI: `src/ui/theme-tool-mode/`, `src/ui/shell/`, and related world components.

Theme may change look. It must not take ownership of viewport, keyboard, or shell geometry.

## Add Native Capability

Native capabilities live behind `src/native/`, `ios/`, or `android/`. Keep product semantics in
shared `src/` code and expose only the capability boundary through native code.

## Verification By Change Type

| Change | Minimum gate |
|---|---|
| Docs only | Spell/read pass plus `git diff --check`. |
| Type-only | `npm run typecheck`, `npm test`. |
| Engines or stores | `npm run typecheck`, focused tests, `npm test`. |
| LocalData/storage/import | `npm run typecheck`, `npm run test:data-boundary`, `npm test`, `npm run build`. |
| Theme/tool protocol | `npm run typecheck`, focused theme/tool tests, `npm test`, `npm run build`. |
| UI/CSS | `npm run typecheck`, relevant tests if logic changed, browser or screenshot check when visual behavior changed. |
| Release/publication | `npm run verify`, plus channel-specific proof. |

Every completed round should leave a clean git commit.
