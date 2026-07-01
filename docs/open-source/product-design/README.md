# Product Design Notes

Polaris is organized around product surfaces that make an AI collaborator's
working environment legible. These notes describe the design intent for each
surface and point to the implementation that carries the intent.

## Product Surfaces

- [Design philosophy](design-philosophy.md): the environment-first product
  model that guides the rest of the system.
- [Context governance intent](context-governance-intent.md): how request context
  is assembled as named terrain.
- [Theme system intent](theme-system-intent.md): stable and creative skinning as
  two levels of AI-assisted visual change.
- [Collaborator environment intent](collaborator-environment-intent.md):
  collaborators as long-lived identities with memory, settings, tools, and room
  behavior.
- [Memory intent](memory-intent.md): durable recall as layered continuity.
- [Group chat intent](group-chat-intent.md): multi-collaborator rooms as shared
  working scenes.
- [Tool contract intent](tool-contract-intent.md): model-visible actions as
  inspectable contracts.
- [MCP integration intent](mcp-integration-intent.md): external tool servers as
  user-configured capabilities.
- [Cards intent](cards-intent.md): saved model outputs as durable objects.
- [Workspace intent](workspace-intent.md): project materials as editable working
  areas.
- [Sandbox runtime intent](sandbox-runtime-intent.md): previews and runtime
  checks for generated code.
- [Collection world intent](collection-world-intent.md): saved materials outside
  the linear chat.
- [Provider and backend intent](provider-and-backend-intent.md): model access and
  optional backend surfaces.
- [LocalData import/export intent](localdata-import-export-intent.md): backup,
  restore, and current storage facts.
- [Cross-platform shell intent](cross-platform-shell-intent.md): one shared
  runtime across web and native shells.
- [Attachments and assets intent](attachments-assets-intent.md): files and media
  as first-class materials.
- [Evidence and inspection intent](evidence-and-inspection-intent.md): visible
  proof for model actions, requests, and data health.

## Related Notes

- [Memory and group chat intent](../memory-and-group-chat-intent.md)
- [Module guide](../module-guide.md)
- [Architecture overview](../architecture-overview.md)
- [Data and storage intent](../data-and-storage-intent.md)

## Note Shape

Each product design note should answer the same questions:

- what product object the user and model are standing in;
- what design principle the object carries;
- which implementation paths prove the behavior exists;
- which adjacent responsibilities stay outside this surface.
