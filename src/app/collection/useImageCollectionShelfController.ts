import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { useSpaceFrontstageBindings } from '../../stores/spaceStoreFrontstageBindings';
import type { ImageAssetCard } from '../../types/domain';
import {
  fetchImageBlobFromUrl,
  imageMimeFromFileName,
  isImageFile,
  saveImageAssetCard
} from './imageAssetImport';
import { useImageCollectionFilters } from './useImageCollectionFilters';

type ImageIngestStatus = {
  tone: 'success' | 'error';
  text: string;
};

export function useImageCollectionShelfController(searchTerm: string) {
  const imageCards = useCollectionStore((state) => state.imageCards);
  const frontstage = useSpaceFrontstageBindings();
  const deleteImageCard = useCollectionStore((state) => state.deleteImageCard);
  const createImageCardFromAsset = useCollectionStore((state) => state.createImageCardFromAsset);
  const updateImageCard = useCollectionStore((state) => state.updateImageCard);
  const conversations = useChatStore((state) => state.conversations);
  const collaborators = usePersonaStore((state) => state.personas);
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [imageIngestBusy, setImageIngestBusy] = useState(false);
  const [imageIngestStatus, setImageIngestStatus] = useState<ImageIngestStatus | null>(null);
  const collaboratorScopeId = frontstage.frontstageCollaboratorId;

  const {
    collaboratorFilter,
    collaboratorOptions,
    otherCount,
    tagFilter,
    tagOptions,
    filteredCards,
    setCollaboratorFilter,
    setTagFilter
  } = useImageCollectionFilters({
    cards: imageCards,
    conversations,
    collaborators,
    collaboratorScopeId,
    searchTerm
  });

  const previewCardIndex = previewCardId
    ? filteredCards.findIndex((card) => card.id === previewCardId)
    : -1;
  const previewCard = previewCardIndex >= 0 ? filteredCards[previewCardIndex] : null;
  const saveImageBlob = async (
    blob: Blob,
    fileName: string,
    mimeType: string,
    source: ImageAssetCard['source'],
    title?: string
  ) =>
    saveImageAssetCard({
      blob,
      fileName,
      mimeType,
      title,
      source,
      ownerCollaboratorId: collaboratorScopeId ?? undefined,
      createImageCardFromAsset
    });

  const importImageFiles = async (files: FileList | File[], source: ImageAssetCard['source'] = 'manual') => {
    const selectedFiles = Array.from(files);
    if (!selectedFiles.length) return;

    const imageFiles = selectedFiles.filter(isImageFile);
    if (!imageFiles.length) {
      setImageIngestStatus({ tone: 'error', text: '这里只收图片文件。' });
      return;
    }

    try {
      setImageIngestBusy(true);
      let savedCount = 0;
      for (const file of imageFiles) {
        const mimeType = file.type.startsWith('image/') ? file.type : imageMimeFromFileName(file.name) || 'image/*';
        const result = await saveImageBlob(file, file.name || `image-${Date.now()}.png`, mimeType, source);
        if (result) savedCount += 1;
      }
      const skippedCount = selectedFiles.length - imageFiles.length;
      setImageIngestStatus({
        tone: 'success',
        text: skippedCount > 0
          ? `已放进图片库 ${savedCount} 张，跳过 ${skippedCount} 个非图片文件。`
          : `已放进图片库 ${savedCount} 张图片。`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存图片失败。';
      setImageIngestStatus({ tone: 'error', text: message });
    } finally {
      setImageIngestBusy(false);
    }
  };

  const importImageFromUrl = async (rawUrl: string) => {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) return;

    try {
      setImageIngestBusy(true);
      const { blob, fileName, mimeType, title } = await fetchImageBlobFromUrl(trimmedUrl);
      const result = await saveImageBlob(blob, fileName, mimeType, 'imported', title);
      setImageIngestStatus({
        tone: 'success',
        text: result?.title ? `已导入“${result.title}”。` : '已导入图片。'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入图片链接失败。';
      setImageIngestStatus({ tone: 'error', text: message });
    } finally {
      setImageIngestBusy(false);
    }
  };

  return {
    imageCards,
    conversations,
    collaborators,
    filteredCards,
    collaboratorFilter,
    collaboratorOptions,
    otherCount,
    tagFilter,
    tagOptions,
    previewCard,
    previewCardIndex,
    imageIngestBusy,
    imageIngestStatus,
    importImageFiles,
    importImageFromUrl,
    setCollaboratorFilter,
    setTagFilter,
    openPreviewCard: (cardId: string) => setPreviewCardId(cardId),
    closePreviewCard: () => setPreviewCardId(null),
    changePreviewCard: (nextIndex: number) => setPreviewCardId(filteredCards[nextIndex]?.id ?? null),
    updateImageCard,
    removeImageCard: (cardId: string) => {
      deleteImageCard(cardId);
      if (previewCardId === cardId) {
        setPreviewCardId(null);
      }
    }
  };
}
