import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveCodeCardTitle, inferCodeLanguage, normalizeCodeLanguage } from '../../../engines/codeCardEngine';
import type { CodeCard } from '../../../types/domain';
import { BLANK_CARD_SNIPPET } from '../collectionUtils';
import { DocumentActionMenu, type DocumentActionItem } from './DocumentActionMenu';
import { RoomTagPicker } from './RoomTagPicker';
import { WorkshopTagComposer } from './WorkshopTagComposer';
import { addRoomTag, editRoomTag, removeRoomTag, toggleRoomTag } from './roomTagDraft';
import { useI18n } from '../../../i18n';

type CreateCodeWorkshopProps = {
  roomTags: string[];
  activeRoomTag: string | null;
  onSaveCard: (seed: Partial<CodeCard>, editingCardId?: string | null) => { cardId: string; created: boolean };
  onRunDraft: (seed: Partial<CodeCard>) => void;
};

const CREATE_DRAFT_STORAGE_KEY = 'polaris.codeWorkshop.createDraft';

function loadDraft() {
  if (typeof window === 'undefined') return '';
  const savedDraft = window.sessionStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
  if (!savedDraft || savedDraft === BLANK_CARD_SNIPPET) return '';
  return savedDraft;
}

export function CreateCodeWorkshop({
  roomTags,
  activeRoomTag,
  onSaveCard,
  onRunDraft
}: CreateCodeWorkshopProps) {
  const { t } = useI18n();
  const codeEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const cardFaceEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [codeDraft, setCodeDraft] = useState(loadDraft);
  const [cardFaceCssDraft, setCardFaceCssDraft] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(activeRoomTag ? [activeRoomTag] : []);
  const [manualTagDraft, setManualTagDraft] = useState('');
  const [showCardFaceEditor, setShowCardFaceEditor] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!codeDraft.trim() || codeDraft === BLANK_CARD_SNIPPET) {
      window.sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(CREATE_DRAFT_STORAGE_KEY, codeDraft);
  }, [codeDraft]);

  useEffect(() => {
    setSelectedTags((current) => {
      if (current.length > 0) return current;
      return activeRoomTag ? [activeRoomTag] : [];
    });
  }, [activeRoomTag]);

  const previewLanguage = useMemo(
    () => inferCodeLanguage(codeDraft),
    [codeDraft]
  );
  const previewTitle = useMemo(
    () => deriveCodeCardTitle(codeDraft, '未命名卡片', previewLanguage),
    [codeDraft, previewLanguage]
  );
  const languageBadge = useMemo(
    () => normalizeCodeLanguage(previewLanguage).toUpperCase(),
    [previewLanguage]
  );
  const canSave = Boolean(codeDraft.trim());

  useEffect(() => {
    const editor = codeEditorRef.current;
    if (!editor) return;
    editor.style.height = '0px';
    editor.style.height = `${Math.max(editor.scrollHeight, 360)}px`;
  }, [codeDraft]);

  useEffect(() => {
    const editor = cardFaceEditorRef.current;
    if (!editor || !showCardFaceEditor) return;
    editor.style.height = '0px';
    editor.style.height = `${Math.max(editor.scrollHeight, 148)}px`;
  }, [cardFaceCssDraft, showCardFaceEditor]);

  const tagSection = (
    <div className="create-code-workshop-tag-section">
      <WorkshopTagComposer
        tags={selectedTags}
        draft={manualTagDraft}
        placeholder={t('collection.workshop.manualTagPlaceholder')}
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
            onToggleTag={(tag) => setSelectedTags((current) => toggleRoomTag(current, tag))}
          />
        </div>
      ) : null}
    </div>
  );

  const handleCreate = useCallback(() => {
    if (!canSave) return;
    onSaveCard({
      title: previewTitle,
      language: normalizeCodeLanguage(previewLanguage),
      code: codeDraft,
      cardFaceCss: cardFaceCssDraft,
      tags: selectedTags,
      source: 'manual'
    });
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
    }
    setCodeDraft('');
    setCardFaceCssDraft('');
    setManualTagDraft('');
    setShowCardFaceEditor(false);
  }, [
    canSave,
    cardFaceCssDraft,
    codeDraft,
    onSaveCard,
    previewLanguage,
    previewTitle,
    selectedTags
  ]);

  const handleRunDraft = useCallback(() => {
    if (!canSave) return;
    onRunDraft({
      title: previewTitle,
      language: normalizeCodeLanguage(previewLanguage),
      code: codeDraft,
      cardFaceCss: cardFaceCssDraft,
      tags: selectedTags
    });
  }, [
    canSave,
    cardFaceCssDraft,
    codeDraft,
    onRunDraft,
    previewLanguage,
    previewTitle,
    selectedTags
  ]);

  const documentActions = useMemo<DocumentActionItem[]>(() => [
    {
      key: 'create',
      label: t('collection.workshop.createCard'),
      tone: 'primary',
      disabled: !canSave,
      onSelect: handleCreate
    },
    {
      key: 'preview',
      label: t('collection.workshop.runPreview'),
      tone: 'primary',
      disabled: !canSave,
      onSelect: handleRunDraft
    },
    {
      key: 'card-face',
      label: showCardFaceEditor ? t('collection.workshop.collapseCardFaceCss') : t('collection.workshop.editCardFaceCss'),
      onSelect: () => setShowCardFaceEditor((current) => !current)
    }
  ], [canSave, handleCreate, handleRunDraft, showCardFaceEditor, t]);

  return (
    <section className="create-code-workshop create-code-workshop--editor">
      <DocumentActionMenu items={documentActions} />

      <div className="create-code-workshop-head">
        <div className="create-code-workshop-head-copy">
          <strong className="create-code-workshop-derived-title">{previewTitle}</strong>
          <span className="create-code-workshop-derived-language">{languageBadge}</span>
        </div>
      </div>

      <div className="create-code-workshop-editor-shell">
        <textarea
          ref={codeEditorRef}
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

      {showCardFaceEditor ? (
        <div className="create-code-workshop-card-face">
          <div className="create-code-workshop-card-face-head">
            <span className="code-workshop-panel-label">{t('collection.workshop.cardFaceCss')}</span>
          </div>
          <textarea
            ref={cardFaceEditorRef}
            className="create-code-workshop-card-face-textarea"
            value={cardFaceCssDraft}
            onChange={(event) => setCardFaceCssDraft(event.target.value)}
            placeholder={`& {\n  background: linear-gradient(180deg, rgba(255, 249, 245, 0.98), rgba(255, 243, 240, 0.94));\n}\n\n& h3 {\n  color: #5b3a36;\n}`}
            rows={7}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      ) : null}

      {tagSection}
    </section>
  );
}
