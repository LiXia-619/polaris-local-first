import { createDomainObjectBase } from './domainObject';
import type { CardPromotionSnapshot, CodeCard, CodeCardFileRole, DesktopWorkspaceFileSyncEntry, ProjectFile, RoomProject } from '../types/domain';
import { normalizeCodeLanguage } from './codeCardLanguage';

export type RoomProjectPatch = Partial<
  Pick<RoomProject, 'title' | 'slug' | 'ownerCollaboratorId' | 'entryFileId' | 'tags' | 'coverNote' | 'coverStyle' | 'desktopBinding' | 'previewStateAccess' | 'promotionSnapshot' | 'source' | 'pinnedAt'>
>;

export type RoomProjectTreeFile = {
  fileId: string;
  title: string;
  language: string;
  path: string;
  role?: CodeCardFileRole;
  isEntry: boolean;
};

export type RoomProjectTreeSnapshot = {
  id: string;
  title: string;
  slug: string;
  ownerCollaboratorId?: string;
  entryFileId?: string;
  entryFilePath?: string;
  desktopBinding?: RoomProject['desktopBinding'];
  previewStateAccess?: RoomProject['previewStateAccess'];
  tags: string[];
  source: RoomProject['source'];
  fileCount: number;
  files: RoomProjectTreeFile[];
};

export type ResolvedRoomProjectFile = RoomProjectTreeFile & {
  content: string;
};

export type RoomProjectFileSummary = RoomProjectTreeFile;
type RoomProjectFileSummarySeed = RoomProjectFileSummary & { updatedAt?: number; createdAt?: number };

export type RoomProjectPlacementSuggestion = {
  filePath: string;
  fileRole: CodeCardFileRole;
};

export type PreferredProjectFileMatch = {
  file: ProjectFile | null;
  duplicateCount: number;
  usedPreferredFile: boolean;
};

function isHtmlLikeProjectLanguage(value: string) {
  return normalizeCodeLanguage(value) === 'html';
}

function isRunnableProjectEntryPath(value: string) {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return normalized === 'index.html'
    || normalized.endsWith('/index.html')
    || normalized === 'app/page.html'
    || normalized.endsWith('/app/page.html');
}

function slugifyProjectTitle(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'room-project';
}

function normalizeProjectTagList(tags?: string[]) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 6);
}

function normalizeFileIdList(fileIds?: string[]) {
  if (!Array.isArray(fileIds)) return [];
  return [...new Set(fileIds.map((fileId) => fileId.trim()).filter(Boolean))];
}

function normalizeOptionalProjectText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeDesktopWorkspaceBinding(value: unknown): RoomProject['desktopBinding'] {
  if (!value || typeof value !== 'object') return undefined;
  const binding = value as Partial<NonNullable<RoomProject['desktopBinding']>>;
  const rootId = normalizeOptionalProjectText(binding.rootId);
  const rootLabel = normalizeOptionalProjectText(binding.rootLabel);
  const manifestPath = normalizeCodeCardFilePath(binding.manifestPath);
  const entryFilePath = normalizeCodeCardFilePath(binding.entryFilePath);
  if (!rootId || !rootLabel || !manifestPath || !entryFilePath) return undefined;
  const linkedAt = typeof binding.linkedAt === 'number' ? binding.linkedAt : Date.now();
  const syncedAt = typeof binding.syncedAt === 'number' ? binding.syncedAt : linkedAt;
  const fileSync = normalizeDesktopWorkspaceFileSync(binding.fileSync);
  return {
    rootId,
    rootLabel,
    manifestPath,
    entryFilePath,
    linkedAt,
    syncedAt,
    ...(fileSync ? { fileSync } : {})
  };
}

function normalizeWorkspacePreviewStateAccess(value: unknown): RoomProject['previewStateAccess'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const access = value as Partial<NonNullable<RoomProject['previewStateAccess']>>;
  if (access.assistantReadEnabled !== true) return undefined;
  return {
    assistantReadEnabled: true,
    ...(typeof access.updatedAt === 'number' ? { updatedAt: access.updatedAt } : {})
  };
}

