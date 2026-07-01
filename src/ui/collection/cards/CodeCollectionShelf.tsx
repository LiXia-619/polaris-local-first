import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { deriveCodeCardTitle, inferCodeLanguage, normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import type { ResolvedRoomProjectFile } from '../../../engines/roomProjects';
import type { DesktopLocalCommandResult, DesktopLocalCommandSession } from '../../../desktop/localHost';
import type { CollectionFileCard } from '../../../app/collection/collectionFileCards';
import type { CodeCard, Conversation, Persona, ProjectFile, RoomProject, WorkspaceReferenceDoc } from '../../../types/domain';
import type { CodeTagFilter } from '../../../app/collection/codeCollectionFilterModel';
import type { CodeCardSourceContext, CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import { CodeCardGrid } from './CodeCardGrid';
import { FileCollectionSection } from '../files/FileCollectionSection';
import { CodeCollectionEmptyState } from '../grid/CodeCollectionEmptyState';
import { CollectionShelfLead } from '../grid/CollectionShelfLead';
import { CollectionFloatingCreateAction } from '../grid/CollectionFloatingCreateAction';
import { CodeWorkshopLayer, type CodeWorkshopMode } from '../workshop/CodeWorkshopLayer';
import { Icon } from '../../Icon';
import { canUseNativeSystemFilePicker, pickNativeSystemFiles } from '../../../native/systemPickedFiles';
import { resolveDocumentFilePickerAccept } from '../../filePickerAccept';
import { runImpactAction } from '../../haptics';
import { RoomProjectFullscreen } from './RoomProjectFullscreen';
import { CodePreviewFullscreenLayer } from './CodePreviewFullscreenLayer';
import { useI18n } from '../../../i18n';

type CodeCardSaveResult = {
  cardId: string;
  created: boolean;
};

type CodeCollectionShelfProps = {
  cardsExpanded: boolean;
  isAggregateScope: boolean;
  workshopMode: CodeWorkshopMode | null;
  roomTags: string[];
  activeRoomTag: string | null;
  tagFilter: CodeTagFilter;
  standaloneCards: CodeCard[];
  renderProjectFullscreen?: boolean;
  activeProject: RoomProject | null;
  activeProjectFiles: ResolvedRoomProjectFile[];
  activeProjectReferenceDocs: WorkspaceReferenceDoc[];
  activeProjectConversations: Conversation[];
  desktopSyncBusyProjectId?: string | null;
  desktopSyncStatus?: { projectId: string; message: string; tone?: 'neutral' | 'warning' } | null;
  desktopCommand?: string;
  desktopCommandArgs?: string;
  desktopCommandBusyProjectId?: string | null;
  desktopCommandResult?: { projectId: string; result: DesktopLocalCommandResult | null; error: string | null } | null;
  desktopCommandSessions?: Array<DesktopLocalCommandSession & { projectId?: string }>;
  personas: Persona[];
  activeConversationId: string | null;
  fileCards: CollectionFileCard[];
  hasStandaloneCards: boolean;
  activeCardId: string | null;
  spotlightCardId: string | null;
  previewPresentation: 'code' | 'text' | null;
  previewItemId: string | null;
  previewProjectId: string | null;
  previewProjectFileCount: number | null;
  previewTitle: string | null;
  previewLanguage: string | null;
  previewSrcDoc: string | null;
  previewContent: string;
  resolveOriginCopy: (card: CodeCard) => string | null;
  activeCard: CodeCard | null;
  activeProjectFile: ProjectFile | null;
  activeCardOriginLabel: string | null;
  activeCardSourceContext: CodeCardSourceContext | null;
  onSaveCard: (seed: Partial<CodeCard>, editingCardId?: string | null) => CodeCardSaveResult;
  onUpdateCard: (cardId: string, patch: Partial<CodeCard>) => void;
  onToggleCardPinned: (cardId: string) => void;
  onUpdateProjectFile: (
    fileId: string,
    patch: Partial<Pick<ProjectFile, 'language' | 'content'>>
  ) => void;
  onOpenEditableItem: (itemId: string) => void;
  onOpenProjectFileEditor: (fileId: string) => void;
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
  onOpenCreate: () => void;
  onOpenProject: (projectId: string) => void;
  onToggleProjectPinned: (projectId: string) => void;
  onCreateProjectChat: (projectId: string) => void;
  onOpenProjectChat: (conversationId: string) => void;
  onDeleteProjectChat: (conversationId: string, title: string) => void;
  onPromoteCardToProject: (cardId: string) => string | null;
  onCloseProject: () => void;
  onRenameProject: (projectId: string, title: string) => boolean;
  onSetProjectPreviewStateAccess: (projectId: string, assistantReadEnabled: boolean) => boolean;
  onTagFilterChange: (value: CodeTagFilter) => void;
  onOpenChat: () => void;
  onCloseWorkshop: () => void;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
  onOpenSourceContext: (card: CodeCard) => void;
  onRunCard: (card: CodeCard) => void;
  onRunProject: (projectId: string) => void;
  onDeleteEditableItem: (itemId: string) => void;
  onDeleteProjectFile: (fileId: string) => void;
  onOpenFileSource: (card: CollectionFileCard) => void;
  onRunDraft: (seed: Partial<CodeCard>) => void;
  onDesktopCommandChange?: (value: string) => void;
  onDesktopCommandArgsChange?: (value: string) => void;
  onRunDesktopProjectCommand?: (projectId: string) => void;
  onStopDesktopProjectCommand?: (sessionId: string) => void;
  onInspectProjectChanges?: (projectId: string) => void;
  onSyncProjectFromDisk?: (projectId: string) => void;
  onSyncProjectToDisk?: (projectId: string) => void;
  onOpenDesktopLocalSettings?: () => void;
  onClosePreview: () => void;
};

export function CodeCollectionShelf({
  cardsExpanded,
  isAggregateScope,
  workshopMode,
  roomTags,
  activeRoomTag,
  tagFilter,
  standaloneCards,
  renderProjectFullscreen = true,
  activeProject,
  activeProjectFiles,
  activeProjectReferenceDocs,
  activeProjectConversations,
  desktopSyncBusyProjectId = null,
  desktopSyncStatus = null,
  desktopCommand = 'npm',
  desktopCommandArgs = 'test',
  desktopCommandBusyProjectId = null,
  desktopCommandResult = null,
  desktopCommandSessions = [],
  personas,
  activeConversationId,
  fileCards,
  hasStandaloneCards,
  activeCardId,
  spotlightCardId,
  previewPresentation,
  previewItemId,
  previewProjectId,
  previewProjectFileCount,
  previewTitle,
  previewLanguage,
  previewSrcDoc,
  previewContent,
  resolveOriginCopy,
  activeCard,
  activeProjectFile,
  activeCardOriginLabel,
  activeCardSourceContext,
  onSaveCard,
  onUpdateCard,
  onToggleCardPinned,
  onUpdateProjectFile,
  onOpenEditableItem,
  onOpenProjectFileEditor,
  onCreateProjectFile,
  onCreateWorkspaceReference,
  onImportWorkspaceReference,
  onUpdateWorkspaceReference,
  onDeleteWorkspaceReference,
  onOpenCreate,
  onOpenProject,
  onToggleProjectPinned,
  onCreateProjectChat,
  onOpenProjectChat,
  onDeleteProjectChat,
  onPromoteCardToProject,
  onCloseProject,
  onRenameProject,
  onSetProjectPreviewStateAccess,
  onTagFilterChange,
  onOpenChat,
  onCloseWorkshop,
  onPromptChatCard,
  onOpenSourceContext,
  onRunCard,
  onRunProject,
  onDeleteEditableItem,
  onDeleteProjectFile,
  onOpenFileSource,
  onRunDraft,
  onDesktopCommandChange = () => undefined,
  onDesktopCommandArgsChange = () => undefined,
  onRunDesktopProjectCommand = () => undefined,
  onStopDesktopProjectCommand = () => undefined,
  onInspectProjectChanges = () => undefined,
  onSyncProjectFromDisk = () => undefined,
  onSyncProjectToDisk = () => undefined,
  onOpenDesktopLocalSettings = () => undefined,
  onClosePreview
}: CodeCollectionShelfProps) {
  const { t, formatNumber } = useI18n();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [importingFiles, setImportingFiles] = useState(false);
  const workshopClassName = workshopMode ? `workshop-open workshop-open-${workshopMode}` : '';
  const hasCardViewItems = standaloneCards.length > 0 || fileCards.length > 0;
  const showCardsEmptyState = !hasCardViewItems;
  const activeMeta = [
    t('collection.code.shelfCardCount', { count: formatNumber(standaloneCards.length) }),
    fileCards.length > 0
      ? t('collection.code.shelfAttachmentCount', { count: formatNumber(fileCards.length) })
      : null
  ].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!workshopMode) return;
    setCreateMenuOpen(false);
  }, [workshopMode]);

  const openCreateComposer = () => {
    setCreateMenuOpen(false);
    onOpenCreate();
  };

  const importAccept = '.html,.htm,.css,.js,.ts,.tsx,.jsx,.json,.md,.txt,text/*';
  const documentImportAccept = resolveDocumentFilePickerAccept(importAccept);
  const importFileLabel = useMemo(
    () => (importingFiles ? t('collection.code.importingFiles') : t('collection.code.importFiles')),
    [importingFiles, t]
  );

  const importFiles = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    setCreateMenuOpen(false);
    if (selectedFiles.length === 0) return;
    try {
      setImportingFiles(true);
      const drafts = await Promise.all(
        selectedFiles.map(async (file) => {
          const code = await file.text();
          if (!code.trim()) return null;
          const fileStem = file.name.replace(/\.[^.]+$/, '').trim();
          const inferredLanguage = inferCodeLanguage(code, file.name.split('.').pop());
          return {
            title: fileStem || deriveCodeCardTitle(code, '未命名卡片', inferredLanguage),
            language: normalizeCodeLanguage(inferredLanguage),
            code,
            source: 'manual' as const
          } satisfies Partial<CodeCard>;
        })
      );
      drafts.filter((draft): draft is NonNullable<typeof draft> => draft !== null).forEach((draft) => {
        onSaveCard(draft);
      });
    } finally {
      setImportingFiles(false);
    }
  };
  const handleImportFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    await importFiles(files);
  };
  const openImportFiles = async () => {
    if (canUseNativeSystemFilePicker()) {
      const files = await pickNativeSystemFiles({
        accept: importAccept,
        multiple: true
      });
      await importFiles(files);
      return;
    }
    importInputRef.current?.click();
  };

  return (
    <section className={`code-collection-shelf collection-shelf-stack collection-shelf-stack--code ${workshopClassName}`.trim()}>
      <input
        ref={importInputRef}
        type="file"
        hidden
        multiple
        accept={documentImportAccept}
        onChange={handleImportFiles}
      />
      <CollectionFloatingCreateAction
        label={createMenuOpen ? t('collection.code.closeCreate') : t('collection.code.createOrImport')}
        expanded={createMenuOpen}
        disabled={isAggregateScope || Boolean(workshopMode)}
        onPress={() => setCreateMenuOpen((current) => !current)}
      >
        {createMenuOpen && !isAggregateScope && !workshopMode ? (
          <div className="code-collection-create-menu" role="menu" aria-label={t('collection.code.createMenuAria')}>
            <button
              type="button"
              className="code-collection-create-menu-item"
              role="menuitem"
              onClick={(event) => {
                runImpactAction(openCreateComposer, { element: event.currentTarget });
              }}
            >
              <span className="code-collection-create-menu-item-icon" aria-hidden="true">
                <Icon name="plus" size={12} />
              </span>
              <span className="code-collection-create-menu-item-copy">
                <strong>{t('collection.code.createNew')}</strong>
                <small>{t('collection.code.createNewDetail')}</small>
              </span>
            </button>
            <button
              type="button"
              className="code-collection-create-menu-item"
              role="menuitem"
              onClick={(event) => {
                runImpactAction(() => { void openImportFiles(); }, { element: event.currentTarget });
              }}
              disabled={importingFiles}
            >
              <span className="code-collection-create-menu-item-icon" aria-hidden="true">
                <Icon name="folder" size={12} />
              </span>
              <span className="code-collection-create-menu-item-copy">
                <strong>{importFileLabel}</strong>
                <small>{t('collection.code.importFilesDetail')}</small>
              </span>
            </button>
          </div>
        ) : null}
      </CollectionFloatingCreateAction>

      <CodeWorkshopLayer
        mode={workshopMode}
        roomTags={roomTags}
        activeRoomTag={activeRoomTag}
        activeCard={activeCard}
        activeProjectFile={activeProjectFile}
        activeCardOriginLabel={activeCardOriginLabel}
        activeCardSourceContext={activeCardSourceContext}
        onClose={onCloseWorkshop}
        onOpenCreate={onOpenCreate}
        onSaveCard={onSaveCard}
        onUpdateCard={onUpdateCard}
        onUpdateProjectFile={onUpdateProjectFile}
        onDeleteCard={onDeleteEditableItem}
        onDeleteProjectFile={onDeleteProjectFile}
        onPromoteCardToProject={onPromoteCardToProject}
        onRunDraft={onRunDraft}
        onPromptChatCard={onPromptChatCard}
        onOpenSourceContext={onOpenSourceContext}
      />

      <div className="code-collection-view-page-scroll">
        <CollectionShelfLead
          meta={activeMeta}
          helpText={t('collection.code.shelfHelp')}
        />
        <div className="code-collection-grid-stage">
          <CodeCardGrid
            cardsExpanded={cardsExpanded}
            viewMode="cards"
            leadingCard={undefined}
            roomTags={roomTags}
            cards={standaloneCards}
            projectFiles={[]}
            roomProjects={[]}
            activeCardId={activeCardId}
            spotlightCardId={spotlightCardId}
            resolveOriginCopy={resolveOriginCopy}
            onOpenProject={onOpenProject}
            onOpenCard={onOpenEditableItem}
            onRunCard={onRunCard}
            onDeleteCard={onDeleteEditableItem}
            onToggleCardPinned={onToggleCardPinned}
            onToggleProjectPinned={onToggleProjectPinned}
          />
        </div>

        {showCardsEmptyState ? (
          <CodeCollectionEmptyState
            aggregateScope={isAggregateScope}
            hasSavedCards={hasStandaloneCards}
            tagFilter={tagFilter}
            onOpenChat={onOpenChat}
          />
        ) : null}

        {fileCards.length > 0 ? (
          <FileCollectionSection
            cardsExpanded={cardsExpanded}
            cards={fileCards}
            showLead={standaloneCards.length > 0}
            onOpenFileSource={onOpenFileSource}
          />
        ) : null}
      </div>

      <CodePreviewFullscreenLayer
        previewPresentation={previewPresentation}
        previewItemId={previewItemId}
        previewProjectId={previewProjectId}
        previewProjectFileCount={previewProjectFileCount}
        previewTitle={previewTitle}
        previewLanguage={previewLanguage}
        previewSrcDoc={previewSrcDoc}
        previewContent={previewContent}
        onClosePreview={onClosePreview}
      />

      {renderProjectFullscreen && activeProject ? (
        <RoomProjectFullscreen
          project={activeProject}
          files={activeProjectFiles}
          referenceDocs={activeProjectReferenceDocs}
          conversations={activeProjectConversations}
          personas={personas}
          activeConversationId={activeConversationId}
          desktopLocalBusy={desktopSyncBusyProjectId === activeProject.id}
          desktopLocalStatus={desktopSyncStatus?.projectId === activeProject.id ? desktopSyncStatus.message : null}
          desktopLocalStatusTone={desktopSyncStatus?.projectId === activeProject.id ? desktopSyncStatus.tone ?? 'neutral' : 'neutral'}
          desktopCommand={desktopCommand}
          desktopCommandArgs={desktopCommandArgs}
          desktopCommandBusy={
            desktopCommandBusyProjectId === activeProject.id
            || desktopCommandSessions.some((session) => session.projectId === activeProject.id && session.status === 'running')
          }
          desktopCommandResult={desktopCommandResult?.projectId === activeProject.id ? desktopCommandResult : null}
          desktopCommandSessions={desktopCommandSessions.filter((session) => session.projectId === activeProject.id)}
          onClose={onCloseProject}
          onOpenFile={onOpenProjectFileEditor}
          onCreateProjectFile={onCreateProjectFile}
          onCreateWorkspaceReference={onCreateWorkspaceReference}
          onImportWorkspaceReference={onImportWorkspaceReference}
          onUpdateWorkspaceReference={onUpdateWorkspaceReference}
          onDeleteWorkspaceReference={onDeleteWorkspaceReference}
          onCreateProjectChat={() => onCreateProjectChat(activeProject.id)}
          onOpenProjectChat={onOpenProjectChat}
          onDeleteProjectChat={onDeleteProjectChat}
          onRenameProject={onRenameProject}
          onSetProjectPreviewStateAccess={onSetProjectPreviewStateAccess}
          onRunProject={onRunProject}
          onDesktopCommandChange={onDesktopCommandChange}
          onDesktopCommandArgsChange={onDesktopCommandArgsChange}
          onRunDesktopProjectCommand={onRunDesktopProjectCommand}
          onStopDesktopProjectCommand={onStopDesktopProjectCommand}
          onInspectProjectChanges={onInspectProjectChanges}
          onSyncProjectFromDisk={onSyncProjectFromDisk}
          onSyncProjectToDisk={onSyncProjectToDisk}
          onOpenDesktopLocalSettings={onOpenDesktopLocalSettings}
        />
      ) : null}
    </section>
  );
}
