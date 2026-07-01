import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { useAssetObjectUrl } from '../../useAssetObjectUrl';
import { ingestComposerFiles } from '../chat/composer/ingestComposerFiles';
import type { ChatAttachment } from '../../../types/domain';
import { GroupAvatar } from './GroupAvatar';
import type { GroupController } from './groupController';

const MENTION_TAIL_PATTERN = /@([^\s@]*)$/;

type GroupComposerProps = {
  controller: GroupController;
};

function PendingAttachmentThumb({
  attachment,
  onRemove
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  const url = useAssetObjectUrl(attachment.kind === 'image' ? attachment.assetId : undefined, true);
  if (attachment.kind === 'file') {
    return (
      <span className="group-composer-attachment is-file">
        <Icon name="fileText" size={13} />
        <span className="group-composer-attachment-name">{attachment.name}</span>
        <button type="button" onClick={onRemove} aria-label={attachment.name}>
          <Icon name="x" size={11} />
        </button>
      </span>
    );
  }
  return (
    <span className="group-composer-attachment">
      {url ? <img src={url} alt={attachment.name} /> : <Icon name="image" size={14} />}
      <button type="button" onClick={onRemove} aria-label={attachment.name}>
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}

export function GroupComposer({ controller }: GroupComposerProps) {
  const { t } = useI18n();
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const group = controller.activeGroup;
  const draft = group?.draft ?? '';
  const hasContent = draft.trim().length > 0 || pendingAttachments.length > 0;
  // 群附件工具开着时输入框收任意文件；关着时这扇门只收图片
  const filesAllowed = group?.group?.toolSettings.attachments === true;

  // @点名：草稿尾部出现 @ 时弹出成员选择
  const mentionQuery = useMemo(() => {
    const match = draft.match(MENTION_TAIL_PATTERN);
    return match ? match[1] : null;
  }, [draft]);
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return controller.memberPersonas.filter((member) =>
      query === '' || member.name.toLowerCase().includes(query));
  }, [controller.memberPersonas, mentionQuery]);

  const insertMention = (name: string) => {
    controller.updateDraft(draft.replace(MENTION_TAIL_PATTERN, `@${name} `));
    textareaRef.current?.focus();
  };

  if (!group) return null;

  const resizeTextarea = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 104)}px`;
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await ingestComposerFiles(
      files,
      (attachments) => {
        const accepted = filesAllowed
          ? attachments
          : attachments.filter((attachment) => attachment.kind === 'image');
        setPendingAttachments((current) => [...current, ...accepted]);
      },
      controller.setCommandStatus
    );
    event.target.value = '';
  };

  const send = () => {
    if (!hasContent) return;
    const attachments = pendingAttachments;
    setPendingAttachments([]);
    void controller.submit(attachments.length > 0 ? attachments : undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="group-composer">
      {mentionCandidates.length > 0 ? (
        <div className="group-mention-menu" role="listbox" aria-label={t('group.composer.mention')}>
          {mentionCandidates.map((member) => (
            <button
              type="button"
              key={member.id}
              role="option"
              aria-selected="false"
              onClick={() => insertMention(member.name)}
            >
              <GroupAvatar persona={member} size={22} />
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {pendingAttachments.length > 0 ? (
        <div className="group-composer-attachments">
          {pendingAttachments.map((attachment) => (
            <PendingAttachmentThumb
              key={attachment.id}
              attachment={attachment}
              onRemove={() =>
                setPendingAttachments((current) => current.filter((entry) => entry.id !== attachment.id))
              }
            />
          ))}
        </div>
      ) : null}
      <div className="group-composer-row">
        <div className="group-composer-shell">
          <button
            type="button"
            className="group-composer-slot-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label={filesAllowed ? t('group.composer.attachFile') : t('group.composer.attachImage')}
          >
            <Icon name={filesAllowed ? 'folder' : 'image'} size={17} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={filesAllowed ? undefined : 'image/*'}
            multiple
            hidden
            onChange={(event) => void handleFiles(event)}
          />
          <textarea
            ref={textareaRef}
            className="group-composer-textarea"
            rows={1}
            value={draft}
            placeholder={t('group.composer.placeholder')}
            onChange={(event) => {
              controller.updateDraft(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={onKeyDown}
          />
          <div className="group-composer-actions">
            <button
              type="button"
              className={`group-composer-send ${hasContent ? 'has-content' : ''}`}
              onClick={send}
              disabled={!hasContent}
              aria-label={t('group.composer.send')}
            >
              <Icon name="send" size={15} />
            </button>
          </div>
        </div>
        {controller.sending ? (
          <div className="group-composer-run-actions">
            <button
              type="button"
              className="group-composer-stop"
              onClick={controller.stopAll}
              aria-label={t('group.composer.stop')}
              title={t('group.composer.stop')}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
