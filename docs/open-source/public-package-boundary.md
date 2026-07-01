# Source Package Boundary

This document defines the public repository and archive boundary for Polaris.

## Package Content

The tree contains source, docs, templates, tests, configuration examples, and
verification commands.

## Direct Repository Publication

Direct GitHub publication is stricter than archive publication. GitHub shows
tracked files directly.

The repository therefore relies on tracked-file checks first. Archive checks are
only a second verification layer.

## Verification

Before publication, run:

```bash
npm run publication:hygiene
```

The command fails on generated artifacts, local databases, archives, signing
material, source maps, unlisted root Markdown, and common credential-shaped
text.

Then run the engineering gates in [publication checklist](publication-checklist.md).
