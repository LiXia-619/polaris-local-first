import type { CodeFilterOption } from '../../../app/collection/codeCollectionFilterModel';
import type { ImageCollaboratorFilter, ImageTagFilter } from '../../../app/collection/imageCollectionFilterModel';
import { runSelectionAction } from '../../haptics';
import { useI18n } from '../../../i18n';

type ImageCollectionFiltersProps = {
  showCollaboratorFilters: boolean;
  collaboratorFilter: ImageCollaboratorFilter;
  collaboratorOptions: CodeFilterOption[];
  otherCount: number;
  showTagFilters: boolean;
  tagFilter: ImageTagFilter;
  tagOptions: CodeFilterOption[];
  onCollaboratorFilterChange: (value: ImageCollaboratorFilter) => void;
  onTagFilterChange: (value: ImageTagFilter) => void;
};

export function ImageCollectionFilters({
  showCollaboratorFilters,
  collaboratorFilter,
  collaboratorOptions,
  otherCount,
  showTagFilters,
  tagFilter,
  tagOptions,
  onCollaboratorFilterChange,
  onTagFilterChange
}: ImageCollectionFiltersProps) {
  const { t } = useI18n();
  if (!showCollaboratorFilters && !showTagFilters) return null;

  const handleCollaboratorFilterChange = (value: ImageCollaboratorFilter) => {
    if (value === collaboratorFilter) return;
    onCollaboratorFilterChange(value);
  };

  const handleTagFilterChange = (value: ImageTagFilter) => {
    if (value === tagFilter) return;
    onTagFilterChange(value);
  };

  return (
    <div className="collection-filter-panel">
      {showCollaboratorFilters && (
        <div className="chip-row chip-row-primary collection-filter-chips">
          <button
            type="button"
            className={`chip ${collaboratorFilter === 'all' ? 'active' : ''}`}
            onClick={(event) => {
              runSelectionAction(() => handleCollaboratorFilterChange('all'), { element: event.currentTarget });
            }}
          >
            {t('collection.image.filterAll')}
          </button>
          {collaboratorOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip ${collaboratorFilter === option.id ? 'active' : ''}`}
              onClick={(event) => {
                runSelectionAction(() => handleCollaboratorFilterChange(option.id), { element: event.currentTarget });
              }}
            >
              {option.label}
            </button>
          ))}
          {otherCount > 0 && (
            <button
              type="button"
              className={`chip ${collaboratorFilter === 'other' ? 'active' : ''}`}
              onClick={(event) => {
                runSelectionAction(() => handleCollaboratorFilterChange('other'), { element: event.currentTarget });
              }}
            >
              {t('collection.image.filterOther')}
            </button>
          )}
        </div>
      )}
      {showTagFilters && (
        <div className="chip-row collection-filter-chips">
          <button
            type="button"
            className={`chip ${tagFilter === 'all' ? 'active' : ''}`}
            onClick={(event) => {
              runSelectionAction(() => handleTagFilterChange('all'), { element: event.currentTarget });
            }}
          >
            {t('collection.image.filterAllTags')}
          </button>
          {tagOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip ${tagFilter === option.id ? 'active' : ''}`}
              onClick={(event) => {
                runSelectionAction(() => handleTagFilterChange(option.id as ImageTagFilter), { element: event.currentTarget });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
