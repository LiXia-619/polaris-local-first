# Theme System Intent

The Polaris theme system lets the user and model change the workspace's visual
atmosphere while preserving product structure. The design has two levels:
stable skinning for coherent global changes, and creative skinning for higher
freedom when the user wants the model to explore.

## Product Intent

Theme is part of the AI environment. A collaborator can help shape the room's
visual feel, but visual freedom should still pass through visible preview,
apply, save, and rollback controls. The user should see what changed and keep
the ability to recover.

## Intent Belongs To The Model; Execution Belongs To The System

The model reads the user's language for emotion, material, atmosphere, and
degree of change. Polaris turns that model-shaped intent into stable execution:
coordinates, surface registry targets, CSS layers, and preview transactions.

The app does not compete with the model for interpretation. It gives the model
a clear output shape, applies that shape through known surfaces, and keeps the
result inspectable before it becomes the saved workspace look.

## Modes Are Isolated At Apply Time

Stable mode and creative mode use different prompts, actions, and execution
paths. A single theme apply belongs to one mode, so the model is never asked to
mix coordinate-driven skinning with direct CSS editing in the same operation.

The saved workspace look can still include layers from both modes over time:
stable presets, custom CSS, and generated CSS can coexist as runtime layers.
The separation is about execution ownership, not about forbidding a richer final
skin.

## Stable Mode

Stable mode asks the model to produce a coordinated global style that respects
known surfaces. It favors a complete, inspectable first version: background,
topbar, chat bubbles, composer, panels, collection cards, and card faces should
move together.

Implementation evidence:

- `src/ui/theme-tool-mode/themeToolModeGuidance.ts`
- `src/engines/theme-coordinate/`
- `src/config/theme/themeSelectorCatalog.ts`
- `src/config/theme/themeSurfaceRegistry.ts`
- `src/engines/theme-coordinate/themeCoordinateStableAction.ts`

## Creative Mode

Creative mode gives the model more room to write visual CSS. It is useful when
the user wants stronger atmosphere, more unusual surfaces, or a less predictable
skin. It still runs through the same product contract: preview first, then apply
or rollback.

Implementation evidence:

- `src/ui/theme-tool-mode/ThemeToolModeWarningDialog.tsx`
- `src/app/theme/themePreviewTransaction.ts`
- `src/app/chat/chatToolActionRunner.ts`
- `src/ui/worlds/chat/composer/ComposerPreviewStrip.tsx`

## Runtime Layers

Theme state is represented as preset CSS, custom CSS, generated CSS, CSS
variables, saved skins, and preview transactions. The UI applies these layers
through one DOM effect path so the app can keep visual state coherent.

Implementation evidence:

- `src/ui/useThemeDomEffects.ts`
- `src/ui/themeDomSteadyState.ts`
- `src/engines/themeCssRuntime.ts`
- `src/stores/spaceStoreThemePersistence.ts`
- `src/stores/spaceStorePreviewState.ts`
- `src/stores/spaceStoreSkinActions.ts`

## Adjacent Responsibilities

Theme owns look: color, material, texture, selector targets, CSS patches, preset
skins, and preview transactions. Layout geometry belongs to the shell and
layout contracts.

Related docs:

- `docs/handbook/MODULES/theme.md`
- `docs/layout-contract.md`
