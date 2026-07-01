import type { CodeCardSourceContext } from '../../../app/collection/codeCollectionSource';
import { useI18n, type I18nTranslator } from '../../../i18n';
import type { CodeCard } from '../../../types/domain';
import { collectionRelativeDateLabel } from '../collectionUtils';

type CodeCardSourceActionsProps = {
  card: CodeCard;
  originLabel: string | null;
  sourceContext: CodeCardSourceContext | null;
  onOpenSourceContext: (card: CodeCard) => void;
  onPromptChatFromSource: (card: CodeCard, sourceContext: CodeCardSourceContext) => void;
};

function roleLabel(role: CodeCardSourceContext['messageRole'], t: I18nTranslator['t']) {
  switch (role) {
    case 'assistant':
      return t('collection.card.sourceRole.assistant');
    case 'user':
      return t('collection.card.sourceRole.user');
    default:
      return t('collection.card.sourceRole.system');
  }
}

export function CodeCardSourceActions({
  card,
  originLabel,
  sourceContext,
  onOpenSourceContext,
  onPromptChatFromSource
}: CodeCardSourceActionsProps) {
  const { language, t } = useI18n();

  if (!card.originConversationId || !card.originMessageId || !sourceContext) {
    return (
      <div className="code-card-source-bar disabled">
        <strong>{t('collection.card.sourceTitle')}</strong>
        <span>{t('collection.card.sourceMissing')}</span>
      </div>
    );
  }

  return (
    <div className="code-card-source-bar">
      <div className="code-card-source-copy">
        <strong>{t('collection.card.sourceTitle')}</strong>
        <span>{originLabel || t('collection.card.sourceFallback')}</span>
        <small>{roleLabel(sourceContext.messageRole, t)} · {collectionRelativeDateLabel(sourceContext.messageTimestamp, language)}</small>
        <p>{sourceContext.messagePreview}</p>
      </div>
      <div className="code-card-source-actions">
        <button type="button" className="btn-secondary compact-btn" onClick={() => onPromptChatFromSource(card, sourceContext)}>
          {t('collection.card.continueFromSource')}
        </button>
        <button type="button" className="btn-secondary compact-btn" onClick={() => onOpenSourceContext(card)}>
          {t('collection.card.openSource')}
        </button>
      </div>
    </div>
  );
}
