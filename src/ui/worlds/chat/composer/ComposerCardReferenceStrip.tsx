import type { ChatCardReference } from '../../../../types/domain';
import { cleanDisplayText } from '../../../text/displayText';
import { useI18n } from '../../../../i18n';

type ComposerCardReferenceStripProps = {
  reference: ChatCardReference;
  onRemove: () => void;
};

export function ComposerCardReferenceStrip({
  reference,
  onRemove
}: ComposerCardReferenceStripProps) {
  const { t } = useI18n();

  return (
    <div className="composer-card-reference-strip" aria-label={t('chat.cardReference.aria')}>
      <div className="composer-card-reference-chip">
        <div className="composer-card-reference-copy">
          <strong>{cleanDisplayText(reference.title)}</strong>
          <span>
            {reference.mode === 'continue' ? t('chat.cardReference.continue') : t('chat.cardReference.send')}
            {' · '}
            {reference.language}
          </span>
        </div>
        <button
          type="button"
          className="composer-card-reference-remove"
          onClick={onRemove}
          aria-label={t('chat.cardReference.removeAria')}
        >
          ×
        </button>
      </div>
    </div>
  );
}
