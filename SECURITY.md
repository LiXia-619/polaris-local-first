# Security Policy

Polaris is local-first software. Please use the repository's vulnerability reporting channel when it is available, or report issues directly to the project owner through the channel where the source was shared.

## User Data Boundary

Polaris may process chat history, provider settings, workspace documents, generated media, and imported backups. Security work must preserve these rules:

- Treat user exports and imported backups as user-owned data.
- Keep temporary analysis local.
- Report aggregate counts and invariant names instead of raw content.
- Use `.env.example` for configuration shape and synthetic data for reproduction cases.

## Reporting

Use the repository's vulnerability reporting channel if it is enabled. Otherwise, report issues directly to the project owner through the channel where the source was shared.
