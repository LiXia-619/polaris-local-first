# Collection

## Purpose

Collection preserves useful outputs and project materials outside the linear chat turn.

## Owns

- Cards, image cards, files, projects, and room/workspace materials.
- Collection filtering, selection, project navigation, and workspace editing.
- Collection import/export participation and saved-artifact presentation.

## Does Not Own

- Chat turn lifecycle.
- Provider request assembly.
- LocalData backend selection.
- Desktop privilege policy.

## Main Entrypoints

- `src/ui/worlds/CollectionWorld.tsx`
- `src/ui/collection/`
- `src/app/collection/`
- `src/stores/collectionStore.ts`
- `src/stores/collectionLocalDataPersistence.ts`

## Data It Reads

- Collection LocalData rows for cards, image cards, projects, files, and workspace references.
- Asset metadata and blob-cache availability for media surfaces.
- Chat references when a saved item opens back into conversation context.

## Data It Writes

- Collection object rows.
- Project/file mutation rows.
- Collection projections in `collectionStore`.
- Asset references when collection items point to binary or preview data.

## Important Failure States

- Saved object metadata exists but its referenced asset or document body is missing.
- Project/file mutation cannot be committed.
- Imported collection data has owner or body gaps.
- Desktop sync is unavailable even though the collection item itself is valid.

## Tests And Verification

- `npm run test:data-boundary`
- `src/stores/collectionStore.test.ts`
- `src/stores/collectionLegacyRecoveryTransaction.test.ts`
- Collection LocalData row tests under `src/engines/localData/`.

## Known Cleanup Still Owed

- `src/app/collection/useCodeCollectionWorkspaceController.ts` mixes workspace selection, project/file mutation, chat bridge, desktop sync, command-session control, and workshop UI state. Split it by those responsibilities before adding more collection workspace behavior.
