import { createPortal } from 'react-dom';
import type { CodeCard } from '../../../types/domain';
import { Icon } from '../../Icon';
import { runImpactAction } from '../../haptics';
import { CreateCodeWorkshop } from './CreateCodeWorkshop';
import { useI18n } from '../../../i18n';

type CreateCodeWorkshopFullscreenProps = {
  roomTags: string[];
  activeRoomTag: string | null;
  onClose: () => void;
  onSaveCard: (seed: Partial<CodeCard>, editingCardId?: string | null) => { cardId: string; created: boolean };
  onRunDraft: (seed: Partial<CodeCard>) => void;
};

export function CreateCodeWorkshopFullscreen({
  roomTags,
  activeRoomTag,
  onClose,
  onSaveCard,
  onRunDraft
}: CreateCodeWorkshopFullscreenProps) {
  const { t } = useI18n();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="create-code-fullscreen" role="dialog" aria-modal="true">
      <div className="create-code-fullscreen-shell">
        <header className="create-code-fullscreen-bar">
          <button
            type="button"
            className="create-code-fullscreen-exit"
            aria-label={t('collection.workshop.exitCreateCard')}
            title={t('collection.workshop.exitCreateCard')}
            onClick={(event) => {
              runImpactAction(onClose, { element: event.currentTarget });
            }}
          >
            <span className="create-code-fullscreen-exit-icon" aria-hidden="true">
              <Icon name="plus" size={14} />
            </span>
          </button>
        </header>

        <div className="create-code-fullscreen-body">
          <CreateCodeWorkshop
            roomTags={roomTags}
            activeRoomTag={activeRoomTag}
            onSaveCard={onSaveCard}
            onRunDraft={onRunDraft}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
