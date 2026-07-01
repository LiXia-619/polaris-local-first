import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { inferCodeLanguage, normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import { resolveConversationCollaboratorName } from '../../../engines/conversationOwnership';
import {
  importMemoryReferenceDocFromFile,
  MEMORY_REFERENCE_DOC_ACCEPT
} from '../../../engines/memoryReferenceDocImport';
import { readWorkspaceReferenceDocContent } from '../../../stores/workspaceReferenceDocContentPersistence';
import { classifyWorkspaceImportFile } from '../../../engines/workspaceImportClassification';
import { displayConversationTitle } from '../../../stores/chatStoreTitles';
import { useI18n } from '../../../i18n';
import { CreateActionSheet } from '../../create/CreateActionSheet';
import { Icon } from '../../Icon';
import { isWideLayoutSurface } from '../../../app/shell/appLayoutSurface';
import { useAppLayoutSurface } from '../../app-shell/useAppLayoutSurface';
import { canUseNativeSystemFilePicker, pickNativeSystemFiles } from '../../../native/systemPickedFiles';
import { runImpactAction } from '../../haptics';
import { RoomProjectFileTree } from './RoomProjectFileTree';
import type { ResolvedRoomProjectFile } from '../../../engines/roomProjects';
import type { Conversation, Persona, RoomProject, WorkspaceReferenceDoc } from '../../../types/domain';
import { useRuntimeStore } from '../../../stores/runtimeStore';
import { useSwipeDelete } from '../grid/useSwipeDelete';
import { conversationUpdatedLabel, recentConversationCopy } from '../collectionUtils';
import {
  getDesktopLocalHostBridge,
  type DesktopLocalCommandResult,
  type DesktopLocalCommandSession
} from '../../../desktop/localHost';

type FileImportControlProps = {
  className: string;
  accept?: string;
  disabled: boolean;
  multiple?: boolean;
  role?: string;
  onFiles: (files: File[]) => void | Promise<void>;
  children: ReactNode;
};

function FileImportControl({
  className,
  accept,
  disabled,
  multiple = false,
  role,
  onFiles,
  children
}: FileImportControlProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openPicker = async () => {
    if (disabled) return;
    if (canUseNativeSystemFilePicker()) {
      const files = await pickNativeSystemFiles({ accept, multiple });
      if (files.length > 0) {
        await onFiles(files);
      }
      return;
    }
    inputRef.current?.click();
  };
  return (
    <>
      <button
        type="button"
        className={`${className} room-project-file-import-action`}
        role={role}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => { void openPicker(); }}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        className="room-project-file-import-input"
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
          event.currentTarget.value = '';
          void onFiles(files);
        }}
      />
    </>
  );
}

type RoomProjectFullscreenProps = {
  project: RoomProject;
  files: ResolvedRoomProjectFile[];
  referenceDocs: WorkspaceReferenceDoc[];
  conversations: Conversation[];
  personas: Persona[];
  activeConversationId: string | null;
  desktopLocalBusy: boolean;
  desktopLocalStatus: string | null;
  desktopLocalStatusTone: 'neutral' | 'warning';
  desktopCommand: string;
  desktopCommandArgs: string;
  desktopCommandBusy: boolean;
  desktopCommandResult: { projectId: string; result: DesktopLocalCommandResult | null; error: string | null } | null;
  desktopCommandSessions: Array<DesktopLocalCommandSession & { projectId?: string }>;
  onClose: () => void;
  onOpenFile: (fileId: string) => void;
  onCreateProjectFile: (args: {
    projectId: string;
    filePath: string;
    content?: string;
    language?: string;
    openEditor?: boolean;
  }) => string | null;
  onCreateWorkspaceReference: (args: {
    projectId: string;
    title: string;
    summary?: string;
    content?: string;
  }) => string | null;
  onImportWorkspaceReference: (args: {
    projectId: string;
    title: string;
    summary: string;
    content: string;
  }) => string | null;
  onUpdateWorkspaceReference: (
    docId: string,
    patch: Partial<Pick<WorkspaceReferenceDoc, 'title' | 'summary' | 'content'>>
  ) => void;
  onDeleteWorkspaceReference: (docId: string) => void;
  onCreateProjectChat: () => void;
  onOpenProjectChat: (conversationId: string) => void;
  onDeleteProjectChat: (conversationId: string, title: string) => void;
  onRenameProject: (projectId: string, title: string) => boolean;
  onSetProjectPreviewStateAccess: (projectId: string, assistantReadEnabled: boolean) => boolean;
  onRunProject: (projectId: string) => void;
  onDesktopCommandChange: (value: string) => void;
  onDesktopCommandArgsChange: (value: string) => void;
  onRunDesktopProjectCommand: (projectId: string) => void;
  onStopDesktopProjectCommand: (sessionId: string) => void;
  onInspectProjectChanges: (projectId: string) => void;
  onSyncProjectFromDisk: (projectId: string) => void;
  onSyncProjectToDisk: (projectId: string) => void;
  onOpenDesktopLocalSettings: () => void;
};

type RoomProjectCompactView = 'conversations' | 'files' | 'references';
type ComputerWorkspaceStatusTone = 'online' | 'waiting' | 'offline' | 'error';
const COMPANION_WORKSPACE_STATUS_ONLINE_WINDOW_MS = 30 * 1000;

function formatComputerStatusAge(timestamp: number | null, language: string, fallback: string) {
  if (!timestamp) return fallback;
  const elapsedMs = Date.now() - timestamp;
  const absMs = Math.abs(elapsedMs);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 60 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000]
  ];
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs) {
      const divisor = unit === 'month' ? 30 * 24 * 60 * 60 * 1000 : unitMs;
      return formatter.format(Math.round(-elapsedMs / divisor), unit);
    }
  }
  return fallback;
}

