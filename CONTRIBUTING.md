# Contributing

Polaris welcomes thoughtful contributions. The source license is AGPL-3.0-only, and product direction is owner-led so the workspace keeps a coherent shape across chat, collaborators, tools, LocalData, and platform surfaces.

Good contributions usually improve one clear product path: a bug fix, a focused test, a module note, an import/export adapter, backend/selfhost support, a native bridge improvement, or a small UI behavior that matches the existing design.

## Development Setup

```bash
npm i
npm run dev
```

Before proposing a change, run the smallest relevant focused test first, then the broader gates when the change is ready:

```bash
npm run typecheck
npm run test:data-boundary
npm test
```

## Engineering Rules

- Keep durable facts, recovery evidence, and UI projections separate.
- Do not add compatibility bridges unless the boundary document for the current task explicitly requires one.
- Do not persist failed, missing, or empty reads as current product data.
- Put new UI components in the existing feature directory instead of flattening them into `src/ui/`.
- Add focused tests for engine, persistence, parser, and tool-protocol changes.

## Pull Request Shape

A useful PR should explain:

- the user-facing behavior it changes
- the data owner or module boundary it touches
- the verification commands that passed
- screenshots or recordings for visible UI changes

## Reproduction Data

Use synthetic fixtures, configuration examples, and reproducible command output in contributions.
