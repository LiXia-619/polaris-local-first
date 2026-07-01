import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { useAssetObjectUrl } from '../../useAssetObjectUrl';
import type { GroupImageItem } from '../../../app/group/useGroupWorldController';
import { GroupImagePreview } from './GroupImagePreview';
import type { GroupController } from './groupController';

type GroupImagesTabProps = {
  controller: GroupController;
};

const DELETE_DISARM_MS = 2600;

function GroupImageCell({
  item,
  deleteArmed,
  onOpen,
  onDeleteTap
}: {
  item: GroupImageItem;
  deleteArmed: boolean;
  onOpen: () => void;
  onDeleteTap: () => void;
}) {
  const { t } = useI18n();
  const url = useAssetObjectUrl(item.assetId, true);
  const signature = item.fromUser
    ? t('group.images.fromUser')
    : item.ownerName
      ? t('group.cards.by', { name: item.ownerName })
      : null;
  return (
    <figure className="group-image-cell">
      <button
        type="button"
        className="group-image-open"
        onClick={onOpen}
        aria-label={t('group.images.viewerAria')}
      >
        {url ? <img src={url} alt="" loading="lazy" /> : <span className="group-image-placeholder" />}
      </button>
      <button
        type="button"
        className={`group-image-delete ${deleteArmed ? 'is-armed' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          onDeleteTap();
        }}
        aria-label={deleteArmed ? t('group.cards.deleteConfirm') : t('group.images.delete')}
        title={deleteArmed ? t('group.cards.deleteConfirm') : t('group.images.delete')}
      >
        {deleteArmed ? <span className="group-image-delete-confirm">{t('group.cards.deleteConfirm')}</span> : <Icon name="trash" size={12} />}
      </button>
      {signature ? <figcaption className="group-signature">{signature}</figcaption> : null}
    </figure>
  );
}

export function GroupImagesTab({ controller }: GroupImagesTabProps) {
  const { t } = useI18n();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [armedItemId, setArmedItemId] = useState<string | null>(null);
  const disarmTimerRef = useRef<number | null>(null);
  const images = controller.groupImages;

  // 列表缩短后查看器索引跟着收敛；删空了就关
  useEffect(() => {
    if (previewIndex === null) return;
    if (images.length === 0) {
      setPreviewIndex(null);
      return;
    }
    if (previewIndex >= images.length) {
      setPreviewIndex(images.length - 1);
    }
  }, [images.length, previewIndex]);

  useEffect(() => {
    if (!armedItemId) return undefined;
    disarmTimerRef.current = window.setTimeout(() => setArmedItemId(null), DELETE_DISARM_MS);
    return () => {
      if (disarmTimerRef.current !== null) window.clearTimeout(disarmTimerRef.current);
    };
  }, [armedItemId]);

  if (images.length === 0) {
    return (
      <div className="group-tab-empty">
        <Icon name="image" size={22} />
        <p>{t('group.images.empty')}</p>
      </div>
    );
  }

  const ownerLabel = (item: GroupImageItem) =>
    item.fromUser
      ? t('group.images.fromUser')
      : item.ownerName
        ? t('group.cards.by', { name: item.ownerName })
        : null;

  return (
    <>
      <div className="group-images-grid">
        {images.map((item, index) => (
          <GroupImageCell
            key={item.id}
            item={item}
            deleteArmed={armedItemId === item.id}
            onOpen={() => {
              setArmedItemId(null);
              setPreviewIndex(index);
            }}
            onDeleteTap={() => {
              if (armedItemId !== item.id) {
                setArmedItemId(item.id);
                return;
              }
              setArmedItemId(null);
              controller.deleteGroupImage(item);
            }}
          />
        ))}
      </div>
      {previewIndex !== null && images[previewIndex] ? (
        <GroupImagePreview
          items={images}
          activeIndex={previewIndex}
          ownerLabel={ownerLabel}
          onChangeIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          onDelete={(item) => controller.deleteGroupImage(item)}
          onStatus={controller.setCommandStatus}
        />
      ) : null}
    </>
  );
}
