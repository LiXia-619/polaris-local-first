# P2 God-Module Split Plan

This checkpoint closes the first cleanup wave and names the next one. The repository is now past
the broad mechanical phase: dead prototype code is gone, product knowledge moved out of the app
shell file, persistence has per-domain folders, `types/domain.ts` is a barrel over submodules,
persona-builder logic lives in `src/app`, and `src/config` is grouped by responsibility.

The next phase is different. These are no longer pure file moves; each split has to preserve
behavior while making ownership clearer. Work one god-module at a time, and inside each module
move one responsibility at a time.

## Checkpoint

- Base checkpoint: `aff39da Update open-source config paths`.
- Worktree state at checkpoint: clean.
- Full verification at checkpoint: `npm run typecheck`, `npm test` (2,978 tests), and
  `npm run build`.
- No source code changes are part of this document; it is a planning handoff for the next code
  slice.

## First Candidate: `src/engines/toolExecutorDescribe.ts`

`toolExecutorDescribe.ts` is a 952-line natural-language descriptor for `ToolAction`. The public
contract is small:

- `isPreviewableToolAction(action)`
- `getToolActionVariables(action)`
- `describeToolAction(action): ToolActionDescription`

The file is large because `describeToolAction` dispatches every tool action kind in one switch and
also carries theme/CSS helper logic. The split should keep `describeToolAction` as the dispatcher
and move domain-specific descriptions into focused modules.

## Proposed Domain Groups

| Domain | Action kinds | Risk |
|---|---|---|
| `theme-css` | `applyThemeCoordinates`, `applySurfaceTokens`, `patchRawCss`, `readThemeCss`, `editThemeCss`, `appendThemeCss`, `insertThemeCss`, `deleteThemeCss`, `replaceThemeCss`, `inspectThemeRender`, `applyPreset` | High: owns preview metadata, CSS selector inference, transaction wording, and theme surface labels. Do not start here. |
| `knowledge-environment` | `readPolarisKnowledge`, `listEnvironmentNodes`, `inspectEnvironmentNode`, `searchEnvironmentNodes` | Medium: small case count, but currently interleaved with theme cases in the switch. Good second slice after the dispatcher pattern is proven. |
| `workspace-project-card` | `switchWorld`, `createRoomProject`, `createCodeCard`, `createProjectFile`, `patchRoomProject`, `writeProjectFiles`, `listProjectFiles`, `searchProjectFiles`, `readWorkspacePreviewState`, `listWorkspaceReferences`, `searchWorkspaceReferences`, `readWorkspaceReference`, `promoteWorkspaceReferenceToProjectFile`, `pinProjectFileAsReference`, `searchReadableContext`, `checkProjectPreview`, `inspectProjectRuntime`, `promoteCardToProject`, `patchCodeCard`, `appendCodeCard`, `appendProjectFile`, `insertProjectFile`, `replaceProjectFileLines`, `editCodeCardText`, `editProjectFileText`, `deleteProjectFile`, `listCodeCards`, `readCodeCard`, `readProjectFile`, `readProjectFileContext` | High: many actions, several use project/file/card wording that is user-visible. Split later. |
| `memory` | `writeMemory`, `writeMemoryDoc`, `readMemoryDoc`, `searchMemory`, `openMemorySource` | Low: compact group, one extra `memoryItems` field. Good first or second slice. |
| `task` | `startTask`, `completeTask`, `wait` | Low: tiny group, but too small to prove the useful split by itself. Combine only with another low-risk group if needed. |
| `proactive-message` | `createProactiveMessageRule`, `listProactiveMessageRules`, `updateProactiveMessageRule`, `deleteProactiveMessageRule` | Low: compact and cohesive. |
| `attachments-web-calendar-image` | `inspectAttachments`, `webSearch`, `readWebPage`, calendar actions, attachment text/bundling, QR/image actions, archive actions, `runCode` | Medium: broad capability bucket; split only after smaller groups establish the pattern. |
| `desktop` | `editDesktopFileText`, `searchDesktopFiles`, `readDesktopFileContext`, `replaceDesktopFileLines`, `listDesktopWorkspaces`, `listDesktopFiles`, `readDesktopFile`, `writeDesktopFile`, `createDesktopDirectory`, `deleteDesktopPath`, `moveDesktopPath`, `runDesktopCommand`, `runDesktopCommandSequence`, `startDesktopCommand`, `listDesktopCommandSessions`, `stopDesktopCommand`, `syncDesktopWorkspaceFromDisk`, `syncDesktopWorkspaceToDisk` | Low/medium: cohesive and mostly string formatting. Good first slice if it stays pure. |
| `tool-invocation` | `invokeCodeCardTool`, `invokeMcpTool` | Low: tiny tail group; split with another small domain or leave until the end. |

## Recommended First Code Slice

Start with `desktop` or `memory`, not `theme-css`.

The first slice should:

1. Add one new domain describer module beside `toolExecutorDescribe.ts`.
2. Move only that domain's cases and any helper that is exclusively owned by that domain.
3. Keep `ToolActionDescription` exported from `toolExecutorDescribe.ts` unless a type-only
   extraction is necessary for avoiding import cycles.
4. Leave `describeToolAction` as the central dispatcher; it should call the domain describer and
   keep `assertNever` coverage.
5. Run `npm run typecheck`, `npm test`, and `npm run build`.
6. Write or update a `MODULES/tools.md` or equivalent handbook doc only after the first real code
   slice lands.

## Do Not Do Yet

- Do not split `theme-css` first. It owns preview semantics, target surfaces, and transaction
  reasons; it needs a careful plan after the dispatcher pattern is already proven.
- Do not create a barrel of empty wrappers just to reduce line count.
- Do not change titles, summaries, `themeScope`, `themePatchMode`, `targetLabel`, or
  `memoryItems` text while moving code. The first P2 slice is structural.
- Do not split `ToolAction` itself in the same slice; that belongs to a separate
  `toolActionTypes.ts` plan.
