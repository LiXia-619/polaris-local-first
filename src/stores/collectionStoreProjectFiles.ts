import type { CodeCard, CodeCardFileRole, ProjectFile } from '../types/domain';
import { normalizeCodeLanguage } from '../engines/codeCardLanguage';
import { createDomainObjectBase } from '../engines/domainObject';
import { normalizeCodeCardFilePath } from '../engines/roomProjects';

export type ProjectFilePatch = Partial<
  Pick<ProjectFile, 'fileRole' | 'language' | 'content' | 'ownerCollaboratorId' | 'source'>
>;

function inferProjectFileLanguageFromPath(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'jsx':
      return 'jsx';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'txt':
      return 'text';
    default:
      return 'text';
  }
}

export function sortProjectFiles(files: ProjectFile[]) {
  return [...files].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function normalizeProjectFile(
  file: Partial<ProjectFile> & Pick<ProjectFile, 'id' | 'projectId' | 'filePath' | 'language' | 'content'>
): ProjectFile {
  const createdAt = typeof file.createdAt === 'number' ? file.createdAt : Date.now();
  const updatedAt = typeof file.updatedAt === 'number' ? file.updatedAt : createdAt;

  return {
    id: file.id,
    projectId: file.projectId.trim(),
    filePath: normalizeCodeCardFilePath(file.filePath) ?? file.filePath.trim(),
    fileRole: file.fileRole,
    language: normalizeCodeLanguage(file.language),
    content: file.content,
    ownerCollaboratorId:
      typeof file.ownerCollaboratorId === 'string' && file.ownerCollaboratorId.trim()
        ? file.ownerCollaboratorId
        : undefined,
    source: file.source ?? 'manual',
    createdAt,
    updatedAt,
    originConversationId: file.originConversationId,
    originMessageId: file.originMessageId,
    originBlockIndex: file.originBlockIndex,
    originBlockTitle: file.originBlockTitle
  };
}

export function createProjectFileEntry(
  seed: Partial<ProjectFile> & Pick<ProjectFile, 'projectId' | 'filePath'> & { content?: string; language?: string }
) {
  const normalizedPath = normalizeCodeCardFilePath(seed.filePath) ?? seed.filePath.trim();
  return normalizeProjectFile({
    ...createDomainObjectBase('file', seed),
    projectId: seed.projectId,
    filePath: normalizedPath,
    fileRole: seed.fileRole,
    language: seed.language ?? inferProjectFileLanguageFromPath(normalizedPath),
    content: seed.content ?? '',
    ownerCollaboratorId: seed.ownerCollaboratorId,
    source: seed.source,
    originConversationId: seed.originConversationId,
    originMessageId: seed.originMessageId,
    originBlockIndex: seed.originBlockIndex,
    originBlockTitle: seed.originBlockTitle
  });
}

export function patchProjectFiles(files: ProjectFile[], fileId: string, patch: ProjectFilePatch) {
  return sortProjectFiles(
    files.map((file) =>
      file.id === fileId
        ? normalizeProjectFile({
            ...file,
            fileRole: patch.fileRole !== undefined ? patch.fileRole : file.fileRole,
            language: patch.language ?? file.language,
            content: patch.content ?? file.content,
            ownerCollaboratorId:
              patch.ownerCollaboratorId !== undefined ? patch.ownerCollaboratorId : file.ownerCollaboratorId,
            source: patch.source ?? file.source,
            updatedAt: Date.now()
          })
        : file
    )
  );
}

export function removeProjectFile(files: ProjectFile[], fileId: string) {
  return files.filter((file) => file.id !== fileId);
}

type LegacyProjectBackedCard = CodeCard & {
  projectId?: string;
  filePath?: string;
  fileRole?: CodeCardFileRole;
  ownerPersonaId?: string;
};

export function projectFileFromLegacyCard(card: LegacyProjectBackedCard): ProjectFile | null {
  const projectId = typeof card.projectId === 'string' ? card.projectId.trim() : '';
  const filePath = normalizeCodeCardFilePath(card.filePath);
  if (!projectId || !filePath) return null;

  return normalizeProjectFile({
    id: card.id,
    projectId,
    filePath,
    fileRole: card.fileRole,
    language: card.language,
    content: card.code,
    ownerCollaboratorId: card.ownerCollaboratorId ?? card.ownerPersonaId,
    source: card.source,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    originConversationId: card.originConversationId,
    originMessageId: card.originMessageId,
    originBlockIndex: card.originBlockIndex,
    originBlockTitle: card.originBlockTitle
  });
}

export function migrateLegacyProjectCards(args: {
  projectFiles: ProjectFile[];
  cards: LegacyProjectBackedCard[];
}) {
  const nextById = new Map(
    args.projectFiles.map((file) => [file.id, normalizeProjectFile(file)] as const)
  );
  const standaloneCards: CodeCard[] = [];

  for (const card of args.cards) {
    const legacyFile = projectFileFromLegacyCard(card);
    if (!legacyFile) {
      standaloneCards.push(card);
      continue;
    }
    nextById.set(legacyFile.id, legacyFile);
  }

  return {
    cards: standaloneCards,
    projectFiles: sortProjectFiles([...nextById.values()])
  };
}
