# Types And Contracts

`src/types/domain.ts` is the public type barrel for shared product domain types. It is intentionally
small and re-exports subsystem files under `src/types/domain/`.

## Layout

```txt
src/types/domain.ts
src/types/domain/
  primitives.ts
  theme.ts
  collection.ts
  tools.ts
  chat.ts
  companion.ts
  persona.ts
  runtime.ts
```

External import sites may continue importing from `src/types/domain`. The barrel keeps churn out of
the rest of the tree while the type ownership is readable.

## Ownership

| File | Owns |
|---|---|
| `primitives.ts` | Shared small primitives that are not owned by one feature. |
| `theme.ts` | Theme state, theme transactions, skin, preview, and surface-related types. |
| `collection.ts` | Cards, projects, project files, workspace docs, collection frontstage facts. |
| `tools.ts` | Tool invocation and tool-evidence domain types. |
| `chat.ts` | Conversation, messages, tasks, groups, chat workflow facts. |
| `companion.ts` | Companion connection and host state contracts. |
| `persona.ts` | Persona/collaborator identity, memory heads, settings. |
| `runtime.ts` | Providers, MCP, model capability, voice/image/search/runtime settings. |

## Extension Rules

- Add a type to the file that owns the product concept.
- Re-export through `src/types/domain.ts` only if other modules need the shared type.
- Do not add persistence behavior, validation logic, or defaulting functions here.
- Do not create duplicate types in UI or app code to avoid importing the shared contract.

## Verification

Type-only changes should run:

```bash
npm run typecheck
npm test
```

If a type change alters tool protocol, LocalData rows, import/export package shape, or request
context replay, run the focused tests for that subsystem too.
