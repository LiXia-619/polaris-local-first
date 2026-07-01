# Desktop And Companion

## Purpose

Desktop and companion surfaces expose user-owned local privileges and optional companion connectivity.

This surface documents host-capability work for desktop package builds.

This module is about host capability. It is separate from the `desktop` layout surface described in [Layout surfaces](layout-surfaces.md).

## Owns

- Desktop workspace sync and command-session control.
- Companion relay connection state.
- Local privileged actions exposed through explicit host bridges.
- Desktop-local prompt or workspace context when the host permits it.
- Trusted-root path enforcement, including symlink checks before local file or command access.

## Does Not Own

- Official public server dependency.
- Cloud account identity.
- Core chat semantics.
- Credential handling outside the configured runtime/provider boundary.
- Phone, tablet, or desktop layout selection.

## Main Entrypoints

- `desktop/`
- `src/desktop/`
- `src/app/desktop/`
- `src/app/companion/`
- `src/ui/companion/`
- `src/ui/companion/companionHostCommandRuntime.ts`

## Data It Reads

- Desktop host capability flags.
- Workspace/project/file state selected by the user.
- Companion connection and relay configuration.
- Writable chat targets when companion actions append to a conversation.

## Data It Writes

- Desktop command-session state.
- Companion connection projections.
- Chat messages or tool evidence only through shared chat/store boundaries.
- Workspace sync outputs when a desktop host action is confirmed.

## Important Failure States

- Desktop bridge is unavailable in web/native surfaces.
- A desktop package is built without an explicit API origin.
- Companion relay is not configured or rejects the connection.
- Command session fails or loses host permissions.
- A companion action targets a conversation that is not writable.
- The UI is using a desktop-sized layout but the desktop host bridge is not available.
- A trusted workspace contains a symlink that points outside the authorized root; host calls must reject that path.

## Tests And Verification

- companion and desktop-focused tests under `src/app/` and `src/ui/`.
- chat writable-body tests for companion message mutation paths.
- manual desktop-host verification before claiming local privileged actions work
  in a desktop package.

## Known Cleanup Still Owed

- Keep companion relay official-domain sentinels blocked or replace them with
  neutral configuration-free rejection before enabling this as a supported
  release target.
