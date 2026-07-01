import { Icon } from '../../../Icon';
import { runImpactAction } from '../../../haptics';
import { useI18n } from '../../../../i18n';

type JumpToLatestProps = {
  onClick: () => void;
  className?: string;
};

export function JumpToLatest({ onClick, className }: JumpToLatestProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className={className ? `chat-jump-latest-btn ${className}` : 'chat-jump-latest-btn'}
      title={t('chat.timeline.jumpToLatest')}
      aria-label={t('chat.timeline.jumpToLatest')}
      onClick={(event) => {
        runImpactAction(onClick, { element: event.currentTarget });
      }}
    >
      <Icon name="chevronDown" size={16} />
    </button>
  );
}
