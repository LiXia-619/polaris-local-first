import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useImageCollectionShelfController } from '../../../app/collection/useImageCollectionShelfController';
import { Icon } from '../../Icon';
import { CollectionEmptyStateWhisper } from '../grid/CollectionEmptyStateWhisper';
import { CollectionFloatingCreateAction } from '../grid/CollectionFloatingCreateAction';
import { CollectionShelfLead } from '../grid/CollectionShelfLead';
import { canUseNativePhotoLibraryPicker, pickNativePhotoLibraryFiles } from '../../../native/imagePickerFiles';
import { ImageCollectionFilters } from './ImageCollectionFilters';
import { ImageAssetGrid } from './ImageAssetGrid';
import { ImageAssetPreview } from './ImageAssetPreview';
import {
  resolveImageAssetDisplayTitle,
  shouldShowImageCollaboratorFilters,
  shouldShowImageTagFilters
} from './imageAssetPresentation';
import { useI18n } from '../../../i18n';

type ImageCollectionShelfProps = {
  cardsExpanded: boolean;
  searchTerm: string;
  isAggregateScope: boolean;
  floatingActionHost: HTMLElement | null;
};

export function ImageCollectionShelf({
  cardsExpanded,
  searchTerm,
  isAggregateScope,
  floatingActionHost
}: ImageCollectionShelfProps) {
  const copy = useI18n();
  const { t, formatNumber } = copy;
  const controller = useImageCollectionShelfController(searchTerm);
  const [imageCreateMenuOpen, setImageCreateMenuOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const showCollaboratorFilters = isAggregateScope && shouldShowImageCollaboratorFilters(
    controller.collaboratorOptions.length,
    controller.otherCount
  );
  const showTagFilters = shouldShowImageTagFilters(controller.tagOptions.length, controller.imageCards.length);
  const isFiltered =
    (!isAggregateScope && controller.tagFilter !== 'all')
    || (isAggregateScope && (controller.collaboratorFilter !== 'all' || controller.tagFilter !== 'all'));
  const sectionMeta = [
    t('collection.image.count', { count: formatNumber(controller.filteredCards.length) }),
    isFiltered ? t('collection.image.filtered') : null
  ].filter(Boolean).join(' · ');
  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    setImageCreateMenuOpen(false);
    await controller.importImageFiles(files);
  };
  const openImageFilePicker = async () => {
    if (controller.imageIngestBusy) return;
    if (canUseNativePhotoLibraryPicker()) {
      setImageCreateMenuOpen(false);
      const files = await pickNativePhotoLibraryFiles();
      if (files.length > 0) {
        await controller.importImageFiles(files);
      }
      return;
    }
    imageFileInputRef.current?.click();
  };
  const isFileDrag = (event: DragEvent<HTMLElement>) => event.dataTransfer?.types.includes('Files') ?? false;
  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!dragActive) setDragActive(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };
  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    setImageCreateMenuOpen(false);
    await controller.importImageFiles(files);
  };
  const openImageUrlPrompt = () => {
    if (controller.imageIngestBusy) return;
    setImageCreateMenuOpen(false);
    const url = window.prompt(t('collection.image.urlPrompt'));
    if (!url) return;
    void controller.importImageFromUrl(url);
  };
  const floatingCreateAction = (
    <CollectionFloatingCreateAction
      label={imageCreateMenuOpen ? t('collection.image.closeCreate') : t('collection.image.addImage')}
      expanded={imageCreateMenuOpen}
      disabled={controller.imageIngestBusy}
      className="image-asset-floating-create"
      onPress={() => setImageCreateMenuOpen((current) => !current)}
    >
      {imageCreateMenuOpen ? (
        <div className="image-asset-create-menu" role="menu" aria-label={t('collection.image.createMenuAria')}>
          <button
            type="button"
            className="image-asset-create-menu-item"
            role="menuitem"
            onClick={() => { void openImageFilePicker(); }}
            disabled={controller.imageIngestBusy}
          >
            <span className="image-asset-create-menu-item-icon" aria-hidden="true">
              <Icon name="image" size={12} />
            </span>
            <span className="image-asset-create-menu-item-copy">
              <strong>{t('collection.image.album')}</strong>
              <small>{t('collection.image.albumDetail')}</small>
            </span>
          </button>
          <button
            type="button"
            className="image-asset-create-menu-item"
            role="menuitem"
            onClick={openImageUrlPrompt}
            disabled={controller.imageIngestBusy}
          >
            <span className="image-asset-create-menu-item-icon" aria-hidden="true">
              <Icon name="download" size={12} />
            </span>
            <span className="image-asset-create-menu-item-copy">
              <strong>{t('collection.image.link')}</strong>
              <small>{t('collection.image.linkDetail')}</small>
            </span>
          </button>
        </div>
      ) : null}
    </CollectionFloatingCreateAction>
  );

  return (
    <section
      className={`collection-shelf-stack collection-shelf-stack--image collection-media-section ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => { void handleDrop(event); }}
    >
      <input
        ref={imageFileInputRef}
        className="image-asset-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/*"
        multiple
        disabled={controller.imageIngestBusy}
        onChange={(event) => { void handleImageFileChange(event); }}
      />
      <CollectionShelfLead
        meta={sectionMeta}
      />
      {floatingActionHost ? createPortal(floatingCreateAction, floatingActionHost) : null}
      {controller.imageIngestStatus ? (
        <div className={`image-asset-import-status ${controller.imageIngestStatus.tone}`} role="status">
          {controller.imageIngestStatus.text}
        </div>
      ) : null}
      <ImageCollectionFilters
        showCollaboratorFilters={showCollaboratorFilters}
        collaboratorFilter={controller.collaboratorFilter}
        collaboratorOptions={controller.collaboratorOptions}
        otherCount={controller.otherCount}
        showTagFilters={showTagFilters}
        tagFilter={controller.tagFilter}
        tagOptions={controller.tagOptions}
        onCollaboratorFilterChange={controller.setCollaboratorFilter}
        onTagFilterChange={controller.setTagFilter}
      />
      {controller.filteredCards.length > 0 ? (
        <ImageAssetGrid
          cardsExpanded={cardsExpanded}
          cards={controller.filteredCards}
          onOpenCard={(card) => controller.openPreviewCard(card.id)}
          onDeleteCard={(cardId) => {
            const targetCard = controller.filteredCards.find((card) => card.id === cardId);
            const label = targetCard
              ? resolveImageAssetDisplayTitle(targetCard, controller.conversations, controller.collaborators, copy)
              : t('collection.image.deleteFallback');
            if (!window.confirm(t('collection.image.deleteConfirm', { title: label }))) return;
            controller.removeImageCard(cardId);
          }}
        />
      ) : (
        <CollectionEmptyStateWhisper
          as="div"
          className="collection-shelf-empty-state collection-media-empty"
          title={isAggregateScope ? t('collection.image.emptyAggregateTitle') : t('collection.image.emptyRoomTitle')}
          hint={isAggregateScope ? t('collection.image.emptyAggregateHint') : t('collection.image.emptyRoomHint')}
        />
      )}
      {controller.previewCard && (
        <ImageAssetPreview
          cards={controller.filteredCards}
          activeIndex={controller.previewCardIndex}
          onChangeCard={controller.changePreviewCard}
          onClose={controller.closePreviewCard}
          onSharePublished={controller.updateImageCard}
        />
      )}
    </section>
  );
}