function normalizeDesktopWorkspaceFileSync(value: unknown): Record<string, DesktopWorkspaceFileSyncEntry> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, rawEntry]) => {
    if (!rawEntry || typeof rawEntry !== 'object') return [];
    const entry = rawEntry as Record<string, unknown>;
    const path = normalizeCodeCardFilePath(entry.path ?? key);
    if (!path) return [];
    const diskHash = typeof entry.diskHash === 'string' ? entry.diskHash.trim() : '';
    const polarisHash = typeof entry.polarisHash === 'string' ? entry.polarisHash.trim() : '';
    if (!diskHash || !polarisHash) return [];
    const syncedAt = typeof entry.syncedAt === 'number' ? entry.syncedAt : Date.now();
    return [[path, {
      path,
      diskHash,
      polarisHash,
      diskUpdatedAt: typeof entry.diskUpdatedAt === 'number' ? entry.diskUpdatedAt : syncedAt,
      polarisUpdatedAt: typeof entry.polarisUpdatedAt === 'number' ? entry.polarisUpdatedAt : syncedAt,
      syncedAt
    }] as const];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeCardPromotionSnapshot(snapshot: CardPromotionSnapshot | undefined) {
  if (!snapshot) return undefined;

  const originalKind = snapshot.originalKind === 'tool' || snapshot.originalKind === 'room-rule'
    ? snapshot.originalKind
    : 'card';

  return {
    cardId: snapshot.cardId,
    originalTitle: snapshot.originalTitle.trim() || '未命名卡片',
    originalTags: normalizeProjectTagList(snapshot.originalTags),
    originalCardNote: normalizeOptionalProjectText(snapshot.originalCardNote),
    originalCardFaceCss: normalizeOptionalProjectText(snapshot.originalCardFaceCss),
    originalKind,
    source: snapshot.source,
    originConversationId: normalizeOptionalProjectText(snapshot.originConversationId),
    originMessageId: normalizeOptionalProjectText(snapshot.originMessageId),
    originBlockIndex: typeof snapshot.originBlockIndex === 'number' ? snapshot.originBlockIndex : undefined,
    originBlockTitle: normalizeOptionalProjectText(snapshot.originBlockTitle),
    promotedAt: typeof snapshot.promotedAt === 'number' ? snapshot.promotedAt : Date.now()
  } satisfies CardPromotionSnapshot;
}

function deriveProjectFileTitle(path: string, fallbackTitle?: string) {
  const trimmedFallback = fallbackTitle?.trim();
  if (trimmedFallback) return trimmedFallback;
  const normalizedPath = normalizeCodeCardFilePath(path) ?? path.trim();
  const basename = normalizedPath.split('/').pop()?.trim();
  return basename || normalizedPath || '未命名文件';
}

function normalizeFileRole(role: unknown): CodeCardFileRole | undefined {
  switch (role) {
    case 'entry':
    case 'style':
    case 'logic':
    case 'content':
    case 'note':
    case 'asset-manifest':
      return role;
    default:
      return undefined;
  }
}

export function normalizeCodeCardFilePath(filePath: unknown): string | undefined {
  if (typeof filePath !== 'string') return undefined;
  const normalized = filePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\/+/, '')
    .replace(/\/{2,}/g, '/');
  return normalized || undefined;
}

export function findPreferredProjectFile(args: {
  projectFiles: ProjectFile[];
  projectId?: string;
  filePath?: string;
  preferredFileId?: string | null;
}): PreferredProjectFileMatch {
  const normalizedProjectId = typeof args.projectId === 'string' ? args.projectId.trim() : '';
  const normalizedFilePath = normalizeCodeCardFilePath(args.filePath);
  if (!normalizedProjectId || !normalizedFilePath) {
    return { file: null, duplicateCount: 0, usedPreferredFile: false };
  }

  const matches = args.projectFiles.filter((file) =>
    file.projectId === normalizedProjectId
    && normalizeCodeCardFilePath(file.filePath) === normalizedFilePath
  );

  if (matches.length === 0) {
    return { file: null, duplicateCount: 0, usedPreferredFile: false };
  }

  const preferredMatch = args.preferredFileId
    ? matches.find((file) => file.id === args.preferredFileId) ?? null
    : null;
  if (preferredMatch) {
    return {
      file: preferredMatch,
      duplicateCount: matches.length,
      usedPreferredFile: true
    };
  }

  const preferred = [...matches].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt;
    if (right.createdAt !== left.createdAt) return right.createdAt - left.createdAt;
    return left.id.localeCompare(right.id, 'zh-Hans-CN');
  })[0] ?? null;

  return {
    file: preferred,
    duplicateCount: matches.length,
    usedPreferredFile: false
  };
}

