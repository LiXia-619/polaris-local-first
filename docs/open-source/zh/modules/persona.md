# Persona

## Purpose

Persona 定义协作者身份、行为设置，以及 chat/memory 功能使用的长期 reference heads。

## Owns

- Collaborator/persona directory。
- Persona settings 和 builder configuration。
- Persona reference documents 和 memory heads 的产品层所有权。
- Persona projection state for UI and chat selection。

## Does Not Own

- Document body storage internals。
- Provider credentials。
- Global request transport。
- Collection card storage。

## Main Entrypoints

- `src/app/persona/`
- `src/config/persona/personaBuilder.ts`
- `src/stores/personaStore.ts`
- `src/stores/personaLocalDataPersistence.ts`
- `src/stores/personaMemoryReferenceDocPersistence.ts`

## Data It Reads

- Persona LocalData rows。
- Persona memory/reference document rows。
- 选择 model-facing collaborator behavior 需要的 runtime settings。

## Data It Writes

- Persona directory rows。
- Persona settings projections。
- Reference document ownership links。
- Persona memory document references。

## Important Failure States

- 另一个 domain 仍引用某 persona id，但 persona row 缺失。
- Reference document metadata 存在，但 body 缺失。
- Imported memory documents 因 content incomplete 无法 promote。
- Historical persona lifecycle row 留在 live collaborator projection 外。

## Verification

- `npm run test:data-boundary`
- `src/stores/personaStoreHydrationPersistence.test.ts`
- `src/stores/personaMemoryReferenceDocPersistence.test.ts`
- `src/engines/localData/personaRows.test.ts`

## Known Cleanup

- Persona reference-document ownership 要继续保持显式，直到 document/body storage 边界完全收干净。

## Related

- [记忆与群聊意图实现对照](../memory-and-group-chat-intent.md)
