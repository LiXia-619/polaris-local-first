import type { CollectionFileCard } from '../../../app/collection/collectionFileCards';
import { useI18n } from '../../../i18n';
import { useAssetObjectUrl } from '../../useAssetObjectUrl';
import { CollectionEmptyStateWhisper } from '../grid/CollectionEmptyStateWhisper';
import { collectionArchiveDateLabel } from '../collectionUtils';

type FileCollectionSectionProps = {
  cardsExpanded: boolean;
  cards: CollectionFileCard[];
  showLead?: boolean;
  onOpenFileSource: (card: CollectionFileCard) => void;
};

function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileTypeLabel(mimeType: string, name: string) {
  const extension = name.trim().split('.').pop()?.toUpperCase();
  if (extension && extension !== name.trim().toUpperCase()) return extension;
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('zip')) return 'ZIP';
  if (mimeType.includes('json')) return 'JSON';
  if (mimeType.includes('markdown')) return 'MD';
  if (mimeType.includes('text')) return 'TXT';
  return 'FILE';
}

function FileCard({
  card,
  cardsExpanded,
  onOpenFileSource
}: {
  card: CollectionFileCard;
  cardsExpanded: boolean;
  onOpenFileSource: (card: CollectionFileCard) => void;
}) {
  const { t } = useI18n();
  const assetUrl = useAssetObjectUrl(card.assetId);
  const canOpenFile = Boolean(assetUrl);

  return (
    <article
      className={`card file-collection-card actionable-card ${cardsExpanded ? 'editing' : 'viewing'} ${canOpenFile ? 'file-openable' : 'file-unavailable'}`}
    >
      {canOpenFile ? (
        <a
          href={assetUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="file-card-main"
          aria-label={t('collection.files.openAria', { name: card.name })}
          title={card.name}
        >
          <div className="card-meta-row">
            <small>{card.conversationTitle}</small>
            <small>{collectionArchiveDateLabel(card.updatedAt)}</small>
          </div>
          <div className="file-card-topline">
            <span className="file-card-type-pill">{formatFileTypeLabel(card.mimeType, card.name)}</span>
            <span className="file-card-fixed-tag">{t('collection.files.fileTag')}</span>
          </div>
          <h3>{card.name}</h3>
          <p className="file-card-subline">{`${card.mimeType} · ${formatAttachmentSize(card.size)}`}</p>
          <p className="file-card-preview">{card.textPreview ?? t('collection.files.openableFallbackPreview')}</p>
        </a>
      ) : (
        <div className="file-card-main" aria-label={t('collection.files.unavailableAria', { name: card.name })}>
          <div className="card-meta-row">
            <small>{card.conversationTitle}</small>
            <small>{collectionArchiveDateLabel(card.updatedAt)}</small>
          </div>
          <div className="file-card-topline">
            <span className="file-card-type-pill">{formatFileTypeLabel(card.mimeType, card.name)}</span>
            <span className="file-card-fixed-tag">{t('collection.files.fileTag')}</span>
          </div>
          <h3>{card.name}</h3>
          <p className="file-card-subline">{`${card.mimeType} · ${formatAttachmentSize(card.size)}`}</p>
          <p className="file-card-preview">{card.textPreview ?? t('collection.files.unavailableFallbackPreview')}</p>
        </div>
      )}
      <div className="file-card-actions">
        {canOpenFile ? (
          <a
            href={assetUrl ?? undefined}
            download={card.name}
            className="file-card-action"
            onClick={(event) => event.stopPropagation()}
          >
            {t('collection.files.download')}
          </a>
        ) : null}
        <button
          type="button"
          className="file-card-action secondary"
          onClick={() => onOpenFileSource(card)}
        >
          {t('collection.files.backToChat')}
        </button>
      </div>
    </article>
  );
}

export function FileCollectionSection({
  cardsExpanded,
  cards,
  showLead = false,
  onOpenFileSource
}: FileCollectionSectionProps) {
  const { t, formatNumber } = useI18n();

  if (cards.length === 0) {
    return (
      <CollectionEmptyStateWhisper
        as="div"
        className="code-collection-filter-empty"
        title={t('collection.files.emptyTitle')}
        hint={t('collection.files.emptyHint')}
      />
    );
  }

  return (
    <section className="collection-file-section">
      {showLead ? (
        <div className="collection-file-section-lead" aria-label={t('collection.files.leadAria')}>
          <span>{t('collection.files.leadTitle')}</span>
          <small>{t('collection.files.leadCount', { count: formatNumber(cards.length) })}</small>
        </div>
      ) : null}
      <div className="grid collection-file-grid">
        {cards.map((card) => (
          <FileCard
            key={card.id}
            card={card}
            cardsExpanded={cardsExpanded}
            onOpenFileSource={onOpenFileSource}
          />
        ))}
      </div>
    </section>
  );
}
