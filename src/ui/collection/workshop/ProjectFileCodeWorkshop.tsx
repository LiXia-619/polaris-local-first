import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCodeCardPreview, inferCodeLanguage, normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import type { CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import type { ProjectFile } from '../../../types/domain';
import { CodeRunFullscreen } from './CodeRunFullscreen';
import { exportCodeCardDraft } from '../cards/exportCodeCardDraft';
import { DocumentActionMenu, type DocumentActionItem } from './DocumentActionMenu';
import { useI18n } from '../../../i18n';

type ProjectFileCodeWorkshopProps = {
  activeProjectFile: ProjectFile;
  showHeader?: boolean;
  onUpdateProjectFile: (
    fileId: string,
    patch: Partial<Pick<ProjectFile, 'language' | 'content'>>
  ) => void;
  onDeleteProjectFile: (fileId: string) => void;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
};

export function ProjectFileCodeWorkshop({
  activeProjectFile,
  showHeader = true,
  onUpdateProjectFile,
  onDeleteProjectFile,
  onPromptChatCard
}: ProjectFileCodeWorkshopProps) {
  const { t } = useI18n();
  const [codeDraft, setCodeDraft] = useState('');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const pendingAutosaveRef = useRef<(() => void) | null>(null);
  const autosaveTargetIdRef = useRef(activeProjectFile.id);

  useEffect(() => {
    if (autosaveTargetIdRef.current === activeProjectFile.id) return;
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
    autosaveTargetIdRef.current = activeProjectFile.id;
  }, [activeProjectFile.id]);

  useEffect(() => {
    setCodeDraft(activeProjectFile.content);
  }, [activeProjectFile.content, activeProjectFile.id]);

  const resolvedLanguage = useMemo(
    () => inferCodeLanguage(codeDraft, activeProjectFile.language),
    [activeProjectFile.language, codeDraft]
  );
  const languageBadge = useMemo(
    () => normalizeCodeLanguage(resolvedLanguage).toUpperCase(),
    [resolvedLanguage]
  );
  const draftCard: CodeChatPromptSeed = {
    id: activeProjectFile.id,
    title: activeProjectFile.filePath,
    language: normalizeCodeLanguage(resolvedLanguage),
    code: codeDraft
  };
  const canPreview = Boolean(codeDraft.trim());
  const canExport = Boolean(codeDraft.trim());
  const handleDelete = useCallback(() => {
    if (!window.confirm(t('collection.workshop.deleteFileConfirm', { path: activeProjectFile.filePath }))) return;
    onDeleteProjectFile(activeProjectFile.id);
  }, [activeProjectFile.filePath, activeProjectFile.id, onDeleteProjectFile, t]);
  const documentActions = useMemo<DocumentActionItem[]>(() => [
    {
      key: 'export',
      label: t('collection.workshop.export'),
      disabled: !canExport,
      onSelect: () => exportCodeCardDraft(activeProjectFile.filePath, resolvedLanguage, codeDraft, { t })
    },
    {
      key: 'chat',
      label: t('collection.workshop.continueWritingInChat'),
      tone: 'primary',
      onSelect: () => onPromptChatCard(draftCard)
    },
    {
      key: 'preview',
      label: t('collection.workshop.runPreview'),
      disabled: !canPreview,
      tone: 'primary',
      onSelect: () => setFullscreenOpen(true)
    },
    {
      key: 'delete',
      label: t('collection.workshop.delete'),
      tone: 'danger',
      onSelect: () => handleDelete()
    }
  ], [
    activeProjectFile.filePath,
    canExport,
    canPreview,
    codeDraft,
    draftCard,
    handleDelete,
    onPromptChatCard,
    resolvedLanguage,
    t
  ]);

  useEffect(() => {
    const nextLanguage = normalizeCodeLanguage(resolvedLanguage);
    const needsSave =
      nextLanguage !== activeProjectFile.language
      || codeDraft !== activeProjectFile.content;

    if (!needsSave) {
      pendingAutosaveRef.current = null;
      return;
    }

    const saveDraft = () => {
      onUpdateProjectFile(activeProjectFile.id, {
        language: nextLanguage,
        content: codeDraft
      });
    };

    pendingAutosaveRef.current = saveDraft;

    const timeoutId = window.setTimeout(() => {
      saveDraft();
      pendingAutosaveRef.current = null;
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeProjectFile.content,
    activeProjectFile.id,
    activeProjectFile.language,
    codeDraft,
    onUpdateProjectFile,
    resolvedLanguage
  ]);

  useEffect(() => () => {
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
  }, []);

  return (
    <>
      <section className="code-workshop create-code-workshop create-code-workshop--editor">
        {!fullscreenOpen ? <DocumentActionMenu items={documentActions} /> : null}

        {showHeader ? (
          <div className="create-code-workshop-head">
            <div className="create-code-workshop-head-copy">
              <strong className="create-code-workshop-derived-title">{activeProjectFile.filePath}</strong>
              <span className="create-code-workshop-derived-language">{languageBadge}</span>
            </div>
          </div>
        ) : null}

        <div className="create-code-workshop-editor-shell">
          <textarea
            className="create-code-workshop-editor"
            value={codeDraft}
            onChange={(event) => setCodeDraft(event.target.value)}
            placeholder=""
            rows={20}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </section>

      {fullscreenOpen ? (
        <CodeRunFullscreen
          cardId={activeProjectFile.id}
          title={activeProjectFile.filePath}
          srcDoc={buildCodeCardPreview(resolvedLanguage, codeDraft)}
          code={codeDraft}
          onClose={() => setFullscreenOpen(false)}
        />
      ) : null}
    </>
  );
}
