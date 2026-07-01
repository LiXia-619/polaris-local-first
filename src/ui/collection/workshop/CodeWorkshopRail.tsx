import { Icon } from '../../Icon';
import { useI18n } from '../../../i18n';

type CodeWorkshopRailProps = {
  title: string;
  language: string;
  onExpand: () => void;
};

export function CodeWorkshopRail({
  title,
  language,
  onExpand
}: CodeWorkshopRailProps) {
  const { t } = useI18n();

  return (
    <button type="button" className="code-workshop-rail" onClick={onExpand}>
      <span className="code-workshop-rail-handle" aria-hidden="true">
        <Icon name="chevronDown" size={14} />
      </span>
      <strong>{title}</strong>
      <small>{t('collection.workshop.railHint', { language })}</small>
    </button>
  );
}
