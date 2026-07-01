import { useRef, type ReactNode } from 'react';
import { useAutosizingTextarea } from './useAutosizingTextarea';

type TextCardWorkshopSurfaceProps = {
  showHeader?: boolean;
  metaText: string;
  helperText: string;
  titleDraft: string;
  titlePlaceholder: string;
  titleReadOnly?: boolean;
  contentDraft: string;
  contentPlaceholder: string;
  actions: ReactNode;
  tagSection?: ReactNode;
  onTitleDraftChange: (value: string) => void;
  onContentDraftChange: (value: string) => void;
};

export function TextCardWorkshopSurface({
  showHeader = true,
  metaText,
  helperText,
  titleDraft,
  titlePlaceholder,
  titleReadOnly = false,
  contentDraft,
  contentPlaceholder,
  actions,
  tagSection,
  onTitleDraftChange,
  onContentDraftChange
}: TextCardWorkshopSurfaceProps) {
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  useAutosizingTextarea(contentTextareaRef, contentDraft);

  return (
    <section className="text-reading-workshop">
      {showHeader ? (
        <div className="text-reading-workshop-head">
          <div className="text-reading-workshop-copy">
            <p className="text-reading-workshop-meta">{metaText}</p>
            <p className="text-reading-workshop-helper">{helperText}</p>
            <input
              className="text-reading-workshop-title-input"
              value={titleDraft}
              onChange={(event) => onTitleDraftChange(event.target.value)}
              placeholder={titlePlaceholder}
              readOnly={titleReadOnly}
            />
          </div>
        </div>
      ) : null}

      <div className="text-reading-workshop-body">
        <div className="text-reading-workshop-paper">
          <textarea
            ref={contentTextareaRef}
            className="text-reading-workshop-textarea"
            value={contentDraft}
            onChange={(event) => onContentDraftChange(event.target.value)}
            placeholder={contentPlaceholder}
            rows={18}
          />
        </div>
      </div>

      {tagSection ? <div className="text-reading-workshop-tag-section">{tagSection}</div> : null}

      <div className="text-reading-workshop-actions">
        <div className="text-reading-workshop-action-row">{actions}</div>
      </div>
    </section>
  );
}