function inferFileExtension(language: string) {
  switch (language.trim().toLowerCase()) {
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'javascript':
    case 'js':
      return 'js';
    case 'typescript':
    case 'ts':
      return 'ts';
    case 'tsx':
      return 'tsx';
    case 'jsx':
      return 'jsx';
    case 'json':
      return 'json';
    case 'markdown':
    case 'md':
      return 'md';
    case 'text':
    case 'txt':
      return 'txt';
    default:
      return 'txt';
  }
}

function inferStandaloneProjectFileRole(language: string): CodeCardFileRole {
  switch (language.trim().toLowerCase()) {
    case 'html':
    case 'jsx':
    case 'tsx':
      return 'entry';
    case 'css':
      return 'style';
    case 'javascript':
    case 'js':
    case 'typescript':
    case 'ts':
      return 'logic';
    case 'markdown':
    case 'md':
    case 'text':
    case 'txt':
      return 'note';
    default:
      return 'content';
  }
}

function deriveSingleCardProjectPath(card: Pick<CodeCard, 'id' | 'title' | 'language'>, fileRole: CodeCardFileRole) {
  const extension = inferFileExtension(card.language);
  const stem = slugifyProjectTitle(card.title) || card.id;

  switch (fileRole) {
    case 'entry':
      return extension === 'html' ? 'index.html' : `app/page.${extension}`;
    case 'style':
      return `styles/main.${extension}`;
    case 'logic':
      return `scripts/app.${extension}`;
    case 'note':
      return `notes/${stem}.${extension}`;
    case 'asset-manifest':
      return `assets/${stem}.${extension}`;
    case 'content':
    default:
      return `content/${stem}.${extension}`;
  }
}

export function suggestRoomProjectPlacementForCard(
  card: Pick<CodeCard, 'id' | 'title' | 'language'> & {
    filePath?: string;
    fileRole?: CodeCardFileRole;
  }
): RoomProjectPlacementSuggestion {
  const normalizedFilePath = normalizeCodeCardFilePath(card.filePath);
  const normalizedFileRole = normalizeFileRole(card.fileRole);
  const fileRole = normalizedFileRole ?? inferStandaloneProjectFileRole(card.language);
  const filePath = normalizedFilePath ?? deriveSingleCardProjectPath(card, fileRole);
  return { filePath, fileRole };
}

export function createCardPromotionSnapshot(
  card: Pick<
    CodeCard,
    | 'id'
    | 'title'
    | 'tags'
    | 'cardNote'
    | 'cardFaceCss'
    | 'kind'
    | 'source'
    | 'originConversationId'
    | 'originMessageId'
    | 'originBlockIndex'
    | 'originBlockTitle'
  >
): CardPromotionSnapshot {
  return normalizeCardPromotionSnapshot({
    cardId: card.id,
    originalTitle: card.title,
    originalTags: card.tags,
    originalCardNote: card.cardNote,
    originalCardFaceCss: card.cardFaceCss,
    originalKind: card.kind === 'tool' || card.kind === 'room-rule' ? card.kind : 'card',
    source: card.source,
    originConversationId: card.originConversationId,
    originMessageId: card.originMessageId,
    originBlockIndex: card.originBlockIndex,
    originBlockTitle: card.originBlockTitle,
    promotedAt: Date.now()
  })!;
}

export function resolveRunnableRoomProjectEntryFile<T extends Pick<RoomProjectTreeFile, 'fileId' | 'language' | 'path' | 'role'>>(
  project: RoomProject,
  files: T[]
) {
  const htmlFiles = files.filter((file) => isHtmlLikeProjectLanguage(file.language));
  if (htmlFiles.length === 0) return null;

  const explicitHtmlEntry = htmlFiles.find((file) => file.fileId === project.entryFileId);
  if (explicitHtmlEntry) return explicitHtmlEntry;

  const entryRoleHtml = htmlFiles.find((file) => file.role === 'entry');
  if (entryRoleHtml) return entryRoleHtml;

  const conventionalHtml = htmlFiles.find((file) => isRunnableProjectEntryPath(file.path));
  if (conventionalHtml) return conventionalHtml;

  return htmlFiles[0] ?? null;
}

