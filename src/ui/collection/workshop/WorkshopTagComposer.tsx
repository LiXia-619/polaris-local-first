import { EditablePill } from '../../shell/persona/EditablePill';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n';

type WorkshopTagComposerProps = {
  tags: string[];
  draft: string;
  placeholder: string;
  onDraftChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (index: number) => void;
  onEditTag: (index: number, value: string) => void;
};

export function WorkshopTagComposer({
  tags,
  draft,
  placeholder,
  onDraftChange,
  onAddTag,
  onRemoveTag,
  onEditTag
}: WorkshopTagComposerProps) {
  const { t } = useI18n();
  const [composing, setComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const showComposer = composing || draft.trim().length > 0;

  useEffect(() => {
    if (!showComposer) return;
    inputRef.current?.focus();
  }, [showComposer]);

  const handleAddTag = () => {
    if (!draft.trim()) return;
    onAddTag();
    setComposing(false);
  };

  return (
    <div className="workshop-tag-composer">
      <div className="workshop-tag-composer-head">
        <span className="code-workshop-panel-label">{t('collection.workshop.tagCustomization')}</span>
      </div>

      <div className="workshop-tag-composer-flow" aria-label={t('collection.workshop.savedTagsAria')}>
        {tags.map((tag, index) => (
          <EditablePill
            key={`${tag}-${index}`}
            text={tag}
            display="span"
            baseClassName="workshop-tag-pill"
            editingClassName="workshop-tag-pill--edit"
            inputClassName="workshop-tag-pill-input"
            removeButtonClassName="workshop-tag-pill-remove"
            removeLabel={t('collection.workshop.removeTagAria', { tag })}
            onRemove={() => onRemoveTag(index)}
            onEdit={(value) => onEditTag(index, value)}
          />
        ))}
      </div>

      {showComposer ? (
        <div className="workshop-tag-composer-add">
          <input
            ref={inputRef}
            className="workshop-tag-composer-input"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={placeholder}
            onBlur={() => {
              if (draft.trim()) return;
              setComposing(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                handleAddTag();
                return;
              }
              if (event.key === 'Escape') {
                onDraftChange('');
                setComposing(false);
              }
            }}
          />
          <button
            type="button"
            className="workshop-tag-composer-add-btn"
            onClick={handleAddTag}
            aria-label={t('collection.workshop.addTagAria')}
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="workshop-tag-composer-trigger"
          onClick={() => setComposing(true)}
        >
          {t('collection.workshop.addTag')}
        </button>
      )}
    </div>
  );
}
