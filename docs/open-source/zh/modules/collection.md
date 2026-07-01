# Collection

## Purpose

Collection 在线性 chat turn 之外保存有用输出和项目材料。

## Owns

- Cards、image cards、files、projects、room/workspace materials。
- Collection filtering、selection、project navigation、workspace editing。
- Collection import/export participation 和 saved-artifact presentation。

## Does Not Own

- Chat turn lifecycle。
- Provider request assembly。
- LocalData backend selection。
- Desktop privilege policy。

## Main Entrypoints

- `src/ui/worlds/CollectionWorld.tsx`
- `src/ui/collection/`
- `src/app/collection/`
- `src/stores/collectionStore.ts`
- `src/stores/collectionLocalDataPersistence.ts`

## Data It Reads

- Cards、image cards、projects、files、workspace references 的 Collection LocalData rows。
- Media surfaces 需要的 asset metadata 和 blob-cache availability。
- Saved item 回到 conversation context 时读取 chat references。

## Data It Writes

- Collection object rows。
- Project/file mutation rows。
- `collectionStore` projections。
- Collection item 指向 binary/preview data 时写 asset references。

## Important Failure States

- Saved object metadata 存在，但 referenced asset 或 document body 缺失。
- Project/file mutation commit 失败。
- Imported collection data 有 owner 或 body gaps。
- Desktop sync 不可用，但 collection item 本身有效。

## Known Cleanup

- `src/app/collection/useCodeCollectionWorkspaceController.ts` 混合 workspace selection、project/file mutation、chat bridge、desktop sync、command-session control、workshop UI state。继续加行为前应按责任拆开。
