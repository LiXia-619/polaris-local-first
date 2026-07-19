# Polaris Windows desktop baseline

This baseline packages the existing Polaris Electron surface as a Windows 10/11
x64 installer. It does not replace the web app or create a separate product
repository.

## What this first package provides

- Windows x64 NSIS installer.
- Per-user installation without administrator rights.
- A visible installation-directory selector, so Polaris can be installed on D:
  or another drive instead of filling C:\.
- Desktop and Start menu shortcuts.
- Local application data remains intact when the program is uninstalled.
- A minimal application payload containing only the built frontend and Electron
  desktop runtime files. Source files, `node_modules`, environment files, and
  source maps are not copied into the packaged app.

This is packaging infrastructure only. Multi-window rooms, identity-separated
memory, Ombre Brain integration, and the desktop pet remain later milestones.

## Build locally on Windows

Install Node.js 24 and run PowerShell from the repository directory:

```powershell
npm ci
$env:POLARIS_DESKTOP_API_ORIGIN = "https://your-polaris-api.example.com"
npm run desktop:package:windows
```

The installer is written to `desktop-dist/windows/`. Choose **Custom
installation** in the installer to select a non-C: destination.

For an unpacked smoke-test build:

```powershell
$env:POLARIS_DESKTOP_API_ORIGIN = "https://your-polaris-api.example.com"
npm run desktop:package:windows:dir
```

## Build with GitHub Actions

Open **Actions → Windows desktop package → Run workflow**. Enter the public
Polaris API origin when prompted. After the job succeeds, download the
`Polaris-Windows-x64` artifact from the workflow run.

The API value must be an origin only, such as `https://api.example.com`; do not
include a path, query string, or trailing slash.
