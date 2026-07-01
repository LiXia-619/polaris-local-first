import { memo, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import {
  DEFAULT_CODE_CARD_FACE_ROOT_SCOPE,
  buildScopedCodeCardFaceCss,
  resolveCodeCardFaceType
} from '../../../engines/collectionCardFace';
import { useI18n } from '../../../i18n';
import type { CodeCard } from '../../../types/domain';
import { codePreview, collectionRelativeDateLabel, sourceLabel } from '../collectionUtils';
import { cleanDisplayText } from '../../text/displayText';
import { CodeCardMarkdownPreview } from './CodeCardMarkdownPreview';
import { ScopedCardFaceStyle } from './ScopedCardFaceStyle';

type CodeCardFaceProps = Omit<ComponentPropsWithoutRef<'article'>, 'className' | 'children'> & {
  card: CodeCard;
  tags: string[];
  cardNote?: string | null;
  scopedFaceRoot?: string;
  editing?: boolean;
  active?: boolean;
  spotlight?: boolean;
  renderScopedFaceStyle?: boolean;
  className?: string;
  leadingControls?: ReactNode;
  trailingControls?: ReactNode;
  resolveTagClassName?: (tag: string) => string | undefined;
};

function deriveCardPreview(card: CodeCard): string | null {
  const preview = codePreview(card).trim();
  return preview ? preview : null;
}

export const CodeCardFace = memo(function CodeCardFace({
  card,
  tags,
  cardNote,
  scopedFaceRoot = DEFAULT_CODE_CARD_FACE_ROOT_SCOPE,
  editing = false,
  active = false,
  spotlight = false,
  renderScopedFaceStyle = true,
  className,
  leadingControls,
  trailingControls,
  resolveTagClassName,
  ...articleProps
}: CodeCardFaceProps) {
  const { language, t } = useI18n();
  const scopedFaceCss = useMemo(
    () => buildScopedCodeCardFaceCss(card.id, card.cardFaceCss, scopedFaceRoot),
    [card.cardFaceCss, card.id, scopedFaceRoot]
  );
  const hasCustomFace = Boolean(card.cardFaceCss?.trim());
  const faceType = resolveCodeCardFaceType(card);
  const renderMarkdownPreview = faceType === 'text';
  const displayTitle = useMemo(() => cleanDisplayText(card.title), [card.title]);
  const displayCardNote = useMemo(() => cardNote ? cleanDisplayText(cardNote) : null, [cardNote]);
  const preview = useMemo(
    () => {
      const derived = deriveCardPreview(card);
      return derived ? cleanDisplayText(derived) : null;
    },
    [card.code]
  );
  const articleClassName = [
    'card code-card actionable-card',
    hasCustomFace ? 'code-card-custom-face' : 'code-card-default-face',
    renderMarkdownPreview ? 'code-card-text-face' : '',
    editing ? 'editing' : 'viewing',
    active ? 'active' : '',
    card.pinnedAt ? 'pinned' : '',
    spotlight ? 'ai-spotlight-card' : '',
    className ?? ''
  ].filter(Boolean).join(' ');

  return (
    <article
      {...articleProps}
      className={articleClassName}
      data-polaris-card-id={card.id}
    >
      {renderScopedFaceStyle && scopedFaceCss ? (
        <ScopedCardFaceStyle ownerId={`code-card-face:${scopedFaceRoot}:${card.id}`} cssText={scopedFaceCss} />
      ) : null}
      {leadingControls}
      <div className="code-card-main">
        <div className="card-meta-row">
          <small>{sourceLabel(card).toUpperCase()}</small>
          <small className={card.pinnedAt ? 'code-card-pinned-label' : undefined}>
            {card.pinnedAt ? t('common.pinned') : collectionRelativeDateLabel(card.updatedAt, language)}
          </small>
        </div>
        <h3>{displayTitle}</h3>
        {displayCardNote ? <p className="code-card-origin">{displayCardNote}</p> : null}
        {preview ? (
          renderMarkdownPreview
            ? <CodeCardMarkdownPreview content={preview} title={displayTitle} />
            : <pre className="code-card-snippet">{preview}</pre>
        ) : null}
        <div className="tags">
          {tags.map((tag) => (
            <span key={tag} className={resolveTagClassName?.(tag)}>{tag}</span>
          ))}
        </div>
      </div>
      {trailingControls}
    </article>
  );
});
