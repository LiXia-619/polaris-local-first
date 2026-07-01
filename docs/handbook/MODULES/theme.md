# Theme

The theme system lets the assistant and user preview, refine, apply, save, and roll back visual
skins without letting theme logic take over layout geometry.

## Purpose

Theme owns look: colors, materials, texture, selector targets, generated CSS patches, preset
skins, and preview transactions.

## Boundaries

Theme owns:

- Theme presets and selector/surface catalogs.
- Coordinate-based theme generation.
- Theme tool preview metadata.
- Preview/apply/rollback transactions.
- Theme file export and render inspection support.

Theme does not own:

- Viewport height, keyboard geometry, shell positioning, or layout ownership.
- Chat, collection, persona, or runtime durable facts except through theme state.
- Tool visibility decisions outside the normal tool protocol.

## Source Map

```txt
src/config/theme/
src/engines/theme-coordinate/
src/app/theme/
src/stores/spaceStoreThemePersistence.ts
src/stores/spaceStorePreviewState.ts
src/stores/spaceStoreSkinActions.ts
src/engines/toolExecutorDescribeThemeCss.ts
src/ui/theme-tool-mode/
```

## Data Flow

Assistant-driven theme preview:

```txt
ToolAction -> describeThemeCssToolAction metadata -> theme preview transaction
-> visible theme state -> apply or rollback
```

Preset/user theme state:

```txt
space store theme state -> LocalData space rows -> hydration/export/import
```

## Public Usage

- Use `src/config/theme/themeSelectorCatalog.ts` to map stable selectors and aliases.
- Use `src/config/theme/themeSurfaceRegistry.ts` for theme surface identities.
- Use `src/engines/theme-coordinate/` for generated coordinate skins.
- Use `src/app/theme/themePreviewTransaction.ts` for preview transaction behavior.

## Extension Rules

- A new visual target needs a selector/surface catalog entry and focused tests.
- A new generated behavior belongs in `src/engines/theme-coordinate/`, not in UI.
- A new preview action must preserve `themeScope`, `themeSurfaceIds`, `themeSurfaceLabels`,
  `themePatchMode`, and transaction reason metadata where relevant.
- Theme must not fix layout by writing geometry ownership into CSS.

## Verification

```bash
npm run typecheck
npm test -- src/engines/toolExecutorDescribe.test.ts src/engines/request/requestContextMessages.test.ts src/engines/themeToolState.test.ts src/stores/spaceStoreThemePersistence.test.ts src/stores/spaceStoreSkinActions.test.ts
npm test
npm run build
```
