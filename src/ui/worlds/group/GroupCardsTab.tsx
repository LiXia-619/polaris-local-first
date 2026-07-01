import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { buildCodeCardRunPreview, type CodeCardRunPreview } from '../../../app/collection/codeCardRunPreview';
import { runImpactAction } from '../../haptics';
import { cleanDisplayText } from '../../text/displayText';
import { CodePreviewFullscreenLayer } from '../../collection/cards/CodePreviewFullscreenLayer';
import { useSwipeDelete } from '../../collection/grid/useSwipeDelete';
import type { GroupArtifactItem } from '../../../app/group/useGroupWorldController';
import type { GroupController } from './groupController';

type GroupCardsTabProps = {
  controller: GroupController;
};

// 左滑出删除、点两下确认：卡片行和文件行共用的壳
function SwipeDeleteRow({
  className,
  deleteAriaLabel,
  onDelete,
  children
}: {
  className: string;
  deleteAriaLabel: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const swipeDelete = useSwipeDelete();
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (!swipeDelete.open) setDeleteArmed(false);
  }, [swipeDelete.open]);

  return (
    <li
      className={`${className} ${swipeDelete.open ? 'swipe-open' : ''} ${swipeDelete.dragging ? 'swiping' : ''}`}
      style={swipeDelete.style}
      {...swipeDelete.swipeProps}
    >
      <button
        type="button"
        className={`group-card-swipe-delete ${deleteArmed ? 'is-armed' : ''}`}
        data-swipe-delete-action="true"
        onClick={() => {
          if (!deleteArmed) {
            setDeleteArmed(true);
            return;
          }
          onDelete();
        }}
        aria-label={deleteAriaLabel}
      >
        {deleteArmed ? t('group.cards.deleteConfirm') : t('group.message.delete')}
      </button>
      <div className="group-card-swipe-surface">{children}</div>
    </li>
  );
}

function GroupCardRow({
  item,
  expanded,
  onToggleExpanded,
  onRun,
  onDelete
}: {
  item: Extract<GroupArtifactItem, { type: 'card' }>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRun: (element: HTMLElement) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const { card, ownerName } = item;

  return (
    <SwipeDeleteRow
      className={`group-card-item ${expanded ? 'is-expanded' : ''}`}
      deleteAriaLabel={t('group.cards.delete')}
      onDelete={onDelete}
    >
      <div className="group-card-head">
        <button
          type="button"
          className="group-card-summary"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
        >
          <span className="group-card-title">
            <strong>{card.title}</strong>
            <span className="group-card-meta">
              {card.language ? <code>{card.language}</code> : null}
              {ownerName ? (
                <span className="group-signature">{t('group.cards.by', { name: ownerName })}</span>
              ) : null}
            </span>
          </span>
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} />
        </button>
        <button
          type="button"
          className="group-card-run"
          data-swipe-delete-ignore="true"
          onClick={(event) => onRun(event.currentTarget)}
          aria-label={t('group.cards.run', { title: cleanDisplayText(card.title) })}
          title={t('group.cards.run', { title: cleanDisplayText(card.title) })}
        >
          <Icon name="play" size={14} />
        </button>
      </div>
      {expanded ? (
        <pre className="group-card-code">
          <code>{card.code}</code>
        </pre>
      ) : null}
    </SwipeDeleteRow>
  );
}

function GroupFileRow({
  item,
  onDelete
}: {
  item: Extract<GroupArtifactItem, { type: 'file' }>;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const signature = item.fromUser
    ? t('group.files.fromUser')
    : item.ownerName
      ? t('group.cards.by', { name: item.ownerName })
      : null;

  return (
    <SwipeDeleteRow
      className="group-card-item is-file"
      deleteAriaLabel={t('group.files.delete')}
      onDelete={onDelete}
    >
      <div className="group-card-head">
        <span className="group-file-icon" aria-hidden="true">
          <Icon name="fileText" size={15} />
        </span>
        <span className="group-card-title">
          <strong>{item.name}</strong>
          {signature ? (
            <span className="group-card-meta">
              <span className="group-signature">{signature}</span>
            </span>
          ) : null}
        </span>
      </div>
    </SwipeDeleteRow>
  );
}

export function GroupCardsTab({ controller }: GroupCardsTabProps) {
  const { t } = useI18n();
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<CodeCardRunPreview | null>(null);

  if (controller.groupArtifacts.length === 0) {
    return (
      <div className="group-tab-empty">
        <Icon name="cardStack" size={22} />
        <p>{t('group.cards.empty')}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="group-cards-list">
        {controller.groupArtifacts.map((item) =>
          item.type === 'card' ? (
            <GroupCardRow
              key={item.card.id}
              item={item}
              expanded={expandedCardId === item.card.id}
              onToggleExpanded={() => setExpandedCardId(expandedCardId === item.card.id ? null : item.card.id)}
              onRun={(element) => {
                runImpactAction(() => setPreviewState(buildCodeCardRunPreview(item.card)), { element });
              }}
              onDelete={() => controller.deleteGroupCard(item.card.id)}
            />
          ) : (
            <GroupFileRow key={item.id} item={item} onDelete={() => controller.deleteGroupFile(item.assetId)} />
          )
        )}
      </ul>
      <CodePreviewFullscreenLayer
        previewPresentation={previewState?.presentation ?? null}
        previewItemId={previewState?.previewItemId ?? null}
        previewProjectId={previewState?.projectId ?? null}
        previewProjectFileCount={previewState?.projectFileCount ?? null}
        previewTitle={previewState?.title ?? null}
        previewLanguage={previewState?.language ?? null}
        previewSrcDoc={previewState?.srcDoc ?? null}
        previewContent={previewState?.content ?? ''}
        onClosePreview={() => setPreviewState(null)}
      />
    </>
  );
}
