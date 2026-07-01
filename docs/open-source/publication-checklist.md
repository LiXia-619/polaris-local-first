# Publication Checklist

Pre-release verification gates.

## Legal And Repository Gate

- Confirm `LICENSE` is present and `package.json` declares `AGPL-3.0-only`.
- Keep npm publishing disabled unless package publication is explicitly intended.
- Confirm no generated release artifacts are tracked.

## Public Package Gate

Run:

```bash
git status --short
npm run publication:hygiene
```

Review every hit from the hygiene report. The package should contain source,
docs, templates, tests, and verification evidence. Resolve review items before
direct repository publication.

The hygiene command fails on generated artifacts, local databases, archives,
signing material, source maps, unlisted root Markdown, and common
credential-shaped text.

## Engineering Gate

Run:

```bash
npm run publication:gate
npm --prefix workers/polaris-api audit
```

`npm run publication:gate` includes publication hygiene, the LocalData boundary gate, the main typecheck, extra tool/API typecheck, Worker typecheck, full test suite, and production build. Do not translate these into "released." They only prove the local source gate. Review the Worker audit separately before direct publication; if it requires a Wrangler major upgrade, do that as its own Worker-toolchain pass rather than hiding it inside the publication gate.

## Data Gate

Confirm:

- ordinary startup reads current LocalData facts through the documented storage path
- ordinary saves write through current row writers
- existing package data enters through import, migration, and validation boundaries
- SQLite is either the default facts substrate or clearly documented as not yet default
- failed or empty reads are not persisted as current blank data
- [data source decisions](data-source-decisions.md) matches the source:
  completed domains are not understated, open domains are not overstated, and
  old stores are named only as unsupported inactive inputs or explicit import/migration boundaries

## Backend Gate

Confirm:

- local dev does not require a Polaris-owned server
- `VITE_POLARIS_API_ORIGIN` points only to a deployer-owned backend
- same-origin `/api` deployment is documented
- split-origin CORS is explicit and tested
- planned public handlers are either implemented or documented as not yet available

## Release-Channel Gate

Report separately:

- Source
- Web selfhost
- Android APK
- iOS/TestFlight
- App Store

Do not let a green source checkout imply that any public channel has shipped.
