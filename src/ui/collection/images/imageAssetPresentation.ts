import { resolveOwnerCollaboratorId } from '../../../engines/collectionOwnership';
import { isGenericImageTitle } from '../../../engines/imageAssetNaming';
import type { I18nTranslator } from '../../../i18n';
import type { Conversation, ImageAssetCard, Persona } from '../../../types/domain';
import { imageAssetOriginLabel } from '../collectionUtils';

type ImageAssetPresentationCopy = Pick<I18nTranslator, 't'>;

function fallbackImageNoun(tags: string[], copy: ImageAssetPresentationCopy) {
  const { t } = copy;
  if (tags.includes('二维码')) return t('collection.image.fallbackQr');
  if (tags.includes('截图')) return t('collection.image.fallbackScreenshot');
  if (tags.includes('正片')) return t('collection.image.fallbackFinal');
  if (tags.includes('生成图')) return t('collection.image.fallbackGenerated');
  if (tags.includes('参考图')) return t('collection.image.fallbackReference');
  return t('collection.image.fallbackImage');
}

export function describeImageAssetSource(card: ImageAssetCard, copy: ImageAssetPresentationCopy) {
  const { t } = copy;
  switch (card.source) {
    case 'chat-generated':
      return t('collection.image.sourceChat');
    case 'imported':
      return t('collection.image.sourceImported');
    default:
      return t('collection.image.sourceManual');
  }
}

export function resolveImageAssetDisplayTitle(
  card: ImageAssetCard,
  conversations: Conversation[],
  collaborators: Persona[],
  copy: ImageAssetPresentationCopy
) {
  const explicitTitle = card.title.trim();
  if (explicitTitle && !isGenericImageTitle(explicitTitle)) {
    return explicitTitle;
  }

  const noun = fallbackImageNoun(card.tags, copy);
  const conversation = card.originConversationId
    ? conversations.find((entry) => entry.id === card.originConversationId) ?? null
    : null;
  const ownerCollaboratorId = resolveOwnerCollaboratorId(card, conversations);
  const collaboratorName = ownerCollaboratorId
    ? collaborators.find((collaborator) => collaborator.id === ownerCollaboratorId)?.name ?? ''
    : '';

  if (collaboratorName) return copy.t('collection.image.ownerTitle', { name: collaboratorName, noun });
  if (conversation?.title?.trim()) return `${conversation.title} · ${noun}`;
  return noun;
}

export function shouldShowImageCollaboratorFilters(optionCount: number, otherCount: number) {
  return optionCount + (otherCount > 0 ? 1 : 0) > 1;
}

export function shouldShowImageTagFilters(optionCount: number, totalCards: number) {
  return optionCount > 1 && totalCards >= 6;
}

export function resolveImageAssetOriginCopy(
  card: ImageAssetCard,
  conversations: Conversation[],
  collaborators: Persona[]
) {
  return imageAssetOriginLabel(card, conversations, collaborators);
}
