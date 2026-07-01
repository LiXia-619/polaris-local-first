import { UNCATEGORIZED_CODE_TAG_FILTER, type CodeTagFilter } from '../../../app/collection/codeCollectionFilterModel';
import { runSelectionAction } from '../../haptics';
import { CollectionEmptyStateWhisper } from './CollectionEmptyStateWhisper';
import { useI18n } from '../../../i18n';

type CodeCollectionEmptyStateProps = {
  aggregateScope: boolean;
  hasSavedCards: boolean;
  tagFilter: CodeTagFilter;
  onOpenChat: () => void;
};

export function CodeCollectionEmptyState({
  aggregateScope,
  hasSavedCards,
  tagFilter,
  onOpenChat
}: CodeCollectionEmptyStateProps) {
  const { t } = useI18n();
  const filterLabel = tagFilter === UNCATEGORIZED_CODE_TAG_FILTER ? t('collection.card.uncategorized') : tagFilter;
  if (aggregateScope) {
    return (
      <CollectionEmptyStateWhisper
        as="div"
        className="code-collection-filter-empty"
        title={tagFilter === 'all' ? t('collection.code.emptyAggregateAllTitle') : t('collection.code.emptyAggregateFilteredTitle', { filter: filterLabel })}
        hint={
          tagFilter === 'all'
            ? t('collection.code.emptyAggregateAllHint')
            : tagFilter === UNCATEGORIZED_CODE_TAG_FILTER
              ? t('collection.code.emptyAggregateUncategorizedHint')
              : t('collection.code.emptyAggregateFilteredHint')
        }
      >
        <button type="button" className="code-card-composer-tool secondary code-collection-empty-action" onClick={(event) => {
          runSelectionAction(onOpenChat, { element: event.currentTarget });
        }}>
          {t('collection.code.openChat')}
        </button>
      </CollectionEmptyStateWhisper>
    );
  }

  if (hasSavedCards) {
    return (
      <CollectionEmptyStateWhisper
        as="div"
        className="code-collection-filter-empty"
        title={tagFilter === 'all' ? t('collection.code.emptyFilteredAllTitle') : t('collection.code.emptyFilteredTitle', { filter: filterLabel })}
        hint={
          tagFilter === 'all'
            ? undefined
            : tagFilter === UNCATEGORIZED_CODE_TAG_FILTER
              ? t('collection.code.emptyUncategorizedHint')
              : t('collection.code.emptyFilteredHint')
        }
      >
      </CollectionEmptyStateWhisper>
    );
  }

  return (
    <CollectionEmptyStateWhisper
      ariaLabel={t('collection.code.emptyAria')}
      className="code-collection-zero-state"
      title={t('collection.code.emptyRoomTitle')}
      hint={t('collection.code.emptyRoomHint')}
    >
      <div className="code-collection-zero-actions">
        <button type="button" className="code-collection-zero-button" onClick={(event) => {
          runSelectionAction(onOpenChat, { element: event.currentTarget });
        }}>
          {t('collection.code.collectFromChat')}
        </button>
      </div>
    </CollectionEmptyStateWhisper>
  );
}
