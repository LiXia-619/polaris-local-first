import { buildThinkingSummary } from '../thinkingSummary';
import { useI18n } from '../../../../i18n';

type MessageThinkingProjectionProps = {
  thinkingText: string;
  phase?: 'visible' | 'closing';
};

export function MessageThinkingProjection({
  thinkingText,
  phase = 'visible'
}: MessageThinkingProjectionProps) {
  const { t } = useI18n();
  const items = buildThinkingSummary(thinkingText);
  if (items.length === 0) return null;

  return (
    <div
      className={`message-thinking-projection ${phase === 'closing' ? 'closing' : 'visible'}`}
      aria-label={t('chat.thinking.projectionAria')}
    >
      {items.map((item) => (
        <div key={item.id} className={`message-thinking-projection-item ${item.kind}`}>
          <span className={`message-thinking-projection-dot ${item.kind}`} aria-hidden="true" />
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