function sortProjectFilesByIdOrder<T extends { fileId: string; updatedAt?: number; createdAt?: number }>(
  ids: string[],
  filesById: Map<string, T>
) {
  const ordered = ids
    .map((id) => filesById.get(id))
    .filter((file): file is T => Boolean(file));
  const knownIds = new Set(ordered.map((file) => file.fileId));
  const rest = [...filesById.values()]
    .filter((file) => !knownIds.has(file.fileId))
    .sort((left, right) => {
      const rightUpdated = typeof right.updatedAt === 'number' ? right.updatedAt : right.createdAt ?? 0;
      const leftUpdated = typeof left.updatedAt === 'number' ? left.updatedAt : left.createdAt ?? 0;
      return rightUpdated - leftUpdated;
    });
  return [...ordered, ...rest];
}

export function normalizeRoomProject(
  project: (Partial<RoomProject> & Pick<RoomProject, 'id' | 'title'>) & {
    entryCardId?: string;
    cardIds?: string[];
  }
): RoomProject {
  const createdAt = typeof project.createdAt === 'number' ? project.createdAt : Date.now();
  const updatedAt = typeof project.updatedAt === 'number' ? project.updatedAt : createdAt;
  const title = project.title.trim() || '未命名工作区';
  const desktopBinding = normalizeDesktopWorkspaceBinding(project.desktopBinding);
  const previewStateAccess = normalizeWorkspacePreviewStateAccess(project.previewStateAccess);

  return {
    id: project.id,
    title,
    slug:
      typeof project.slug === 'string' && project.slug.trim()
        ? slugifyProjectTitle(project.slug)
        : slugifyProjectTitle(title),
    ownerCollaboratorId:
      typeof project.ownerCollaboratorId === 'string' && project.ownerCollaboratorId.trim()
        ? project.ownerCollaboratorId
        : undefined,
    entryFileId:
      typeof project.entryFileId === 'string' && project.entryFileId.trim()
        ? project.entryFileId
        : typeof project.entryCardId === 'string' && project.entryCardId.trim()
          ? project.entryCardId
        : undefined,
    fileIds: normalizeFileIdList(project.fileIds ?? project.cardIds),
    tags: normalizeProjectTagList(project.tags),
    coverNote: normalizeOptionalProjectText(project.coverNote),
    coverStyle: normalizeOptionalProjectText(project.coverStyle),
    ...(desktopBinding ? { desktopBinding } : {}),
    ...(previewStateAccess ? { previewStateAccess } : {}),
    promotionSnapshot: normalizeCardPromotionSnapshot(project.promotionSnapshot),
    source: project.source ?? 'manual',
    createdAt,
    updatedAt,
    pinnedAt: typeof project.pinnedAt === 'number' ? project.pinnedAt : null
  };
}

export function createRoomProject(seed?: Partial<RoomProject>) {
  return normalizeRoomProject({
    ...createDomainObjectBase('proj', seed),
    title: seed?.title ?? '未命名工作区',
    slug: seed?.slug,
    ownerCollaboratorId: seed?.ownerCollaboratorId,
    entryFileId: seed?.entryFileId,
    fileIds: seed?.fileIds,
    tags: seed?.tags,
    coverNote: seed?.coverNote,
    coverStyle: seed?.coverStyle,
    desktopBinding: seed?.desktopBinding,
    previewStateAccess: seed?.previewStateAccess,
    promotionSnapshot: seed?.promotionSnapshot,
    source: seed?.source,
    pinnedAt: seed?.pinnedAt
  });
}

export function sortRoomProjects(projects: RoomProject[]) {
  return [...projects].sort((left, right) => {
    const pinDelta = Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt));
    if (pinDelta !== 0) return pinDelta;
    if ((right.pinnedAt ?? 0) !== (left.pinnedAt ?? 0)) return (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0);
    return right.updatedAt - left.updatedAt;
  });
}

type ProjectMemberSeed = {
  fileId: string;
  role?: CodeCardFileRole;
  updatedAt?: number;
  createdAt?: number;
};

function collectProjectMemberSeeds(projectFiles: ProjectFile[]) {
  const membersByProjectId = new Map<string, Map<string, ProjectMemberSeed>>();

  for (const file of projectFiles) {
    const bucket = membersByProjectId.get(file.projectId) ?? new Map<string, ProjectMemberSeed>();
    bucket.set(file.id, {
      fileId: file.id,
      role: normalizeFileRole(file.fileRole),
      updatedAt: file.updatedAt,
      createdAt: file.createdAt
    });
    membersByProjectId.set(file.projectId, bucket);
  }

  return membersByProjectId;
}

