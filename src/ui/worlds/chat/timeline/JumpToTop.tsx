import { Icon } from '../../../Icon';
import { runImpactAction } from '../../../haptics';
import { useI18n } from '../../../../i18n';

type JumpToTopProps = {
  onClick: () => void;
  className?: string;
};

export function JumpToTop({ onClick, className }: JumpToTopProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className={className ? `chat-jump-latest-btn chat-jump-top-btn ${className}` : 'chat-jump-latest-btn chat-jump-top-btn'}
      title={t('chat.timeline.jumpToTop')}
      aria-label={t('chat.timeline.jumpToTop')}
      onClick={(event) => {
        runImpactAction(onClick, { element: event.currentTarget });
      }}
    >
      <Icon name="chevronUp" size={16} />
    </button>
  );
}
