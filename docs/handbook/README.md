# Polaris Handbook

This handbook is the current-source guide for Polaris. It explains the codebase as it is
meant to be maintained: by responsibility, owner boundary, data flow, and verification gate.

Use `docs/open-source/` for public-facing design documentation. Use this handbook when changing the
repository.

## Reading Order

1. [Architecture](ARCHITECTURE.md) — the layer map, dependency direction, and major ownership
   boundaries.
2. [Getting Started](GETTING_STARTED.md) — install, run, test, and build commands.
3. [Data And Storage](DATA_AND_STORAGE.md) — LocalData, domain rows, source-of-truth rules, import
   boundaries, and backend shape.
4. [Types And Contracts](TYPES_AND_CONTRACTS.md) — the domain type barrel and subsystem type
   ownership.
5. [Developer Guide](DEVELOPER_GUIDE.md) — where to add common changes and which gates to run.
6. [Publication Gate](PUBLICATION_GATE.md) — checks before any public archive or release claim.
7. [FAQ](FAQ.md) — short answers to common contributor questions.

## Module Notes

Each module note is a design-and-usage page, not a file dump. Read it for what the module owns,
what it must not own, and how to extend it.

- [Assets](MODULES/assets.md)
- [Chat](MODULES/chat.md)
- [Collection](MODULES/collection.md)
- [Config](MODULES/config.md)
- [Documents](MODULES/documents.md)
- [Import And Export](MODULES/import-export.md)
- [LocalData](MODULES/local-data.md)
- [LocalData Health](MODULES/local-data-health.md)
- [MCP Runtime](MODULES/mcp-runtime.md)
- [Native Bridges](MODULES/native-bridges.md)
- [Persona](MODULES/persona.md)
- [Product Knowledge](MODULES/product-knowledge.md)
- [Runtime](MODULES/runtime.md)
- [Space](MODULES/space.md)
- [Theme](MODULES/theme.md)
- [Tools](MODULES/tools.md)

## Handbook Scope

- Current architecture and module ownership.
- How to add or modify a feature without crossing boundaries.
- Verification commands and expected proof.
- Current implementation facts.

## Maintenance Rule

When a refactor lands, update the module note in the same commit or the next documentation-only
commit. A module is documented when a new reader can tell its purpose, boundaries, source map,
extension rules, and verification gate from the checked-in docs.