function RoomProjectConversationRow({
  conversation,
  personas,
  active,
  onOpen,
  onDelete
}: {
  conversation: Conversation;
  personas: Persona[];
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t, language } = useI18n();
  const collaboratorName = resolveConversationCollaboratorName(conversation, personas);
  const excerpt = recentConversationCopy(conversation, language);
  const title = displayConversationTitle(conversation);
  const swipeDelete = useSwipeDelete();

  return (
    <div
      className={`room-project-conversation-row-shell ${active ? 'active' : ''} ${swipeDelete.open ? 'swipe-open' : ''} ${swipeDelete.dragging ? 'swiping' : ''}`}
      style={swipeDelete.style}
      {...swipeDelete.swipeProps}
    >
      <button
        type="button"
        className="room-project-conversation-row-delete"
        data-swipe-delete-action="true"
        onClick={(event) => {
          runImpactAction(() => {
            swipeDelete.close();
            onDelete();
          }, { element: event.currentTarget });
        }}
        aria-label={t('collection.workspace.deleteConversationAria', { title })}
      >
        {t('collection.workspace.delete')}
      </button>
      <button
        type="button"
        className={`room-project-conversation-row ${active ? 'active' : ''}`}
        onClick={(event) => {
          if (swipeDelete.open) {
            swipeDelete.close();
            return;
          }
          swipeDelete.close();
          runImpactAction(onOpen, { element: event.currentTarget });
        }}
      >
        <span className="room-project-conversation-row-copy">
          <strong>{title}</strong>
          <small>{collaboratorName} · {conversationUpdatedLabel(conversation, language)}</small>
          {excerpt ? <span>{excerpt}</span> : null}
        </span>
        {active ? <span className="room-project-conversation-row-state">{t('collection.workspace.current')}</span> : null}
      </button>
    </div>
  );
}

