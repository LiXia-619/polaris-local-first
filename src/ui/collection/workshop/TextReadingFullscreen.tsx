import { createPortal } from 'react-dom';
import { runImpactAction } from '../../haptics';
import { MessageMarkdown } from '../../worlds/chat/message/MessageMarkdown';
import { useI18n } from '../../../i18n';

type TextReadingFullscreenProps = {
  title: string;
  language: string;
  content: string;
  onClose: () => void;
};

export function TextReadingFullscreen({
  title,
  language,
  content,
  onClose
}: TextReadingFullscreenProps) {
  const { t } = useI18n();
  if (typeof document === 'undefined') return null;
  const normalizedLanguage = language.trim().toLowerCase();
  const renderMarkdown = normalizedLanguage === 'markdown' || normalizedLanguage === 'md';

  return createPortal(
    <div className="text-reading-fullscreen" role="dialog" aria-modal="true">
      <div className="text-reading-fullscreen-bar">
        <div className="text-reading-fullscreen-copy">
          <span>{language}</span>
          <strong>{title}</strong>
        </div>
        <button
          type="button"
          className="text-reading-fullscreen-close"
          onClick={(event) => {
            runImpactAction(onClose, { element: event.currentTarget });
          }}
        >
          {t('collection.workshop.exitPreview')}
        </button>
      </div>

      <div className="text-reading-fullscreen-body">
        {renderMarkdown ? (
          <div className="text-reading-fullscreen-content text-reading-fullscreen-markdown">
            <MessageMarkdown content={content} />
          </div>
        ) : (
          <pre className="text-reading-fullscreen-content">{content}</pre>
        )}
      </div>
    </div>,
    document.body
  );
}
