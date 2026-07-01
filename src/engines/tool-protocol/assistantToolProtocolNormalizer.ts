import { asObject, normalizeStringArray } from './assistantToolProtocolShared';

function pickNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function pickNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function pickCodeCardKind(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  const rawKind = pickString(primary?.kind) ?? pickString(secondary.kind);
  return rawKind === 'tool' || rawKind === 'room-rule' || rawKind === 'card'
    ? rawKind
    : undefined;
}

function pickStringField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>,
  field: 'title' | 'language' | 'code'
) {
  return pickNonEmptyString(primary?.[field]) ?? pickNonEmptyString(secondary[field]);
}

function pickCardFaceCssField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  return pickString(primary?.cardFaceCss) ?? pickString(secondary.cardFaceCss);
}

function pickCardNoteField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  return pickString(primary?.cardNote) ?? pickString(secondary.cardNote);
}

function pickFileRoleField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  return pickString(primary?.fileRole)
    ?? pickString(primary?.file_role)
    ?? pickString(secondary.fileRole)
    ?? pickString(secondary.file_role);
}

function pickProjectField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>,
  field: 'projectId' | 'filePath'
) {
  const snakeField = field === 'projectId' ? 'project_id' : 'file_path';
  return pickString(primary?.[field])
    ?? pickString(primary?.[snakeField])
    ?? pickString(secondary[field])
    ?? pickString(secondary[snakeField]);
}

function pickCodeField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  return pickStringField(primary, secondary, 'code')
    ?? pickNonEmptyString(primary?.content)
    ?? pickNonEmptyString(secondary.content)
    ?? pickNonEmptyString(primary?.html)
    ?? pickNonEmptyString(secondary.html);
}

function pickTagsField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  const primaryTags = normalizeStringArray(primary?.tags);
  if (primaryTags.length > 0) {
    return primaryTags;
  }

  const secondaryTags = normalizeStringArray(secondary.tags);
  return secondaryTags.length > 0 ? secondaryTags : undefined;
}

function normalizeCreateCodeCardAction(action: Record<string, unknown>) {
  const card = asObject(action.card);
  const normalizedCard = {
    kind: pickCodeCardKind(card, action),
    title: pickStringField(card, action, 'title'),
    cardNote: pickCardNoteField(card, action),
    language: pickStringField(card, action, 'language'),
    code: pickCodeField(card, action),
    cardFaceCss: pickCardFaceCssField(card, action),
    tags: pickTagsField(card, action)
  };

  return {
    ...action,
    card: normalizedCard
  };
}

function normalizeCreateProjectFileAction(action: Record<string, unknown>) {
  const file = asObject(action.file) ?? asObject(action.card);
  const normalizedFile = {
    language: pickStringField(file, action, 'language'),
    code: pickString(file?.code) ?? pickString(action.code) ?? '',
    projectId: pickProjectField(file, action, 'projectId'),
    filePath: pickProjectField(file, action, 'filePath'),
    fileRole: pickFileRoleField(file, action)
  };

  return {
    ...action,
    file: normalizedFile
  };
}

function normalizeCreateRoomProjectAction(action: Record<string, unknown>) {
  return {
    ...action,
    projectId: pickNonEmptyString(action.projectId) ?? pickNonEmptyString(action.id),
    title: pickNonEmptyString(action.title),
    slug: pickNonEmptyString(action.slug),
    tags: pickTagsField(null, action),
    coverNote: pickString(action.coverNote),
    coverStyle: pickString(action.coverStyle)
  };
}

function pickRoomProjectCoverStyleField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  return pickString(primary?.coverStyle)
    ?? pickString(primary?.cover_style)
    ?? pickString(primary?.coverCss)
    ?? pickString(primary?.cover_css)
    ?? pickString(secondary.coverStyle)
    ?? pickString(secondary.cover_style)
    ?? pickString(secondary.coverCss)
    ?? pickString(secondary.cover_css);
}

function pickRoomProjectCoverNoteField(
  primary: Record<string, unknown> | null,
  secondary: Record<string, unknown>
) {
  return pickString(primary?.coverNote)
    ?? pickString(primary?.cover_note)
    ?? pickString(secondary.coverNote)
    ?? pickString(secondary.cover_note);
}

function normalizePatchRoomProjectAction(action: Record<string, unknown>) {
  const patch = asObject(action.patch) ?? asObject(action.project);
  const normalizedPatch = {
    title: pickStringField(patch, action, 'title'),
    slug: pickNonEmptyString(patch?.slug) ?? pickNonEmptyString(action.slug),
    tags: pickTagsField(patch, action),
    coverNote: pickRoomProjectCoverNoteField(patch, action),
    coverStyle: pickRoomProjectCoverStyleField(patch, action)
  };

  return {
    ...action,
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    patch: normalizedPatch
  };
}

