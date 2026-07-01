import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveCodeCardTitle, normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import type { CodeCardSourceContext, CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import type { CodeCard } from '../../../types/domain';
import { exportCodeCardDraft } from '../cards/exportCodeCardDraft';
import { sourceLabel } from '../collectionUtils';
import { DocumentActionMenu, type DocumentActionItem } from './DocumentActionMenu';
import { TextCardWorkshopSurface } from './TextCardWorkshopSurface';
import { useI18n } from '../../../i18n';

type TextReadingWorkshopProps = {
  activeCard: CodeCard;
  activeCardOriginLabel: string | null;
  activeCardSourceContext: CodeCardSourceContext | null;
  onUpdateCard: (cardId: string, patch: Partial<CodeCard>) => void;
  onDeleteCard: (cardId: string) => void;
  onPromoteCardToProject: (cardId: string) => string | null;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
  onOpenSourceContext: (card: CodeCard) => void;
};

export function TextReadingWorkshop({
  activeCard,
  activeCardOriginLabel,
  activeCardSourceContext,
  onUpdateCard,
  onDeleteCard,
  onPromoteCardToProject,
  onPromptChatCard,
  onOpenSourceContext
}: TextReadingWorkshopProps) {
  const { t } = useI18n();
  const [titleDraft, setTitleDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const pendingAutosaveRef = useRef<(() => void) | null>(null);
  const autosaveTargetIdRef = useRef(activeCard.id);

  useEffect(() => {
    if (autosaveTargetIdRef.current === activeCard.id) return;
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
    autosaveTargetIdRef.current = activeCard.id;
  }, [activeCard.id]);

  useEffect(() => {
    setTitleDraft(activeCard.title);
    setContentDraft(activeCard.code);
  }, [activeCard]);

  const resolvedLanguage = useMemo(() => normalizeCodeLanguage(activeCard.language), [activeCard.language]);
  const draftTitle = titleDraft.trim() || deriveCodeCardTitle(contentDraft, activeCard.title, resolvedLanguage);
  const sourceMeta = `${resolvedLanguage} · ${activeCardSourceContext?.collaboratorName ?? (activeCardOriginLabel ?? sourceLabel(activeCard))}`;
  const dirty =
    titleDraft.trim() !== activeCard.title
    || contentDraft !== activeCard.code;

  const draftCard: CodeChatPromptSeed = {
    id: activeCard.id,
    title: draftTitle,
    language: resolvedLanguage,
    code: contentDraft
  };
  const canPromoteToProject = activeCard.kind !== 'tool';
  const handleDelete = useCallback(() => {
    if (!window.confirm(t('collection.workshop.deleteCardConfirm', { title: activeCard.title }))) return;
    onDeleteCard(activeCard.id);
  }, [activeCard.id, activeCard.title, onDeleteCard, t]);
  const documentActions = useMemo<DocumentActionItem[]>(() => {
    const items: DocumentActionItem[] = [];

    if (canPromoteToProject) {
      items.push({
        key: 'promote',
        label: t('collection.workshop.promoteToWorkspace'),
        onSelect: () => {
          if (!window.confirm(t('collection.workshop.promoteConfirm', { title: draftTitle }))) return;
          onPromoteCardToProject(activeCard.id);
        }
      });
    }

    items.push(
      {
        key: 'chat',
        label: t('collection.workshop.continueWritingInChat'),
        tone: 'primary',
        onSelect: () => onPromptChatCard(draftCard)
      },
      {
        key: 'export',
        label: t('collection.workshop.exportAsFile'),
        onSelect: () => exportCodeCardDraft(draftTitle, activeCard.language, contentDraft, { t })
      }
    );

    if (activeCardSourceContext) {
      items.push({
        key: 'source',
        label: t('collection.workshop.openSourceContext'),
        onSelect: () => onOpenSourceContext(activeCard)
      });
    }

    items.push({
      key: 'delete',
      label: t('collection.workshop.delete'),
      tone: 'danger',
      onSelect: () => handleDelete()
    });

    return items;
  }, [
    activeCard,
    activeCard.id,
    activeCard.language,
    activeCardSourceContext,
    canPromoteToProject,
    contentDraft,
    draftCard,
    draftTitle,
    handleDelete,
    onOpenSourceContext,
    onPromptChatCard,
    onPromoteCardToProject,
    t
  ]);

  useEffect(() => {
    if (!dirty) {
      pendingAutosaveRef.current = null;
      return;
    }

    const saveDraft = () => {
      onUpdateCard(activeCard.id, {
        title: draftTitle,
        language: activeCard.language,
        code: contentDraft,
        tags: activeCard.tags
      });
    };

    pendingAutosaveRef.current = saveDraft;

    const timeoutId = window.setTimeout(() => {
      saveDraft();
      pendingAutosaveRef.current = null;
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeCard.id,
    activeCard.language,
    activeCard.tags,
    contentDraft,
    dirty,
    draftTitle,
    onUpdateCard
  ]);

  useEffect(() => () => {
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
  }, []);

  return (
    <TextCardWorkshopSurface
      metaText={sourceMeta}
      helperText={dirty ? t('collection.workshop.autosaving') : t('collection.workshop.autosaved')}
      titleDraft={titleDraft}
      titlePlaceholder={t('collection.workshop.textTitlePlaceholder')}
      contentDraft={contentDraft}
      contentPlaceholder={t('collection.workshop.textContentPlaceholder')}
      actions={<DocumentActionMenu items={documentActions} />}
      onTitleDraftChange={setTitleDraft}
      onContentDraftChange={setContentDraft}
    />
  );
}
