import { createPortal } from 'react-dom';
import { COLLECTION_FRONTSTAGE_SURFACES } from '../../frontstage/frontstageSurfaceRegistry';
import { runImpactAction } from '../../haptics';
import { CodePreviewStageSurface } from './CodePreviewStageSurface';
import { useI18n } from '../../../i18n';

type CodeRunFullscreenProps = {
  cardId?: string | null;
  title: string;
  srcDoc: string | null;
  code: string;
  onClose: () => void;
};

export function CodeRunFullscreen({
  cardId,
  title,
  srcDoc,
  code,
  onClose
}: CodeRunFullscreenProps) {
  const { t } = useI18n();
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="code-run-fullscreen" role="dialog" aria-modal="true">
      <div
        className="code-run-fullscreen-bar code-preview-stage-chrome"
        data-surface={COLLECTION_FRONTSTAGE_SURFACES.previewChrome}
      >
        <strong>{title}</strong>
        <button
          type="button"
          className="code-run-fullscreen-close"
          onClick={(event) => {
            runImpactAction(onClose, { element: event.currentTarget });
          }}
        >
          {t('collection.workshop.exitPreview')}
        </button>
      </div>

      <CodePreviewStageSurface
        cardId={cardId}
        className="code-run-fullscreen-stage"
        title={title}
        frameTitle={t('collection.workshop.previewFrameTitle', { title })}
        srcDoc={srcDoc}
        code={code}
      />
    </div>,
    document.body
  );
}
