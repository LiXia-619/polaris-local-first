import { useI18n } from '../../../i18n';

type CodeWorkshopEmptyStateProps = {
  onOpenComposer: () => void;
};

export function CodeWorkshopEmptyState({
  onOpenComposer
}: CodeWorkshopEmptyStateProps) {
  const { t } = useI18n();
  return (
    <section className="code-workshop code-workshop-empty">
      <div className="code-workshop-empty-line">
        <p>{t('collection.workshop.emptyTitle')}</p>
      </div>
      <button type="button" className="text-inline-action" onClick={onOpenComposer}>
        {t('collection.workshop.emptyCreateCard')}
      </button>
    </section>
  );
}
