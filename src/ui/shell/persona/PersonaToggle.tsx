import { useI18n } from '../../../i18n/useI18n';

type PersonaToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
};

export function PersonaToggle({
  label,
  description,
  checked,
  onToggle
}: PersonaToggleProps) {
  const { t } = useI18n();
  const statusLabel = checked ? t('common.toggleOn') : t('common.toggleOff');

  return (
    <div className="ps-toggle">
      <div className="ps-toggle-text">
        <span className="ps-toggle-label">{label}</span>
        <span className="ps-toggle-desc">{description}</span>
      </div>
      <button
        type="button"
        className={`ps-toggle-sw ${checked ? 'ps-toggle-sw--on' : ''}`}
        aria-pressed={checked}
        aria-label={t('common.toggleAria', { label, status: statusLabel })}
        onClick={onToggle}
      >
        <span className="ps-toggle-knob" />
      </button>
    </div>
  );
}
