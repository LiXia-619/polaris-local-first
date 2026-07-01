# Config

Static, build-time configuration and catalogs — no runtime state, no persistence. Previously 27
files sat flat in `src/config/`; they are now grouped by responsibility so the directory reads as a
map of what kinds of config exist.

## Layout

```
src/config/
  persona/   — the persona personality system: base catalog, builder, the canon (identity, motive,
               relationship, style, cognition, boundary), expansion, tags, prompt copy
  theme/     — the theme preset system: presets, catalog, shared/variables/stable-profiles,
               selector catalog, surface registry
  prompts/   — fixed prompt text: pharos prompt (+ loader), card-game prompts
  catalog/   — pick-list catalogs: avatar icons, provider catalog
  memoryReleaseGates.ts   — left at root (cross-cutting feature gate)
  touchpoints.ts          — left at root (cross-cutting i18n touchpoint map)
```

This was a pure relocation: files moved into subfolders, every importer's path was updated to the
new location (no shims), and `.test.ts` files moved with their source. **No config values or logic
changed** — only the directory shape. All intra-`config` imports happened to be within a single
group already, so no cross-group rewiring was needed.

## How to add config

Put a new file in the subfolder for its responsibility (`persona`, `theme`, `prompts`, `catalog`),
or at the root only if it is genuinely cross-cutting. Import it by its full path
(`config/<group>/<name>`); there is no barrel, so the import says exactly where the config lives.
