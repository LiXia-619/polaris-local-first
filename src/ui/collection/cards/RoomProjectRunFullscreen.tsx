import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { runImpactAction } from '../../haptics';
import { CodePreviewStageSurface } from '../workshop/CodePreviewStageSurface';

type RoomProjectRunFullscreenProps = {
  projectId: string;
  title: string;
  fileCount: number;
  srcDoc: string;
  code: string;
  onClose: () => void;
};

export function RoomProjectRunFullscreen({
  projectId,
  title,
  fileCount,
  srcDoc,
  code,
  onClose
}: RoomProjectRunFullscreenProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const { t } = useI18n();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="room-project-run-fullscreen" role="dialog" aria-modal="true">
      <header className="room-project-run-bar">
        <div className="room-project-run-title">
          <strong>{title}</strong>
          <span>{t('collection.project.fileCount', { count: fileCount })}</span>
        </div>
        <div className="room-project-run-actions">
          <button
            type="button"
            className="room-project-run-icon-button"
            onClick={(event) => {
              runImpactAction(() => setReloadKey((current) => current + 1), { element: event.currentTarget });
            }}
            aria-label={t('collection.project.reloadAria')}
            title={t('collection.project.reloadAria')}
          >
            <Icon name="refresh" size={14} />
          </button>
          <button
            type="button"
            className="room-project-run-exit"
            onClick={(event) => {
              runImpactAction(onClose, { element: event.currentTarget });
            }}
          >
            {t('collection.project.exit')}
          </button>
        </div>
      </header>

      <CodePreviewStageSurface
        key={reloadKey}
        roomId={`project:${projectId}`}
        className="room-project-run-stage"
        title={title}
        frameTitle={`${title} workspace`}
        srcDoc={srcDoc}
        code={code}
      />
    </div>,
    document.body
  );
}
