import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCodeCardPreview, deriveCodeCardTitle, inferCodeLanguage, normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import type { CodeChatPromptSeed } from '../../../app/collection/codeCollectionSource';
import type { CodeCard } from '../../../types/domain';
import { CodeRunFullscreen } from './CodeRunFullscreen';
import { exportCodeCardDraft } from '../cards/exportCodeCardDraft';
import { BLANK_CARD_SNIPPET } from '../collectionUtils';
import { DocumentActionMenu, type DocumentActionItem } from './DocumentActionMenu';
import { RoomTagPicker } from './RoomTagPicker';
import { WorkshopTagComposer } from './WorkshopTagComposer';
import { addRoomTag, editRoomTag, removeRoomTag, toggleRoomTag } from './roomTagDraft';
import { useAutosizingTextarea } from './useAutosizingTextarea';
import { useI18n } from '../../../i18n';

type CodeWorkshopProps = {
  activeCard: CodeCard;
  roomTags: string[];
  onUpdateCard: (cardId: string, patch: Partial<CodeCard>) => void;
  onPromoteCardToProject: (cardId: string) => string | null;
  onPromptChatCard: (card?: CodeChatPromptSeed | null) => void;
};

export function CodeWorkshop({
  activeCard,
  roomTags,
  onUpdateCard,
  onPromoteCardToProject,
  onPromptChatCard
}: CodeWorkshopProps) {
  const { t } = useI18n();
  const [titleDraft, setTitleDraft] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [manualTagDraft, setManualTagDraft] = useState('');
  const [codeDraft, setCodeDraft] = useState('');
  const [cardFaceCssDraft, setCardFaceCssDraft] = useState('');
  const [showCardFaceEditor, setShowCardFaceEditor] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const cardFaceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingAutosaveRef = useRef<(() => void) | null>(null);
  const autosaveTargetIdRef = useRef(activeCard.id);

  const initialDerivedTitle = useMemo(
    () => deriveCodeCardTitle(activeCard.code, '未命名卡片', activeCard.language),
    [activeCard.code, activeCard.language]
  );

  useEffect(() => {
    if (autosaveTargetIdRef.current === activeCard.id) return;
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
    autosaveTargetIdRef.current = activeCard.id;
  }, [activeCard.id]);

  useEffect(() => {
    setTitleDraft(activeCard.title === initialDerivedTitle ? '' : activeCard.title);
    setSelectedTags(activeCard.tags);
    setManualTagDraft('');
    setCodeDraft(activeCard.code === BLANK_CARD_SNIPPET ? '' : activeCard.code);
    setCardFaceCssDraft(activeCard.cardFaceCss ?? '');
    setShowCardFaceEditor(Boolean(activeCard.cardFaceCss?.trim()));
  }, [activeCard.id, activeCard.cardFaceCss, activeCard.code, activeCard.tags, activeCard.title, initialDerivedTitle]);

  const resolvedLanguage = useMemo(
    () => inferCodeLanguage(codeDraft, activeCard.language),
    [activeCard.language, codeDraft]
  );
  const impliedCodeDraft = useMemo(
    () => (!codeDraft.trim() ? BLANK_CARD_SNIPPET : codeDraft),
    [codeDraft]
  );
  const impliedTitle = useMemo(
    () => deriveCodeCardTitle(impliedCodeDraft, '未命名卡片', resolvedLanguage),
    [impliedCodeDraft, resolvedLanguage]
  );
  const draftTitle = titleDraft.trim() || impliedTitle;
  const languageBadge = useMemo(
    () => normalizeCodeLanguage(resolvedLanguage).toUpperCase(),
    [resolvedLanguage]
  );
  const draftCard: CodeChatPromptSeed = {
    id: activeCard.id,
    title: draftTitle,
    language: normalizeCodeLanguage(resolvedLanguage),
    code: codeDraft,
    cardFaceCss: cardFaceCssDraft.trim() || undefined
  };
  const showTagSection = true;
  const showCardFaceControls = true;
  const canPromoteToProject = activeCard.kind !== 'tool';
  const normalizedActiveCode = activeCard.code === BLANK_CARD_SNIPPET ? '' : activeCard.code;
  const canPreview = Boolean(codeDraft.trim());
  const canExport = Boolean(codeDraft.trim());
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

    if (showCardFaceControls) {
      items.push({
        key: 'card-face',
        label: showCardFaceEditor ? t('collection.workshop.collapseCardFaceCss') : t('collection.workshop.editCardFaceCss'),
        onSelect: () => setShowCardFaceEditor((current) => !current)
      });
    }

    items.push(
      {
        key: 'export',
        label: t('collection.workshop.export'),
        disabled: !canExport,
        onSelect: () => exportCodeCardDraft(draftTitle, resolvedLanguage, codeDraft, { t })
      },
      {
        key: 'preview',
        label: t('collection.workshop.runPreview'),
        disabled: !canPreview,
        tone: 'primary',
        onSelect: () => setFullscreenOpen(true)
      },
      {
        key: 'chat',
        label: t('collection.workshop.continueEditingInChat'),
        disabled: !canPreview,
        tone: 'primary',
        onSelect: () => onPromptChatCard(draftCard)
      }
    );

    return items;
  }, [
    activeCard.id,
    canExport,
    canPreview,
    canPromoteToProject,
    codeDraft,
    draftCard,
    draftTitle,
    onPromptChatCard,
    onPromoteCardToProject,
    resolvedLanguage,
    showCardFaceControls,
    showCardFaceEditor,
    t
  ]);

  useAutosizingTextarea(cardFaceTextareaRef, cardFaceCssDraft);

  useEffect(() => {
    const nextTitle = draftTitle;
    const nextLanguage = normalizeCodeLanguage(resolvedLanguage);
    const nextCode = codeDraft;
    const needsSave =
      nextTitle !== activeCard.title
      || nextCode !== normalizedActiveCode
      || nextLanguage !== activeCard.language
      || (cardFaceCssDraft.trim() || '') !== (activeCard.cardFaceCss?.trim() || '')
      || selectedTags.join('::') !== activeCard.tags.join('::');

    if (!needsSave) {
      pendingAutosaveRef.current = null;
      return;
    }

    const saveDraft = () => {
      onUpdateCard(activeCard.id, {
        title: nextTitle,
        language: nextLanguage,
        code: nextCode,
        cardFaceCss: cardFaceCssDraft,
        tags: selectedTags
      });
    };

    pendingAutosaveRef.current = saveDraft;

    const timeoutId = window.setTimeout(() => {
      saveDraft();
      pendingAutosaveRef.current = null;
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeCard.cardFaceCss,
    activeCard.id,
    activeCard.language,
    activeCard.tags,
    activeCard.title,
    cardFaceCssDraft,
    codeDraft,
    draftTitle,
    normalizedActiveCode,
    onUpdateCard,
    resolvedLanguage,
    selectedTags
  ]);

  useEffect(() => () => {
    pendingAutosaveRef.current?.();
    pendingAutosaveRef.current = null;
  }, []);

  return (
    <>
      <section className="code-workshop create-code-workshop create-code-workshop--editor">
        {!fullscreenOpen ? <DocumentActionMenu items={documentActions} /> : null}

        <div className="create-code-workshop-head">
          <div className="create-code-workshop-head-copy">
            <strong className="create-code-workshop-derived-title">{draftTitle}</strong>
            <span className="create-code-workshop-derived-language">{languageBadge}</span>
          </div>
        </div>

        <div className="create-code-workshop-editor-shell">
          <textarea
            className="create-code-workshop-editor"
            value={codeDraft}
            onChange={(event) => setCodeDraft(event.target.value)}
            placeholder={BLANK_CARD_SNIPPET}
            rows={20}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {showCardFaceControls && showCardFaceEditor ? (
          <div className="create-code-workshop-card-face">
            <div className="create-code-workshop-card-face-head">
              <span className="code-workshop-panel-label">{t('collection.workshop.cardFaceCss')}</span>
            </div>
            <textarea
              ref={cardFaceTextareaRef}
              className="create-code-workshop-card-face-textarea"
              value={cardFaceCssDraft}
              onChange={(event) => setCardFaceCssDraft(event.target.value)}
              placeholder={`& {\n  background: linear-gradient(180deg, rgba(248, 252, 255, 0.98), rgba(232, 240, 255, 0.94));\n}\n\n& h3 {\n  color: #28405c;\n}`}
              rows={7}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        ) : null}

        {showTagSection ? (
          <div className="create-code-workshop-tag-section">
            <WorkshopTagComposer
              tags={selectedTags}
              draft={manualTagDraft}
              placeholder={t('collection.workshop.tagPlaceholder')}
              onDraftChange={setManualTagDraft}
              onAddTag={() => {
                setSelectedTags((current) => addRoomTag(current, manualTagDraft));
                setManualTagDraft('');
              }}
              onRemoveTag={(index) => setSelectedTags((current) => removeRoomTag(current, index))}
              onEditTag={(index, value) => setSelectedTags((current) => editRoomTag(current, index, value))}
            />
            {roomTags.length > 0 ? (
              <div className="create-code-workshop-tag-suggestions">
                <span className="create-code-workshop-tag-suggestions-label">{t('collection.workshop.commonTags')}</span>
                <RoomTagPicker
                  roomTags={roomTags}
                  selectedTags={selectedTags}
                  onToggleTag={(tag: string) => setSelectedTags((current) => toggleRoomTag(current, tag))}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {fullscreenOpen ? (
        <CodeRunFullscreen
          cardId={activeCard.id}
          title={draftTitle}
          srcDoc={buildCodeCardPreview(resolvedLanguage, codeDraft)}
          code={codeDraft}
          onClose={() => setFullscreenOpen(false)}
        />
      ) : null}
    </>
  );
}
