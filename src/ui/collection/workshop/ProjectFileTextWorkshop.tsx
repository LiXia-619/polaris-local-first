import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import type { CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import type { ProjectFile } from '../../../types/domain';
import { exportCodeCardDraft } from '../cards/exportCodeCardDraft';
import { DocumentActionMenu, type DocumentActionItem } from './DocumentActionMenu';
import { TextCardWorkshopSurface } from './TextCardWorkshopSurface';
import { useI18n, type I18nTranslator } from '../../../i18n';

type ProjectFileTextWorkshopProps = {
  activeProjectFile: ProjectFile;
  showHeader?: boolean;
  onUpdateProjectFile: (
    fileId: string,
    patch: Partial<Pick<ProjectFile, 'language' | 'content'>>
  ) => void;
  onDeleteProjectFile: (fileId: string) => void;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
};

function formatProjectFileRole(
  role: ProjectFile['fileRole'],
  t: I18nTranslator['t']
) {
  if (role === 'entry') return t('collection.workshop.fileRoleEntry');
  if (role === 'style') return t('collection.workshop.fileRoleStyle');
  if (role === 'logic') return t('collection.workshop.fileRoleLogic');
  if (role === 'content') return t('collection.workshop.fileRoleContent');
  if (role === 'note') return t('collection.workshop.fileRoleNote');
  if (role === 'asset-manifest') return t('collection.workshop.fileRoleAssetManifest');
  return role;
}

export function ProjectFileTextWorkshop({
  activeProjectFile,
  showHeader = true,
  onUpdateProjectFile,
  onDeleteProjectFile,
  onPromptChatCard
}: ProjectFileTextWorkshopProps) {
  const { t } = useI18n();
  const [contentDraft, setContentDraft] = useState('');
  const pendingAutosaveRef = useRef<(() => void) | null>(null);
  const autosaveTargetIdRef = useRef(activeProjectFile.id);

  useEffect(() => {
    if (autosaveTargetIdRef.current === activeProjectFile.id) return;
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
    autosaveTargetIdRef.current = activeProjectFile.id;
  }, [activeProjectFile.id]);

  useEffect(() => {
    setContentDraft(activeProjectFile.content);
  }, [activeProjectFile.content, activeProjectFile.id]);

  const resolvedLanguage = useMemo(
    () => normalizeCodeLanguage(activeProjectFile.language),
    [activeProjectFile.language]
  );
  const roleLabel = formatProjectFileRole(activeProjectFile.fileRole, t);
  const sourceMeta = [
    roleLabel,
    resolvedLanguage.toUpperCase()
  ].filter(Boolean).join(' · ');
  const dirty = contentDraft !== activeProjectFile.content;
  const draftCard: CodeChatPromptSeed = {
    id: activeProjectFile.id,
    title: activeProjectFile.filePath,
    language: resolvedLanguage,
    code: contentDraft
  };
  const handleDelete = useCallback(() => {
    if (!window.confirm(t('collection.workshop.deleteFileConfirm', { path: activeProjectFile.filePath }))) return;
    onDeleteProjectFile(activeProjectFile.id);
  }, [activeProjectFile.filePath, activeProjectFile.id, onDeleteProjectFile, t]);
  const documentActions = useMemo<DocumentActionItem[]>(() => [
    {
      key: 'chat',
      label: t('collection.workshop.continueWritingInChat'),
      tone: 'primary',
      onSelect: () => onPromptChatCard(draftCard)
    },
    {
      key: 'export',
      label: t('collection.workshop.exportAsFile'),
      onSelect: () => exportCodeCardDraft(activeProjectFile.filePath, activeProjectFile.language, contentDraft, { t })
    },
    {
      key: 'delete',
      label: t('collection.workshop.delete'),
      tone: 'danger',
      onSelect: () => handleDelete()
    }
  ], [
    activeProjectFile.filePath,
    activeProjectFile.language,
    contentDraft,
    draftCard,
    handleDelete,
    onPromptChatCard,
    t
  ]);

  useEffect(() => {
    if (!dirty) {
      pendingAutosaveRef.current = null;
      return;
    }

    const saveDraft = () => {
      onUpdateProjectFile(activeProjectFile.id, {
        language: activeProjectFile.language,
        content: contentDraft
      });
    };

    pendingAutosaveRef.current = saveDraft;

    const timeoutId = window.setTimeout(() => {
      saveDraft();
      pendingAutosaveRef.current = null;
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [activeProjectFile.id, activeProjectFile.language, contentDraft, dirty, onUpdateProjectFile]);

  useEffect(() => () => {
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
  }, []);

  return (
    <TextCardWorkshopSurface
      showHeader={showHeader}
      metaText={sourceMeta}
      helperText={dirty ? t('collection.workshop.autosaving') : t('collection.workshop.autosaved')}
      titleDraft={activeProjectFile.filePath}
      titlePlaceholder={t('collection.workshop.filePathPlaceholder')}
      titleReadOnly
      contentDraft={contentDraft}
      contentPlaceholder={t('collection.workshop.textContentPlaceholder')}
      actions={<DocumentActionMenu items={documentActions} />}
      onTitleDraftChange={() => {}}
      onContentDraftChange={setContentDraft}
    />
  );
}