function normalizePatchCodeCardAction(action: Record<string, unknown>) {
  const patch = asObject(action.patch);
  const normalizedPatch = {
    kind: pickCodeCardKind(patch, action),
    title: pickStringField(patch, action, 'title'),
    cardNote: pickCardNoteField(patch, action),
    language: pickStringField(patch, action, 'language'),
    code: pickCodeField(patch, action),
    cardFaceCss: pickCardFaceCssField(patch, action),
    tags: pickTagsField(patch, action)
  };

  return {
    ...action,
    patch: normalizedPatch
  };
}

function normalizeAppendProjectFileAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    projectId: pickString(action.projectId),
    filePath: pickString(action.filePath),
    code:
      pickNonEmptyString(action.code)
      ?? pickNonEmptyString(action.content)
      ?? pickNonEmptyString(action.text)
      ?? pickNonEmptyString(action.append)
      ?? pickNonEmptyString(action.appendCode)
  };
}

function normalizeInsertProjectFileAction(action: Record<string, unknown>) {
  const beforeString =
    pickString(action.beforeString)
    ?? pickString(action.before_string)
    ?? pickString(action.beforeSelector)
    ?? pickString(action.before_selector)
    ?? (pickString(action.position) === 'before' ? pickString(action.anchor) : undefined);
  const afterString =
    pickString(action.afterString)
    ?? pickString(action.after_string)
    ?? pickString(action.afterSelector)
    ?? pickString(action.after_selector)
    ?? (pickString(action.position) === 'after' ? pickString(action.anchor) : undefined);
  return {
    ...action,
    target: pickString(action.target),
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    filePath: pickString(action.filePath) ?? pickString(action.file_path),
    beforeString,
    afterString,
    lineNumber:
      pickNumber(action.lineNumber)
      ?? pickNumber(action.line_number)
      ?? pickNumber(action.afterLine)
      ?? pickNumber(action.after_line)
      ?? pickNumber(action.beforeLine)
      ?? pickNumber(action.before_line),
    linePosition:
      pickString(action.linePosition)
      ?? pickString(action.line_position)
      ?? (pickNumber(action.beforeLine) || pickNumber(action.before_line) ? 'before' : undefined)
      ?? (pickNumber(action.afterLine) || pickNumber(action.after_line) ? 'after' : undefined),
    code:
      pickString(action.code)
      ?? pickString(action.content)
      ?? pickString(action.text)
      ?? pickString(action.insert)
      ?? pickString(action.insertCode)
      ?? pickString(action.insert_code)
  };
}

function normalizeReplaceProjectFileLinesAction(action: Record<string, unknown>) {
  const startLine =
    pickNumber(action.startLine)
    ?? pickNumber(action.start_line)
    ?? pickNumber(action.lineNumber)
    ?? pickNumber(action.line_number)
    ?? pickNumber(action.line);
  return {
    ...action,
    target: pickString(action.target),
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    filePath: pickString(action.filePath) ?? pickString(action.file_path),
    startLine,
    endLine:
      pickNumber(action.endLine)
      ?? pickNumber(action.end_line)
      ?? pickNumber(action.stopLine)
      ?? pickNumber(action.stop_line)
      ?? startLine,
    code:
      pickString(action.code)
      ?? pickString(action.content)
      ?? pickString(action.text)
      ?? pickString(action.newString)
      ?? pickString(action.new_string)
      ?? pickString(action.replace)
      ?? pickString(action.replacement)
      ?? ''
  };
}

function normalizeWriteProjectFilesAction(action: Record<string, unknown>) {
  const rawFiles = Array.isArray(action.files)
    ? action.files
    : Array.isArray(action.file)
      ? action.file
      : [];
  const files = rawFiles.map((entry) => {
    const file = asObject(entry);
    if (!file) return entry;
    return {
      filePath: pickProjectField(file, action, 'filePath'),
      fileRole: pickFileRoleField(file, action),
      language: pickStringField(file, action, 'language'),
      code: pickString(file.code) ?? pickString(file.content) ?? '',
      replaceContent: typeof file.replaceContent === 'boolean' ? file.replaceContent : undefined
    };
  });

  return {
    ...action,
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    files
  };
}

function normalizeAppendCodeCardAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    code:
      pickNonEmptyString(action.code)
      ?? pickNonEmptyString(action.content)
      ?? pickNonEmptyString(action.text)
      ?? pickNonEmptyString(action.append)
      ?? pickNonEmptyString(action.appendCode)
  };
}

function normalizeEditCodeCardTextAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    oldString:
      pickString(action.oldString)
      ?? pickString(action.old_string)
      ?? pickString(action.old)
      ?? pickString(action.find),
    newString:
      pickString(action.newString)
      ?? pickString(action.new_string)
      ?? pickString(action.new)
      ?? pickString(action.replace)
      ?? ''
  };
}

function normalizeEditProjectFileTextAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    filePath: pickString(action.filePath) ?? pickString(action.file_path),
    oldString:
      pickString(action.oldString)
      ?? pickString(action.old_string)
      ?? pickString(action.old)
      ?? pickString(action.find),
    newString:
      pickString(action.newString)
      ?? pickString(action.new_string)
      ?? pickString(action.new)
      ?? pickString(action.replace)
      ?? ''
  };
}

function normalizeDeleteProjectFileAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    filePath: pickString(action.filePath) ?? pickString(action.file_path)
  };
}

function normalizePromoteCardToProjectAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    projectTitle:
      pickNonEmptyString(action.projectTitle)
      ?? pickNonEmptyString(action.project_title)
      ?? pickNonEmptyString(action.title),
    filePath: pickProjectField(null, action, 'filePath'),
    fileRole: pickFileRoleField(null, action)
  };
}

function normalizeReadCodeCardAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target)
  };
}

function normalizeReadProjectFileAction(action: Record<string, unknown>) {
  return {
    ...action,
    target: pickString(action.target),
    projectId: pickString(action.projectId) ?? pickString(action.project_id),
    filePath: pickString(action.filePath) ?? pickString(action.file_path)
  };
}

function normalizeCurrentProjectAction(action: Record<string, unknown>) {
  return {
    ...action,
    projectId: pickString(action.projectId) ?? pickString(action.project_id)
  };
}

function normalizeSearchProjectFilesAction(action: Record<string, unknown>) {
  return {
    ...normalizeCurrentProjectAction(action),
    query: pickString(action.query)
      ?? pickString(action.needle)
      ?? pickString(action.search)
      ?? pickString(action.text)
  };
}

function normalizeReadProjectFileContextAction(action: Record<string, unknown>) {
  return {
    ...normalizeReadProjectFileAction(action),
    query: pickString(action.query)
      ?? pickString(action.needle)
      ?? pickString(action.search)
      ?? pickString(action.text)
  };
}

export function normalizeAssistantToolActionValue(value: unknown): unknown {
  const action = asObject(value);
  if (!action || typeof action.kind !== 'string') {
    return value;
  }

  switch (action.kind) {
    case 'createRoomProject':
      return normalizeCreateRoomProjectAction(action);
    case 'createCodeCard':
      return normalizeCreateCodeCardAction(action);
    case 'createProjectFile':
      return normalizeCreateProjectFileAction(action);
    case 'listCodeCards':
      return value;
    case 'patchRoomProject':
      return normalizePatchRoomProjectAction(action);
    case 'patchCodeCard':
      return normalizePatchCodeCardAction(action);
    case 'appendCodeCard':
      return normalizeAppendCodeCardAction(action);
    case 'appendProjectFile':
      return normalizeAppendProjectFileAction(action);
    case 'insertProjectFile':
      return normalizeInsertProjectFileAction(action);
    case 'replaceProjectFileLines':
      return normalizeReplaceProjectFileLinesAction(action);
    case 'writeProjectFiles':
      return normalizeWriteProjectFilesAction(action);
    case 'listProjectFiles':
    case 'readWorkspacePreviewState':
    case 'checkProjectPreview':
    case 'inspectProjectRuntime':
      return normalizeCurrentProjectAction(action);
    case 'searchProjectFiles':
      return normalizeSearchProjectFilesAction(action);
    case 'editCodeCardText':
      return normalizeEditCodeCardTextAction(action);
    case 'editProjectFileText':
      return normalizeEditProjectFileTextAction(action);
    case 'deleteProjectFile':
      return normalizeDeleteProjectFileAction(action);
    case 'promoteCardToProject':
      return normalizePromoteCardToProjectAction(action);
    case 'readCodeCard':
      return normalizeReadCodeCardAction(action);
    case 'readProjectFile':
      return normalizeReadProjectFileAction(action);
    case 'readProjectFileContext':
      return normalizeReadProjectFileContextAction(action);
    default:
      return value;
  }
}
