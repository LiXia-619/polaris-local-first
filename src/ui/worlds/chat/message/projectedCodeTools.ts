const CODE_WRITE_TOOL_NAMES = new Set<string>([
  'saveCodeCard',
  'createCodeCard',
  'createProjectFile',
  'patchCodeCard',
  'appendCodeCard',
  'appendProjectFile',
  'insertProjectFile',
  'replaceProjectFileLines',
  'writeProjectFiles',
  'editCodeCardText',
  'editProjectFileText',
  'patchRawCss',
  'appendThemeCss',
  'insertThemeCss',
  'deleteThemeCss',
  'replaceThemeCss',
  'saveAttachmentAsCodeCard',
  'saveArchiveEntryAsCodeCard'
]);

const PROJECTED_CODE_TOOL_NAMES = new Set<string>([
  ...CODE_WRITE_TOOL_NAMES,
  'promoteCardToProject'
]);

export function isProjectedCodeToolName(name: string) {
  return PROJECTED_CODE_TOOL_NAMES.has(name.trim());
}

export function isCodeWriteToolName(name: string) {
  return CODE_WRITE_TOOL_NAMES.has(name.trim());
}