export function RoomProjectFullscreen({
  project,
  files,
  referenceDocs,
  conversations,
  personas,
  activeConversationId,
  desktopLocalBusy,
  desktopLocalStatus,
  desktopLocalStatusTone,
  desktopCommand,
  desktopCommandArgs,
  desktopCommandBusy,
  desktopCommandResult,
  desktopCommandSessions,
  onClose,
  onOpenFile,
  onCreateProjectFile,
  onCreateWorkspaceReference,
  onImportWorkspaceReference,
  onUpdateWorkspaceReference,
  onDeleteWorkspaceReference,
  onCreateProjectChat,
  onOpenProjectChat,
  onDeleteProjectChat,
  onRenameProject,
  onSetProjectPreviewStateAccess,
  onRunProject,
  onDesktopCommandChange,
  onDesktopCommandArgsChange,
  onRunDesktopProjectCommand,
  onStopDesktopProjectCommand,
  onInspectProjectChanges,
  onSyncProjectFromDisk,
  onSyncProjectToDisk,
  onOpenDesktopLocalSettings
}: RoomProjectFullscreenProps) {
  const { t, language } = useI18n();
  const appLayoutSurface = useAppLayoutSurface();
  const isWideLayout = isWideLayoutSurface(appLayoutSurface);
  const desktopLocalAvailable = Boolean(getDesktopLocalHostBridge());
  const companionConnections = useRuntimeStore((state) => state.companionConnections);
  const previewStateReadEnabled = project.previewStateAccess?.assistantReadEnabled === true;
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [titleEditing, setTitleEditing] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importingFiles, setImportingFiles] = useState(false);
  const [importingReferences, setImportingReferences] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [dropSummary, setDropSummary] = useState<string | null>(null);
  const [compactView, setCompactView] = useState<RoomProjectCompactView>('files');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const referenceMenuRef = useRef<HTMLDivElement | null>(null);
  const createMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const referenceMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    setTitleDraft(project.title);
    setTitleEditing(false);
    setSettingsOpen(false);
  }, [project.id, project.title]);

  useEffect(() => {
    if (!titleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [titleEditing]);

  useEffect(() => {
    if (!createMenuOpen && !referenceMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (createMenuRef.current?.contains(target)) return;
      if (referenceMenuRef.current?.contains(target)) return;
      if (createMenuTriggerRef.current?.contains(target)) return;
      if (referenceMenuTriggerRef.current?.contains(target)) return;
      setCreateMenuOpen(false);
      setReferenceMenuOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [createMenuOpen, referenceMenuOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen]);

  if (typeof document === 'undefined') return null;

  const importAccept = '.html,.htm,.css,.js,.ts,.tsx,.jsx,.json,.md,.txt,text/*';
  const importLabel = importingFiles ? t('collection.workspace.importingFiles') : t('collection.workspace.importFiles');
  const referenceImportLabel = importingReferences ? t('collection.workspace.importingReferences') : t('collection.workspace.importReferences');
  const projectMetaLabel = t('collection.workspace.metaLabel', {
    files: files.length,
    conversations: conversations.length,
    references: referenceDocs.length
  });
  const entryFile = files.find((file) => file.isEntry) ?? files.find((file) => file.role === 'entry') ?? null;
  const previewStateAccessLabel = previewStateReadEnabled
    ? t('collection.workspace.previewAccessEnabledBadge')
    : t('collection.workspace.previewAccessDisabledBadge');
  const desktopBinding = project.desktopBinding;
  const latestCompanionConnection = [...companionConnections]
    .sort((a, b) => (b.lastSnapshotAt ?? b.createdAt) - (a.lastSnapshotAt ?? a.createdAt))[0] ?? null;
  const latestCompanionSnapshotAgeMs = latestCompanionConnection?.lastSnapshotAt
    ? Date.now() - latestCompanionConnection.lastSnapshotAt
    : null;
  const latestCompanionLooksOnline = latestCompanionSnapshotAgeMs !== null
    && latestCompanionSnapshotAgeMs >= 0
    && latestCompanionSnapshotAgeMs <= COMPANION_WORKSPACE_STATUS_ONLINE_WINDOW_MS;
  const companionSeenLabelKey = latestCompanionLooksOnline
    ? 'settings.desktopLocal.workspaceStatusCompanionOnline'
    : 'settings.desktopLocal.workspaceStatusCompanionSeen';
  const computerStatus: { tone: ComputerWorkspaceStatusTone; label: string } = desktopLocalAvailable
    ? {
        tone: 'online',
        label: desktopBinding
          ? t('settings.desktopLocal.workspaceStatusMacBound')
          : t('settings.desktopLocal.workspaceStatusMacOnline')
      }
    : latestCompanionConnection
      ? latestCompanionConnection.lastError
        ? {
            tone: 'error',
            label: t('settings.desktopLocal.workspaceStatusCompanionError')
          }
        : {
            tone: latestCompanionLooksOnline
              ? 'online'
              : latestCompanionConnection.lastSnapshotAt ? 'offline' : 'waiting',
            label: latestCompanionConnection.lastSnapshotAt
              ? t(companionSeenLabelKey, {
                  time: formatComputerStatusAge(
                    latestCompanionConnection.lastSnapshotAt,
                    language,
                    t('settings.desktopLocal.workspaceStatusJustNow')
                  )
                })
              : t('settings.desktopLocal.workspaceStatusCompanionWaiting')
          }
      : {
          tone: 'offline',
          label: t('settings.desktopLocal.workspaceStatusNoComputer')
        };
  const desktopSyncedLabel = desktopBinding
    ? new Intl.DateTimeFormat(language, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(desktopBinding.syncedAt))
    : null;

  const commandResult = desktopCommandResult?.result ?? null;
  const sortedCommandSessions = [...desktopCommandSessions].sort((a, b) => b.startedAt - a.startedAt);
  const activeCommandSession =
    sortedCommandSessions.find((session) => session.status === 'running')
    ?? sortedCommandSessions[0]
    ?? null;
  const formatCommandSessionStatus = (session: DesktopLocalCommandSession) => {
    if (session.status === 'running') return t('settings.desktopLocal.commandStatusRunning', { duration: session.durationMs });
    if (session.status === 'failed') return t('settings.desktopLocal.commandStatusFailed', { duration: session.durationMs });
    return t('settings.desktopLocal.commandStatusExit', {
      code: session.exitCode ?? session.signal ?? 0,
      duration: session.durationMs
    });
  };
  const commandOutput = activeCommandSession
    ? [
      `$ ${activeCommandSession.command} ${activeCommandSession.args.join(' ')}`.trim(),
      formatCommandSessionStatus(activeCommandSession),
      activeCommandSession.stdout,
      activeCommandSession.stderr
    ].filter(Boolean).join('\n')
    : commandResult
    ? [
      `$ ${commandResult.command} ${commandResult.args.join(' ')}`.trim(),
      t('settings.desktopLocal.commandStatusExit', {
        code: commandResult.exitCode ?? commandResult.signal ?? 0,
        duration: commandResult.durationMs
      }),
      commandResult.stdout,
      commandResult.stderr
    ].filter(Boolean).join('\n')
    : desktopCommandResult?.error ?? null;

  const describeFileMeta = (file: ResolvedRoomProjectFile) => {
    const languageLabel = file.language.toUpperCase();
    if (file.isEntry) return t('collection.workspace.fileMetaRunEntry', { language: languageLabel });
    if (file.role === 'entry') return t('collection.workspace.fileMetaEntryRole', { language: languageLabel });
    if (file.role) return `${file.role} · ${languageLabel}`;
    return languageLabel;
  };

  const summarizeReferenceDoc = (doc: WorkspaceReferenceDoc) => {
    const summary = doc.summary.trim();
    if (summary) return summary;
    const content = doc.contentLoaded ? doc.content.trim().replace(/\s+/g, ' ') : '';
    return content ? content.slice(0, 64) : t('collection.workspace.referenceFallbackSummary');
  };

  const nextPinnedReferenceTitle = (file: ResolvedRoomProjectFile) => {
    const baseTitle = file.path.trim() || file.title.trim() || t('collection.workspace.projectFileFallback');
    const existingTitles = new Set(referenceDocs.map((doc) => doc.title.trim()).filter(Boolean));
    if (!existingTitles.has(baseTitle)) return baseTitle;
    for (let index = 2; index < 1000; index += 1) {
      const candidate = t('collection.workspace.referenceTitleVariant', { title: baseTitle, index });
      if (!existingTitles.has(candidate)) return candidate;
    }
    return t('collection.workspace.referenceTitleVariant', { title: baseTitle, index: Date.now() });
  };

  const commitTitle = () => {
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle) {
      setTitleDraft(project.title);
      setTitleEditing(false);
      return;
    }
    onRenameProject(project.id, trimmedTitle);
    setTitleEditing(false);
  };

  const nextProjectFilePath = () => {
    const existingPaths = new Set(files.map((file) => file.path));
    if (!existingPaths.has('index.html')) return 'index.html';
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `new-file-${index}.txt`;
      if (!existingPaths.has(candidate)) return candidate;
    }
    return `new-file-${Date.now()}.txt`;
  };

  const handleCreateFile = () => {
    setCreateMenuOpen(false);
    onCreateProjectFile({
      projectId: project.id,
      filePath: nextProjectFilePath(),
      openEditor: true
    });
  };

  const handleCreateReference = () => {
    setReferenceMenuOpen(false);
    const title = window.prompt(
      t('collection.workspace.referenceTitlePrompt'),
      t('collection.workspace.referenceDefaultTitle', { count: referenceDocs.length + 1 })
    )?.trim();
    if (!title) return;
    const content = window.prompt(t('collection.workspace.referenceBodyPrompt'), '') ?? '';
    onCreateWorkspaceReference({
      projectId: project.id,
      title,
      content,
      summary: content.trim().replace(/\s+/g, ' ').slice(0, 96)
    });
  };

  const toggleFileCreateMenu = () => {
    setReferenceMenuOpen(false);
    setCreateMenuOpen((current) => !current);
  };

  const toggleReferenceCreateMenu = () => {
    setCreateMenuOpen(false);
    setReferenceMenuOpen((current) => !current);
  };

  const handleImportFiles = async (nextFiles: FileList | File[]) => {
    const selectedFiles = Array.from(nextFiles);
    setCreateMenuOpen(false);
    if (selectedFiles.length === 0) return;

    try {
      setImportingFiles(true);
      await Promise.all(
        selectedFiles.map(async (file, index) => {
          const content = await file.text();
          const inferredLanguage = normalizeCodeLanguage(
            inferCodeLanguage(content, file.name.split('.').pop())
          );
          onCreateProjectFile({
            projectId: project.id,
            filePath: file.name,
            content,
            language: inferredLanguage,
            openEditor: selectedFiles.length === 1 && index === 0
          });
        })
      );
    } finally {
      setImportingFiles(false);
    }
  };

  const handleImportReferences = async (nextFiles: FileList | File[]) => {
    const selectedFiles = Array.from(nextFiles);
    setReferenceMenuOpen(false);
    if (selectedFiles.length === 0) return;

    try {
      setImportingReferences(true);
      await Promise.all(
        selectedFiles.map(async (file) => {
          const draft = await importMemoryReferenceDocFromFile(file);
          onImportWorkspaceReference({
            projectId: project.id,
            title: draft.title,
            summary: draft.summary,
            content: draft.content
          });
        })
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('collection.workspace.referenceImportFailed'));
    } finally {
      setImportingReferences(false);
    }
  };

  const resetDropState = () => {
    dragDepthRef.current = 0;
    setDropActive(false);
  };

  const isFileDrag = (event: DragEvent<HTMLDivElement>) => Array.from(event.dataTransfer.types).includes('Files');

  const importDroppedWorkspaceFiles = async (droppedFiles: File[]) => {
    if (droppedFiles.length === 0) return;

    setDropBusy(true);
    setDropSummary(null);
    const result = {
      projectFiles: 0,
      references: 0,
      skipped: 0,
      failed: 0
    };

    for (const file of droppedFiles) {
      const destination = classifyWorkspaceImportFile(file);
      try {
        if (destination === 'project-file') {
          const content = await file.text();
          const inferredLanguage = normalizeCodeLanguage(
            inferCodeLanguage(content, file.name.split('.').pop())
          );
          const createdId = onCreateProjectFile({
            projectId: project.id,
            filePath: file.name,
            content,
            language: inferredLanguage,
            openEditor: droppedFiles.length === 1
          });
          if (createdId) result.projectFiles += 1;
          continue;
        }

        if (destination === 'reference-doc') {
          const draft = await importMemoryReferenceDocFromFile(file);
          const createdId = onImportWorkspaceReference({
            projectId: project.id,
            title: draft.title,
            summary: draft.summary,
            content: draft.content
          });
          if (createdId) result.references += 1;
          continue;
        }

        result.skipped += 1;
      } catch {
        result.failed += 1;
      }
    }

    setDropBusy(false);
    if (result.projectFiles > 0) {
      setCompactView('files');
    } else if (result.references > 0) {
      setCompactView('references');
    }

    const importedParts = [
      result.projectFiles > 0 ? t('collection.workspace.dropProjectFileCount', { count: result.projectFiles }) : '',
      result.references > 0 ? t('collection.workspace.dropReferenceCount', { count: result.references }) : ''
    ].filter(Boolean);
    const skippedParts = [
      result.skipped > 0 ? t('collection.workspace.dropSkippedCount', { count: result.skipped }) : '',
      result.failed > 0 ? t('collection.workspace.dropFailedCount', { count: result.failed }) : ''
    ].filter(Boolean);

    setDropSummary([
      importedParts.length
        ? t('collection.workspace.dropImportedSummary', { items: importedParts.join(t('collection.workspace.listSeparator')) })
        : t('collection.workspace.dropNoImportableFiles'),
      skippedParts.join(t('collection.workspace.clauseSeparator'))
    ].filter(Boolean).join(t('collection.workspace.clauseSeparator')));
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDropActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    const nextFiles = Array.from(event.dataTransfer.files);
    resetDropState();
    void importDroppedWorkspaceFiles(nextFiles);
  };

  const handlePinFileAsReference = (file: ResolvedRoomProjectFile) => {
    const title = nextPinnedReferenceTitle(file);
    onCreateWorkspaceReference({
      projectId: project.id,
      title,
      summary: t('collection.workspace.pinnedReferenceSummary', { path: file.path }),
      content: file.content
    });
  };

  const handleEditReference = async (doc: WorkspaceReferenceDoc) => {
    const title = window.prompt(t('collection.workspace.referenceTitlePrompt'), doc.title)?.trim();
    if (!title) return;
    const summary = window.prompt(t('collection.workspace.referenceSummaryPrompt'), doc.summary)?.trim() ?? doc.summary;
    let currentContent = '';
    try {
      currentContent = await readWorkspaceReferenceDocContent(doc);
    } catch {
      setDropSummary(t('collection.workspace.referenceBodyMissing'));
      return;
    }
    const content = window.prompt(t('collection.workspace.referenceBodyEditPrompt'), currentContent) ?? currentContent;
    onUpdateWorkspaceReference(doc.id, { title, summary, content });
  };

  const handleDeleteReference = (doc: WorkspaceReferenceDoc) => {
    if (!window.confirm(t('collection.workspace.deleteReferenceConfirm', { title: doc.title }))) return;
    onDeleteWorkspaceReference(doc.id);
  };

  const desktopLocalSection = desktopLocalAvailable ? (
    <section className="room-project-fullscreen-section room-project-fullscreen-section--desktop-local">
      <div className="room-project-fullscreen-section-head">
        <span className="room-project-fullscreen-section-label">
          <Icon name="compass" size={13} />
          <strong>{t('settings.desktopLocal.projectSectionTitle')}</strong>
        </span>
        <span className="room-project-fullscreen-section-tools">
          <button
            type="button"
            className="room-project-section-action"
            onClick={(event) => {
              runImpactAction(onOpenDesktopLocalSettings, { element: event.currentTarget });
            }}
          >
            <Icon name="settings" size={11} />
            <span>{desktopBinding ? t('settings.desktopLocal.manage') : t('settings.desktopLocal.connect')}</span>
          </button>
        </span>
      </div>
      <div className={`room-project-desktop-local-card ${desktopBinding ? 'bound' : 'unbound'}`}>
        <button
          type="button"
          className="room-project-desktop-local-main"
          onClick={(event) => {
            runImpactAction(onOpenDesktopLocalSettings, { element: event.currentTarget });
          }}
        >
          <span className="room-project-desktop-local-icon" aria-hidden="true">
            <Icon name={desktopBinding ? 'check' : 'folder'} size={14} />
          </span>
          <span className="room-project-desktop-local-copy">
            <strong>{desktopBinding ? desktopBinding.rootLabel : t('settings.desktopLocal.notConnected')}</strong>
            <small>
              {desktopBinding
                ? t('settings.desktopLocal.projectBoundDetail', {
                  entry: desktopBinding.entryFilePath,
                  time: desktopSyncedLabel ?? ''
                })
                : t('settings.desktopLocal.notConnectedDetail')}
            </small>
          </span>
        </button>
        {desktopBinding ? (
          <div className="room-project-desktop-local-actions">
            <button
              type="button"
              className="room-project-desktop-local-action"
              disabled={desktopLocalBusy}
              onClick={(event) => {
                runImpactAction(() => onInspectProjectChanges(project.id), { element: event.currentTarget });
              }}
            >
              <Icon name="eye" size={11} />
              <span>{t('settings.desktopLocal.inspect')}</span>
            </button>
            <button
              type="button"
              className="room-project-desktop-local-action"
              disabled={desktopLocalBusy}
              onClick={(event) => {
                runImpactAction(() => onSyncProjectFromDisk(project.id), { element: event.currentTarget });
              }}
            >
              <Icon name="refresh" size={11} />
              <span>{t('settings.desktopLocal.readFromMac')}</span>
            </button>
            <button
              type="button"
              className="room-project-desktop-local-action"
              disabled={desktopLocalBusy}
              onClick={(event) => {
                runImpactAction(() => onSyncProjectToDisk(project.id), { element: event.currentTarget });
              }}
            >
              <Icon name="download" size={11} />
              <span>{t('settings.desktopLocal.writeBack')}</span>
            </button>
          </div>
        ) : null}
        {desktopLocalStatus ? (
          <small className={`room-project-desktop-local-status ${desktopLocalStatusTone === 'warning' ? 'warning' : ''}`.trim()}>
            {desktopLocalStatus}
          </small>
        ) : null}
      </div>
      {desktopBinding ? (
        <form
          className="room-project-desktop-command-card"
          onSubmit={(event) => {
            event.preventDefault();
            runImpactAction(() => onRunDesktopProjectCommand(project.id), { element: event.currentTarget });
          }}
        >
          <div className="room-project-desktop-command-head">
            <span>
              <Icon name="zap" size={12} />
              <strong>{t('settings.desktopLocal.terminal')}</strong>
            </span>
            {activeCommandSession?.status === 'running' ? (
              <button
                type="button"
                className="room-project-desktop-command-run room-project-desktop-command-run--stop"
                onClick={(event) => {
                  runImpactAction(() => onStopDesktopProjectCommand(activeCommandSession.id), { element: event.currentTarget });
                }}
              >
                <Icon name="x" size={10} />
                <span>{t('settings.desktopLocal.stop')}</span>
              </button>
            ) : (
              <button
                type="submit"
                className="room-project-desktop-command-run"
                disabled={desktopCommandBusy || !desktopCommand.trim()}
              >
                <Icon name="play" size={10} />
                <span>{desktopCommandBusy ? t('settings.desktopLocal.starting') : t('settings.desktopLocal.run')}</span>
              </button>
            )}
          </div>
          <div className="room-project-desktop-command-inputs">
            <input
              value={desktopCommand}
              onChange={(event) => onDesktopCommandChange(event.target.value)}
              placeholder="npm"
              aria-label={t('settings.desktopLocal.commandAria')}
            />
            <input
              value={desktopCommandArgs}
              onChange={(event) => onDesktopCommandArgsChange(event.target.value)}
              placeholder="test"
              aria-label={t('settings.desktopLocal.argsAria')}
            />
          </div>
          {commandOutput ? (
            <pre className={`room-project-desktop-command-output ${desktopCommandResult?.error || activeCommandSession?.status === 'failed' ? 'error' : ''}`.trim()}>
              {commandOutput}
            </pre>
          ) : null}
        </form>
      ) : null}
    </section>
  ) : null;

  const previewStateAccessControl = (
    <button
      type="button"
      className={`room-project-preview-access-card ${previewStateReadEnabled ? 'enabled' : ''}`}
      role="switch"
      aria-checked={previewStateReadEnabled}
      onClick={(event) => {
        runImpactAction(() => {
          onSetProjectPreviewStateAccess(project.id, !previewStateReadEnabled);
        }, { element: event.currentTarget });
      }}
    >
      <span className="room-project-preview-access-icon" aria-hidden="true">
        <Icon name="eye" size={14} />
      </span>
      <span className="room-project-preview-access-copy">
        <strong>
          {previewStateReadEnabled
            ? t('collection.workspace.previewAccessEnabledTitle')
            : t('collection.workspace.previewAccessDisabledTitle')}
        </strong>
        <small>
          {previewStateReadEnabled
            ? t('collection.workspace.previewAccessEnabledDetail')
            : t('collection.workspace.previewAccessDisabledDetail')}
        </small>
      </span>
      <span className={`room-project-preview-access-switch ${previewStateReadEnabled ? 'enabled' : ''}`} aria-hidden="true">
        <span />
      </span>
    </button>
  );

  const settingsSheet = settingsOpen ? (
    <div
      className="room-project-settings-backdrop"
      onClick={() => setSettingsOpen(false)}
    >
      <section
        className="room-project-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('collection.workspace.settingsTitle')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="room-project-settings-head">
          <span>
            <small>{t('collection.workspace.settingsEyebrow')}</small>
            <strong>{t('collection.workspace.settingsTitle')}</strong>
          </span>
          <button
            type="button"
            className="room-project-settings-close"
            aria-label={t('collection.workspace.settingsClose')}
            onClick={(event) => {
              runImpactAction(() => setSettingsOpen(false), { element: event.currentTarget });
            }}
          >
            <Icon name="x" size={13} />
          </button>
        </header>
        <div className="room-project-settings-body">
          <section className="room-project-settings-panel">
            <div className="room-project-settings-panel-head">
              <Icon name="folder" size={13} />
              <strong>{t('collection.workspace.settingsOverview')}</strong>
            </div>
            <div className="room-project-settings-outline">
              <div className="room-project-settings-outline-row">
                <span>{t('collection.workspace.settingsFiles')}</span>
                <strong>{t('collection.workspace.fileCount', { count: files.length })}</strong>
              </div>
              <div className="room-project-settings-outline-row">
                <span>{t('collection.workspace.settingsConversations')}</span>
                <strong>{t('collection.workspace.conversationCount', { count: conversations.length })}</strong>
              </div>
              <div className="room-project-settings-outline-row">
                <span>{t('collection.workspace.settingsReferences')}</span>
                <strong>{t('collection.workspace.referenceCount', { count: referenceDocs.length })}</strong>
              </div>
              <div className="room-project-settings-outline-row">
                <span>{t('collection.workspace.settingsEntryFile')}</span>
                <strong>{entryFile?.path ?? t('collection.workspace.settingsEntryMissing')}</strong>
              </div>
              <div className="room-project-settings-outline-row">
                <span>{t('collection.workspace.previewAccessSection')}</span>
                <strong>{previewStateAccessLabel}</strong>
              </div>
            </div>
          </section>

          <section className="room-project-settings-panel room-project-settings-panel--preview">
            <div className="room-project-settings-panel-head">
              <Icon name="eye" size={13} />
              <strong>{t('collection.workspace.previewAccessSection')}</strong>
              <span className={`room-project-preview-access-state ${previewStateReadEnabled ? 'enabled' : ''}`}>
                {previewStateAccessLabel}
              </span>
            </div>
            {previewStateAccessControl}
          </section>

          <section className="room-project-settings-panel">
            <div className="room-project-settings-panel-head">
              <Icon name="zap" size={13} />
              <strong>{t('collection.workspace.settingsActions')}</strong>
            </div>
            <div className="room-project-settings-actions">
              <button
                type="button"
                className="room-project-settings-action"
                onClick={(event) => {
                  runImpactAction(() => {
                    setSettingsOpen(false);
                    onCreateProjectChat();
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="send" size={13} />
                <span>{t('collection.workspace.newConversation')}</span>
              </button>
              <button
                type="button"
                className="room-project-settings-action"
                onClick={(event) => {
                  runImpactAction(() => {
                    setSettingsOpen(false);
                    handleCreateFile();
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="filePlus" size={13} />
                <span>{t('collection.workspace.newFile')}</span>
              </button>
              <FileImportControl
                className="room-project-settings-action"
                accept={importAccept}
                disabled={importingFiles}
                multiple
                onFiles={handleImportFiles}
              >
                <Icon name="folder" size={13} />
                <span>{importLabel}</span>
              </FileImportControl>
              <button
                type="button"
                className="room-project-settings-action"
                onClick={(event) => {
                  runImpactAction(() => {
                    setSettingsOpen(false);
                    handleCreateReference();
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="fileText" size={13} />
                <span>{t('collection.workspace.newReference')}</span>
              </button>
              <FileImportControl
                className="room-project-settings-action"
                accept={MEMORY_REFERENCE_DOC_ACCEPT}
                disabled={importingReferences}
                multiple
                onFiles={handleImportReferences}
              >
                <Icon name="folder" size={13} />
                <span>{referenceImportLabel}</span>
              </FileImportControl>
              <button
                type="button"
                className="room-project-settings-action room-project-settings-action--run"
                onClick={(event) => {
                  runImpactAction(() => {
                    setSettingsOpen(false);
                    onRunProject(project.id);
                  }, { element: event.currentTarget });
                }}
              >
                <Icon name="play" size={13} />
                <span>{t('collection.workspace.runWorkspaceTitle')}</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  ) : null;

  return createPortal(
    <div
      className={`room-project-fullscreen ${isWideLayout ? 'room-project-fullscreen--wide' : ''} ${dropActive ? 'room-project-fullscreen--drop-active' : ''}`}
      data-room-project-view={compactView}
      role="dialog"
      aria-modal="true"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="room-project-fullscreen-bar">
        <div className="room-project-fullscreen-copy">
          <button
            type="button"
            className="room-project-fullscreen-back"
            onClick={(event) => {
              runImpactAction(onClose, { element: event.currentTarget });
            }}
            aria-label={t('collection.workspace.backToCollection')}
          >
            <Icon name="chevron" size={15} />
          </button>
          <div className="room-project-fullscreen-title">
            {titleEditing ? (
              <input
                ref={titleInputRef}
                className="room-project-fullscreen-title-input"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitTitle();
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setTitleDraft(project.title);
                    setTitleEditing(false);
                  }
                }}
                aria-label={t('collection.workspace.editTitleAria')}
              />
            ) : (
              <button
                type="button"
                className="room-project-fullscreen-title-trigger"
                onClick={(event) => {
                  runImpactAction(() => setTitleEditing(true), { element: event.currentTarget });
                }}
              >
                {project.title}
              </button>
            )}
            <small>{projectMetaLabel}</small>
            <span className="room-project-computer-status" data-tone={computerStatus.tone}>
              <span className="room-project-computer-status-dot" aria-hidden="true" />
              <span>{computerStatus.label}</span>
            </span>
          </div>
        </div>
        <div className="room-project-fullscreen-actions">
          <button
            type="button"
            className="room-project-fullscreen-settings"
            aria-label={t('collection.workspace.settingsAria')}
            onClick={(event) => {
              runImpactAction(() => setSettingsOpen(true), { element: event.currentTarget });
            }}
          >
            <Icon name="settings" size={15} />
          </button>
        </div>
      </div>

      <div className="room-project-compact-tabs" role="tablist" aria-label={t('collection.workspace.viewTabsAria')}>
        {([
          ['conversations', t('collection.workspace.conversationsTab'), conversations.length],
          ['files', t('collection.workspace.filesTab'), files.length],
          ['references', t('collection.workspace.referencesTab'), referenceDocs.length]
        ] as const).map(([view, label, count]) => (
          <button
            key={view}
            type="button"
            className={`room-project-compact-tab ${compactView === view ? 'active' : ''}`}
            role="tab"
            aria-selected={compactView === view}
            onClick={(event) => {
              runImpactAction(() => setCompactView(view), { element: event.currentTarget });
            }}
          >
            <span>{label}</span>
            <small>{count}</small>
          </button>
        ))}
      </div>

      {dropSummary ? (
        <div className="room-project-drop-status" role="status">
          {dropSummary}
        </div>
      ) : null}

      <div className="room-project-fullscreen-body">
        {desktopLocalSection}

        <section className="room-project-fullscreen-section room-project-fullscreen-section--conversations">
          <div className="room-project-fullscreen-section-head">
            <span className="room-project-fullscreen-section-label">
              <Icon name="send" size={13} />
              <strong>{t('collection.workspace.conversationsSection')}</strong>
            </span>
            <span className="room-project-fullscreen-section-tools">
              <small className="room-project-section-count">{t('collection.workspace.conversationCount', { count: conversations.length })}</small>
              <button
                type="button"
                className="room-project-section-action"
                aria-label={t('collection.workspace.newConversationAria')}
                onClick={(event) => {
                  runImpactAction(onCreateProjectChat, { element: event.currentTarget });
                }}
              >
                <Icon name="plus" size={11} />
                <span>{t('collection.workspace.newConversation')}</span>
              </button>
            </span>
          </div>
          {conversations.length > 0 ? (
            <div className="room-project-conversation-list">
              {conversations.map((conversation) => (
                <RoomProjectConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  personas={personas}
                  active={conversation.id === activeConversationId}
                  onOpen={() => onOpenProjectChat(conversation.id)}
                  onDelete={() => onDeleteProjectChat(conversation.id, displayConversationTitle(conversation))}
                />
              ))}
            </div>
          ) : (
            <div className="room-project-fullscreen-empty room-project-fullscreen-empty--compact">
              <span className="room-project-fullscreen-empty-icon" aria-hidden="true">
                <Icon name="send" size={14} />
              </span>
              <span className="room-project-fullscreen-empty-copy">
                <strong>{t('collection.workspace.emptyConversationsTitle')}</strong>
                <p>{t('collection.workspace.emptyConversationsDetail')}</p>
              </span>
            </div>
          )}
        </section>

        <section className="room-project-fullscreen-section room-project-fullscreen-section--files">
          <div className="room-project-fullscreen-section-head">
            <span className="room-project-fullscreen-section-label">
              <Icon name="code" size={13} />
              <strong>{t('collection.workspace.filesSection')}</strong>
            </span>
            <span className="room-project-fullscreen-section-tools">
              <small className="room-project-section-count">{t('collection.workspace.fileCount', { count: files.length })}</small>
              {files.length > 0 ? (
                <button
                  ref={createMenuTriggerRef}
                  type="button"
                  className="room-project-section-action"
                  aria-label={t('collection.workspace.fileCreateMenuAria')}
                  aria-expanded={createMenuOpen}
                  onClick={(event) => {
                    runImpactAction(toggleFileCreateMenu, { element: event.currentTarget });
                  }}
                >
                  <Icon name={createMenuOpen ? 'x' : 'plus'} size={11} />
                  <span>{createMenuOpen ? t('collection.workspace.collapse') : t('collection.workspace.addFiles')}</span>
                </button>
              ) : null}
            </span>
          </div>
          <CreateActionSheet
            open={createMenuOpen}
            ariaLabel={t('collection.workspace.fileCreateMenuAria')}
            className="room-project-create-action-sheet"
            onClose={() => setCreateMenuOpen(false)}
          >
            <div ref={createMenuRef} className="room-project-file-quick-menu" role="menu" aria-label={t('collection.workspace.fileCreateMenuAria')}>
              <button
                type="button"
                className="room-project-file-quick-menu-item"
                role="menuitem"
                onClick={(event) => {
                  runImpactAction(handleCreateFile, { element: event.currentTarget });
                }}
              >
                <span className="room-project-file-quick-menu-item-icon" aria-hidden="true">
                  <Icon name="filePlus" size={12} />
                </span>
                <span className="room-project-file-quick-menu-item-copy">
                  <strong>{t('collection.workspace.newFile')}</strong>
                  <small>{t('collection.workspace.newFileDetail')}</small>
                </span>
              </button>
              <FileImportControl
                className="room-project-file-quick-menu-item"
                role="menuitem"
                accept={importAccept}
                disabled={importingFiles}
                multiple
                onFiles={handleImportFiles}
              >
                <span className="room-project-file-quick-menu-item-icon" aria-hidden="true">
                  <Icon name="folder" size={12} />
                </span>
                <span className="room-project-file-quick-menu-item-copy">
                  <strong>{importLabel}</strong>
                  <small>{t('collection.workspace.importFilesDetail')}</small>
                </span>
              </FileImportControl>
            </div>
          </CreateActionSheet>
          {files.length > 0 ? (
            <>
              <RoomProjectFileTree files={files} onOpenFile={onOpenFile} />
              <div className="room-project-fullscreen-file-list">
                {files.map((file) => (
                  <div
                    key={file.fileId}
                    className={`room-project-file-row ${file.isEntry ? 'room-project-file-row--entry' : ''}`}
                  >
                    <button
                      type="button"
                      className="room-project-file-row-main"
                      onClick={(event) => {
                        runImpactAction(() => onOpenFile(file.fileId), { element: event.currentTarget });
                      }}
                    >
                      <span className="room-project-file-row-icon">
                        <Icon name={file.isEntry ? 'sparkle' : 'code'} size={12} />
                      </span>
                      <span className="room-project-file-row-copy">
                        <strong>{file.path}</strong>
                        <small>{describeFileMeta(file)}</small>
                      </span>
                    </button>
                    <div className="room-project-file-row-actions">
                      <button
                        type="button"
                        className="room-project-file-row-action"
                        aria-label={t('collection.workspace.pinFileAsReferenceAria', { path: file.path })}
                        title={t('collection.workspace.pinFileAsReferenceTitle', { path: file.path })}
                        onClick={(event) => {
                          runImpactAction(() => handlePinFileAsReference(file), { element: event.currentTarget });
                        }}
                      >
                        <Icon name="pin" size={12} />
                      </button>
                      <button
                        type="button"
                        className="room-project-file-row-action"
                        aria-label={t('collection.workspace.editFileAria', { path: file.path })}
                        title={t('collection.workspace.editFileTitle', { path: file.path })}
                        onClick={(event) => {
                          runImpactAction(() => onOpenFile(file.fileId), { element: event.currentTarget });
                        }}
                      >
                        <Icon name="edit" size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="room-project-fullscreen-empty">
              <span className="room-project-fullscreen-empty-icon" aria-hidden="true">
                <Icon name="folder" size={15} />
              </span>
              <strong>{t('collection.workspace.emptyFilesTitle')}</strong>
              <div className="room-project-fullscreen-empty-actions">
                <button
                  type="button"
                  className="room-project-fullscreen-inline-action"
                  onClick={(event) => {
                    runImpactAction(handleCreateFile, { element: event.currentTarget });
                  }}
                >
                  <Icon name="filePlus" size={12} />
                  <span>{t('collection.workspace.newFile')}</span>
                </button>
                <FileImportControl
                  className="room-project-fullscreen-inline-action"
                  accept={importAccept}
                  disabled={importingFiles}
                  multiple
                  onFiles={handleImportFiles}
                >
                  <Icon name="folder" size={12} />
                  <span>{importLabel}</span>
                </FileImportControl>
              </div>
            </div>
          )}
        </section>

        <section className="room-project-fullscreen-section room-project-fullscreen-section--references">
          <div className="room-project-fullscreen-section-head">
            <span className="room-project-fullscreen-section-label">
              <Icon name="fileText" size={13} />
              <strong>{t('collection.workspace.referencesSection')}</strong>
            </span>
            <span className="room-project-fullscreen-section-tools">
              <small className="room-project-section-count">{t('collection.workspace.referenceCount', { count: referenceDocs.length })}</small>
              <button
                ref={referenceMenuTriggerRef}
                type="button"
                className="room-project-section-action"
                aria-label={t('collection.workspace.referenceCreateMenuAria')}
                aria-expanded={referenceMenuOpen}
                onClick={(event) => {
                  runImpactAction(toggleReferenceCreateMenu, { element: event.currentTarget });
                }}
              >
                <Icon name={referenceMenuOpen ? 'x' : 'plus'} size={11} />
                <span>{referenceMenuOpen ? t('collection.workspace.collapse') : t('collection.workspace.addReferences')}</span>
              </button>
            </span>
          </div>
          <CreateActionSheet
            open={referenceMenuOpen}
            ariaLabel={t('collection.workspace.referenceCreateMenuAria')}
            className="room-project-create-action-sheet"
            onClose={() => setReferenceMenuOpen(false)}
          >
            <div ref={referenceMenuRef} className="room-project-file-quick-menu" role="menu" aria-label={t('collection.workspace.referenceCreateMenuAria')}>
              <button
                type="button"
                className="room-project-file-quick-menu-item"
                role="menuitem"
                onClick={(event) => {
                  runImpactAction(handleCreateReference, { element: event.currentTarget });
                }}
              >
                <span className="room-project-file-quick-menu-item-icon" aria-hidden="true">
                  <Icon name="filePlus" size={12} />
                </span>
                <span className="room-project-file-quick-menu-item-copy">
                  <strong>{t('collection.workspace.newReference')}</strong>
                  <small>{t('collection.workspace.newReferenceDetail')}</small>
                </span>
              </button>
              <FileImportControl
                className="room-project-file-quick-menu-item"
                role="menuitem"
                accept={MEMORY_REFERENCE_DOC_ACCEPT}
                disabled={importingReferences}
                multiple
                onFiles={handleImportReferences}
              >
                <span className="room-project-file-quick-menu-item-icon" aria-hidden="true">
                  <Icon name="folder" size={12} />
                </span>
                <span className="room-project-file-quick-menu-item-copy">
                  <strong>{referenceImportLabel}</strong>
                  <small>{t('collection.workspace.importReferencesDetail')}</small>
                </span>
              </FileImportControl>
            </div>
          </CreateActionSheet>
          {referenceDocs.length > 0 ? (
            <div className="room-project-fullscreen-file-list">
              {referenceDocs.map((doc) => (
                <div key={doc.id} className="room-project-file-row">
                  <button
                    type="button"
                    className="room-project-file-row-main"
                    onClick={(event) => {
                      runImpactAction(() => handleEditReference(doc), { element: event.currentTarget });
                    }}
                  >
                    <span className="room-project-file-row-icon">
                      <Icon name="feather" size={12} />
                    </span>
                    <span className="room-project-file-row-copy">
                      <strong>{doc.title}</strong>
                      <small>{summarizeReferenceDoc(doc)}</small>
                    </span>
                  </button>
                  <div className="room-project-file-row-actions">
                    <button
                      type="button"
                      className="room-project-file-row-action"
                      aria-label={t('collection.workspace.editReferenceAria', { title: doc.title })}
                      title={t('collection.workspace.editReferenceTitle', { title: doc.title })}
                      onClick={(event) => {
                        runImpactAction(() => handleEditReference(doc), { element: event.currentTarget });
                      }}
                    >
                      <Icon name="edit" size={12} />
                    </button>
                    <button
                      type="button"
                      className="room-project-file-row-action"
                      aria-label={t('collection.workspace.deleteReferenceAria', { title: doc.title })}
                      title={t('collection.workspace.deleteReferenceTitle', { title: doc.title })}
                      onClick={(event) => {
                        runImpactAction(() => handleDeleteReference(doc), { element: event.currentTarget });
                      }}
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="room-project-fullscreen-reference-empty">
              <span className="room-project-fullscreen-reference-mark" aria-hidden="true">
                <Icon name="feather" size={14} />
              </span>
              <span>
                <strong>{t('collection.workspace.emptyReferencesTitle')}</strong>
                <small>{t('collection.workspace.emptyReferencesDetail')}</small>
              </span>
            </div>
          )}
        </section>
      </div>
      <div className="room-project-run-floating-anchor">
        <button
          type="button"
          className="room-project-run-floating-fab"
          aria-label={t('collection.workspace.runWorkspaceAria')}
          title={t('collection.workspace.runWorkspaceTitle')}
          onClick={(event) => {
            runImpactAction(() => onRunProject(project.id), { element: event.currentTarget });
          }}
        >
          <Icon name="play" size={16} />
        </button>
      </div>
      {dropActive || dropBusy ? (
        <div className={`room-project-drop-overlay ${dropBusy ? 'busy' : ''}`} aria-hidden="true">
          <span className="room-project-drop-overlay-icon">
            <Icon name="folder" size={18} />
          </span>
          <strong>{dropBusy ? t('collection.workspace.dropImporting') : t('collection.workspace.dropReleaseToImport')}</strong>
          <small>{t('collection.workspace.dropHint')}</small>
        </div>
      ) : null}
      {settingsSheet}
    </div>,
    document.body
  );
}
