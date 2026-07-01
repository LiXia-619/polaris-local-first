import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useI18n, type I18nTranslator } from '../../../../i18n';
import type { ChatCardReference, CodeCard } from '../../../../types/domain';
import { CodeCardFace } from '../../../collection/cards/CodeCardFace';
import { Icon } from '../../../Icon';
import { runSelectionAction } from '../../../haptics';
import { cleanDisplayText } from '../../../text/displayText';
import { MessageMarkdown } from './MessageMarkdown';

type MessageCardReferenceProps = {
  reference: ChatCardReference;
  card?: CodeCard | null;
  tone?: 'attached' | 'created';
  onOpen?: () => void;
  onRun?: () => void;
};

function summarizeCardCode(code: string, emptyLabel: string) {
  const lines = code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return emptyLabel;
  return lines.slice(0, 2).join(' ');
}

function resolveModeLabel(mode: ChatCardReference['mode'], t: I18nTranslator['t']) {
  return mode === 'continue' ? t('collection.card.modeContinue') : t('collection.card.modeReference');
}

function shouldRenderAsMarkdown(language: string) {
  const normalized = language.trim().toLowerCase();
  return normalized === 'markdown' || normalized === 'md';
}

function cardDisplayTags(card: CodeCard) {
  return [card.language, ...card.tags.filter((tag) => tag !== card.language)].slice(0, 4);
}

export function MessageCardReference({
  reference,
  card = null,
  tone = 'attached',
  onOpen,
  onRun
}: MessageCardReferenceProps) {
  const { t } = useI18n();
  const languageLabel = (reference.language || 'text').toUpperCase();
  const displayReferenceTitle = cleanDisplayText(reference.title);
  const [expanded, setExpanded] = useState(false);
  const hasCardFace = Boolean(card);
  const showActions = !hasCardFace && Boolean(onOpen || onRun);
  const renderMarkdown = shouldRenderAsMarkdown(reference.language);
  const toggleExpanded = (element: HTMLElement) => {
    runSelectionAction(() => setExpanded((value) => !value), { element });
  };
  const activateCardFace = (element: HTMLElement) => {
    const action = onRun ?? onOpen;
    if (!action) return;
    runSelectionAction(action, { element });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleExpanded(event.currentTarget);
  };
  const handleCardFaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activateCardFace(event.currentTarget);
  };
  const containPointerInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  const containClickInteraction = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };
  const renderCardFace = card ? (() => {
    const cardNote = card.cardNote?.trim();
    const tags = cardDisplayTags(card);

    return (
      <div className="message-card-reference-face">
        <CodeCardFace
          card={card}
          tags={tags}
          cardNote={cardNote}
          scopedFaceRoot=".message-card-reference-face"
          role="button"
          tabIndex={0}
          aria-label={t('collection.card.runAria', { title: cleanDisplayText(card.title) })}
          onClick={(event) => {
            event.stopPropagation();
            activateCardFace(event.currentTarget);
          }}
          onKeyDown={handleCardFaceKeyDown}
          trailingControls={onOpen ? (
            <button
              type="button"
              className="code-card-run-dot"
              aria-label={t('collection.card.editAria', { title: cleanDisplayText(card.title) })}
              onClick={(event) => {
                event.stopPropagation();
                runSelectionAction(onOpen, { element: event.currentTarget });
              }}
            >
              <Icon name="edit" size={12} />
            </button>
          ) : null}
        />
      </div>
    );
  })() : null;

  return (
    <div
      className={`message-card-reference message-card-reference--${tone} ${hasCardFace ? 'message-card-reference--face collection collection-card-token-scope' : ''} ${expanded ? 'expanded' : 'collapsed'}`}
      aria-label={tone === 'created' ? t('collection.card.inConversationAria') : t('collection.card.attachedAria')}
      onPointerDownCapture={containPointerInteraction}
      onClick={containClickInteraction}
    >
      {renderCardFace ?? (
        <div
          className="message-card-reference-hitbox"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            toggleExpanded(event.currentTarget);
          }}
          onKeyDown={handleKeyDown}
        >
          <div className="message-card-reference-head">
            <div className="message-card-reference-copy">
              <strong>{displayReferenceTitle}</strong>
              <span>{tone === 'created' ? t('collection.card.savedIntoRoom') : resolveModeLabel(reference.mode, t)}</span>
            </div>
            <span className="message-card-reference-language">{languageLabel}</span>
          </div>
          <p className="message-card-reference-preview">{summarizeCardCode(reference.code, t('collection.card.emptyCode'))}</p>
        </div>
      )}
      {!hasCardFace && expanded ? (
        <div className="message-card-reference-content">
          {renderMarkdown ? (
            <MessageMarkdown content={reference.code} />
          ) : (
            <pre>{reference.code || t('collection.card.emptyCode')}</pre>
          )}
        </div>
      ) : null}
      {showActions ? (
        <div className="message-card-reference-actions">
          {!hasCardFace && onRun ? (
            <button
              type="button"
              className="message-card-reference-action"
              onClick={(event) => {
                event.stopPropagation();
                runSelectionAction(onRun, { element: event.currentTarget });
              }}
            >
              <Icon name="play" size={12} />
              <span>{t('collection.card.run')}</span>
            </button>
          ) : null}
          {onOpen ? (
            <button
              type="button"
              className="message-card-reference-action"
              onClick={(event) => {
                event.stopPropagation();
                runSelectionAction(onOpen, { element: event.currentTarget });
              }}
            >
              <Icon name="edit" size={12} />
              <span>{t('collection.card.open')}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
