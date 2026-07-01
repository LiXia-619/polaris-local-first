import type { ThemeToolMode } from '../../types/domain';
import { asObject, normalizeStringArray } from './assistantToolProtocolShared';
import { hasStableThemeCoordinateFields } from './assistantToolProtocolThemeStable';
import { hasSurfaceTokenFields } from './assistantToolProtocolThemeSurfaceTokens';
import {
  hasNonEmptyString,
  normalizeMemoryItems,
  normalizeSaveAttachmentMode
} from './assistantToolProtocolActionShared';

export function inferAssistantToolKind(
  action: Record<string, unknown>,
  themeToolMode: ThemeToolMode
): string | null {
  if (themeToolMode === 'stable' && hasStableThemeCoordinateFields(action)) {
    return 'applyThemeCoordinates';
  }
  if (themeToolMode === 'stable' && hasSurfaceTokenFields(action)) {
    return 'applySurfaceTokens';
  }
  const hasSelector = hasNonEmptyString(action.selector);
  const hasCss =
    hasNonEmptyString(action.css)
    || hasNonEmptyString(action.cssText)
    || normalizeStringArray(action.cssLines).length > 0;
  if (hasCss) return themeToolMode === 'creative' ? 'appendThemeCss' : 'patchRawCss';
  if (hasNonEmptyString(action.presetId)) return 'applyPreset';
  const hasProjectCoordinates =
    (hasNonEmptyString(action.projectId) || hasNonEmptyString(action.project_id))
    && (hasNonEmptyString(action.filePath) || hasNonEmptyString(action.file_path));
  if (hasNonEmptyString(action.oldString) && action.newString != null && hasProjectCoordinates) {
    return 'editProjectFileText';
  }
  if (
    (typeof action.startLine === 'number' || typeof action.start_line === 'number')
    && (hasNonEmptyString(action.code) || hasNonEmptyString(action.content) || action.code === '' || action.content === '')
    && hasProjectCoordinates
  ) {
    return 'replaceProjectFileLines';
  }
  if (
    (
      hasNonEmptyString(action.beforeString)
      || hasNonEmptyString(action.afterString)
      || hasNonEmptyString(action.beforeSelector)
      || hasNonEmptyString(action.afterSelector)
    )
    && hasNonEmptyString(action.code)
    && hasProjectCoordinates
  ) {
    return 'insertProjectFile';
  }
  if (hasNonEmptyString(action.oldString) && action.newString != null) {
    return 'editCodeCardText';
  }
  if (action.kind === 'promoteCardToProject') {
    return 'promoteCardToProject';
  }
  if (hasNonEmptyString(action.projectId) && hasNonEmptyString(action.filePath) && action.kind === 'createProjectFile') {
    return 'createProjectFile';
  }
  if (hasNonEmptyString(action.projectId) && hasNonEmptyString(action.filePath) && !hasNonEmptyString(action.code)) {
    return 'createProjectFile';
  }
  if (hasNonEmptyString(action.projectId) && hasNonEmptyString(action.title) && !hasNonEmptyString(action.code)) {
    return 'createRoomProject';
  }
  const file = asObject(action.file) ?? asObject(action.card);
  if (
    file
    && hasNonEmptyString(file.projectId)
    && hasNonEmptyString(file.filePath)
    && action.kind === 'createProjectFile'
  ) {
    return 'createProjectFile';
  }
  const card = asObject(action.card);
  if ((card && hasNonEmptyString(card.code)) || hasNonEmptyString(action.code)) {
    return 'createCodeCard';
  }
  if (
    hasNonEmptyString(action.append)
    || hasNonEmptyString(action.appendCode)
    || (action.kind === 'appendProjectFile' && hasNonEmptyString(action.code))
  ) {
    return hasProjectCoordinates ? 'appendProjectFile' : 'appendCodeCard';
  }
  if (action.kind === 'appendCodeCard' && hasNonEmptyString(action.code)) {
    return 'appendCodeCard';
  }
  if (asObject(action.patch)) return 'patchCodeCard';
  if (hasNonEmptyString(action.content) && hasNonEmptyString(action.title) && (
    action.kind === 'writeMemoryDoc'
    || action.kind === 'writeReferenceDoc'
    || action.kind === 'writeLongTermMemoryDoc'
  )) return 'writeMemoryDoc';
  if (normalizeMemoryItems(action).length > 0) return 'writeMemory';
  if (hasNonEmptyString(action.docId)) return 'readMemoryDoc';
  if (normalizeSaveAttachmentMode(action.saveAs)) return 'saveAttachment';
  if (hasNonEmptyString(action.url) && !hasNonEmptyString(action.fileName)) {
    return 'readWebPage';
  }
  if (hasNonEmptyString(action.target) && (action.scope === 'all' || action.scope === 'latest')) {
    return 'inspectAttachment';
  }
  if (!hasNonEmptyString(action.target) && (action.scope === 'all' || action.scope === 'latest')) {
    return 'inspectAttachment';
  }
  if (hasNonEmptyString(action.query) && !hasNonEmptyString(action.target)) {
    return 'webSearch';
  }
  if (hasNonEmptyString(action.target) && hasNonEmptyString(action.query)) {
    return 'inspectAttachment';
  }
  if (hasNonEmptyString(action.target) && (hasNonEmptyString(action.entry) || Number.isFinite(Number(action.maxChars)))) {
    return 'readAttachment';
  }
  if (hasNonEmptyString(action.entry) && !hasNonEmptyString(action.language) && !hasNonEmptyString(action.title)) {
    return 'readArchiveEntryText';
  }
  if (
    normalizeStringArray(action.entries).length > 0
    || normalizeStringArray(action.prefixes).length > 0
    || normalizeStringArray(action.excludeEntries).length > 0
    || normalizeStringArray(action.excludePrefixes).length > 0
  ) {
    return 'bundleAttachment';
  }
  if (normalizeStringArray(action.targets).length > 0) {
    return 'bundleAttachment';
  }
  if (hasNonEmptyString(action.text) && (hasNonEmptyString(action.fileName) || !hasNonEmptyString(action.target))) {
    return 'createQrCode';
  }
  if (hasNonEmptyString(action.entry) && (hasNonEmptyString(action.language) || hasNonEmptyString(action.title))) {
    return 'saveArchiveEntryAsCodeCard';
  }
  if (hasNonEmptyString(action.target) && hasNonEmptyString(action.language)) {
    return 'saveAttachmentAsCodeCard';
  }
  if (
    hasNonEmptyString(action.target)
    && (hasNonEmptyString(action.title) || normalizeStringArray(action.tags).length > 0 || action.openInCollection != null)
  ) {
    return 'saveAttachmentToCollection';
  }
  return null;
}
