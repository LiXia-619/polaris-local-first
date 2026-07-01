import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';

type CreateActionSheetProps = {
  open: boolean;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
};

export function CreateActionSheet({
  open,
  ariaLabel,
  children,
  className,
  onClose
}: CreateActionSheetProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <section
      className={['create-action-sheet', className].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="create-action-sheet-scrim"
        aria-label={t('common.closeCreatePanel')}
        onClick={onClose}
      />
      <div className="create-action-sheet-panel">
        <div className="create-action-sheet-grabber" aria-hidden="true" />
        <button
          type="button"
          className="create-action-sheet-close"
          aria-label={t('common.closeCreatePanel')}
          onClick={onClose}
        >
          <Icon name="x" size={13} />
        </button>
        <div className="create-action-sheet-body">
          {children}
        </div>
      </div>
    </section>,
    document.body
  );
}
