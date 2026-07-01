import { Icon, type IconName } from '../../Icon';
import { HelpHint } from '../../HelpHint';
import { useI18n } from '../../../i18n';

type MenuSheetItemProps = {
  icon: Extract<IconName, 'sparkle' | 'copy' | 'folder' | 'layers' | 'lighthouse' | 'mcpServer' | 'providerRoute' | 'infoCard' | 'zap' | 'feather' | 'fontImport' | 'search' | 'fileText' | 'openBook' | 'download' | 'trash' | 'image' | 'voice'>;
  title: string;
  detail?: string;
  progress?: number | null;
  helpText?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function MenuSheetItem({
  icon,
  title,
  detail,
  progress,
  helpText,
  onClick,
  disabled = false,
  className
}: MenuSheetItemProps) {
  const { t } = useI18n();
  const itemClassName = `settings-item ${className ?? ''}`.trim();
  const boundedProgress = typeof progress === 'number'
    ? Math.max(0, Math.min(100, progress))
    : null;
  const itemContent = (
    <>
      <span className="settings-item-leading">
        <span className="settings-item-icon"><Icon name={icon} size={14} /></span>
        <span className="settings-item-copy">
          <strong>{title}</strong>
          {detail ? <small>{detail}</small> : null}
          {boundedProgress !== null ? (
            <span className="settings-item-progress" aria-label={t('common.progress', { progress: boundedProgress })}>
              <span className="settings-item-progress-fill" style={{ width: `${boundedProgress}%` }} />
            </span>
          ) : null}
        </span>
      </span>
      <span className="settings-item-arrow">›</span>
    </>
  );

  if (!helpText) {
    return (
      <button className={itemClassName} type="button" onClick={onClick} disabled={disabled}>
        {itemContent}
      </button>
    );
  }

  return (
    <div className={`${itemClassName} settings-item--with-help`} data-disabled={disabled ? 'true' : undefined}>
      <button className="settings-item-main" type="button" onClick={onClick} disabled={disabled}>
        <span className="settings-item-leading">
          <span className="settings-item-icon"><Icon name={icon} size={14} /></span>
          <span className="settings-item-copy">
            <strong>{title}</strong>
            {detail ? <small>{detail}</small> : null}
            {boundedProgress !== null ? (
              <span className="settings-item-progress" aria-label={t('common.progress', { progress: boundedProgress })}>
                <span className="settings-item-progress-fill" style={{ width: `${boundedProgress}%` }} />
              </span>
            ) : null}
          </span>
        </span>
      </button>
      <HelpHint
        className="help-hint--menu-item help-hint--below"
        label={title}
        text={helpText}
      />
      <span className="settings-item-arrow" aria-hidden="true">›</span>
    </div>
  );
}