export function reconcileRoomProjects(projects: RoomProject[], cards: CodeCard[], projectFiles: ProjectFile[] = []) {
  const membersByProjectId = collectProjectMemberSeeds(projectFiles);

  return sortRoomProjects(
    projects.map((project) => {
      const normalized = normalizeRoomProject(project);
      const memberFiles = sortProjectFilesByIdOrder(
        normalized.fileIds,
        membersByProjectId.get(normalized.id) ?? new Map<string, ProjectMemberSeed>()
      );
      const fileIds = memberFiles.map((file) => file.fileId);
      const entryFileId = fileIds.includes(normalized.entryFileId ?? '')
        ? normalized.entryFileId
        : memberFiles.find((file) => file.role === 'entry')?.fileId
          ?? memberFiles[0]?.fileId;

      return {
        ...normalized,
        entryFileId,
        fileIds
      };
    })
  );
}

function resolveProjectBackedFileSummaries(project: RoomProject, projectFiles: ProjectFile[]): RoomProjectFileSummarySeed[] {
  const filesById = new Map<string, RoomProjectFileSummarySeed>();

  for (const file of projectFiles) {
    if (file.projectId !== project.id) continue;
    filesById.set(file.id, {
      fileId: file.id,
      title: deriveProjectFileTitle(file.filePath),
      language: file.language,
      path: file.filePath,
      role: normalizeFileRole(file.fileRole),
      isEntry: false,
      updatedAt: file.updatedAt,
      createdAt: file.createdAt
    });
  }

  return sortProjectFilesByIdOrder(project.fileIds, filesById);
}

function sortRoomProjectFileSummaries<T extends RoomProjectFileSummary>(files: T[]): T[] {
  return files.sort((left, right) => {
    if (left.role === 'entry' && right.role !== 'entry') return -1;
    if (right.role === 'entry' && left.role !== 'entry') return 1;
    return left.path.localeCompare(right.path, 'zh-Hans-CN');
  });
}

export function resolveRoomProjectFileSummaries(
  project: RoomProject,
  projectFiles: ProjectFile[] = []
): RoomProjectFileSummary[] {
  const files = sortRoomProjectFileSummaries(resolveProjectBackedFileSummaries(project, projectFiles));
  const runnableEntryFile = resolveRunnableRoomProjectEntryFile(project, files);

  return files.map(({ updatedAt: _updatedAt, createdAt: _createdAt, ...file }) => ({
    ...file,
    isEntry: file.fileId === runnableEntryFile?.fileId
  }));
}

export function buildRoomProjectTreeSnapshots(
  projects: RoomProject[],
  projectFiles: ProjectFile[] = [],
  options?: { includeProjectIds?: string[] }
) {
  const visibleProjectIds = new Set([
    ...projectFiles.map((file) => file.projectId),
    ...(options?.includeProjectIds ?? [])
  ]);

  return projects
    .filter((project) => visibleProjectIds.has(project.id))
    .map((project) => {
      const resolvedFiles = resolveRoomProjectFiles(project, projectFiles);
      const entryFilePath = resolveRunnableRoomProjectEntryFile(project, resolvedFiles)?.path;
      const files = resolvedFiles.map(({ content: _content, ...file }) => file);

      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        ownerCollaboratorId: project.ownerCollaboratorId,
        entryFileId: project.entryFileId,
        entryFilePath,
        ...(project.desktopBinding ? { desktopBinding: project.desktopBinding } : {}),
        ...(project.previewStateAccess ? { previewStateAccess: project.previewStateAccess } : {}),
        tags: project.tags,
        source: project.source,
        fileCount: files.length,
        files
      } satisfies RoomProjectTreeSnapshot;
    })
    .sort((left, right) => right.fileCount - left.fileCount || left.title.localeCompare(right.title, 'zh-Hans-CN'));
}

export function resolveRoomProjectFiles(
  project: RoomProject,
  projectFiles: ProjectFile[] = []
): ResolvedRoomProjectFile[] {
  const contentByFileId = new Map(projectFiles.map((file) => [file.id, file.content]));
  const files = resolveRoomProjectFileSummaries(project, projectFiles).map((file) => ({
    ...file,
    content: contentByFileId.get(file.fileId) ?? ''
  }));

  const runnableEntryFile = resolveRunnableRoomProjectEntryFile(project, files);

  return files.map((file) => ({
    ...file,
    isEntry: file.fileId === runnableEntryFile?.fileId
  }));
}
