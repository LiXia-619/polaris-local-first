import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import { createStoredAttachment } from '../../../infrastructure/assetStore';
import { canUseNativePhotoLibraryPicker, pickNativePhotoLibraryFiles } from '../../../native/imagePickerFiles';
import { useAssetObjectUrl } from '../../useAssetObjectUrl';
import { GROUP_BACKGROUND_IDS, type GroupBackgroundId } from '../../../app/group/useGroupWorldController';
import { GroupAvatar } from './GroupAvatar';
import type { GroupController } from './groupController';

type GroupSettingsTabProps = {
  controller: GroupController;
};

function GroupToggle({
  on,
  onToggle,
  label,
  detail
}: {
  on: boolean;
  onToggle: (next: boolean) => void;
  label: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      className={`group-toggle-row ${on ? 'is-on' : ''}`}
      onClick={() => onToggle(!on)}
      aria-pressed={on}
    >
      <span className="group-toggle-copy">
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </span>
      <span className="group-toggle-pill" aria-hidden="true">
        <span className="group-toggle-knob" />
      </span>
    </button>
  );
}

export function GroupSettingsTab({ controller }: GroupSettingsTabProps) {
  const { t } = useI18n();
  const group = controller.activeGroup;
  const [titleDraft, setTitleDraft] = useState(group?.group?.title ?? '');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [pickingBackground, setPickingBackground] = useState(false);
  const backgroundFileInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundImageUrl = useAssetObjectUrl(group?.group?.backgroundAssetId ?? undefined, true);

  useEffect(() => {
    setTitleDraft(group?.group?.title ?? '');
    setDeleteArmed(false);
  }, [group?.id, group?.group?.title]);

  if (!group?.group) return null;
  const settings = group.group;

  const commitTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== settings.title) {
      controller.renameGroup(titleDraft);
    }
  };

  const ingestBackgroundFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      controller.setCommandStatus(t('group.settings.backgroundImage.imageOnly'), true);
      return;
    }
    try {
      const attachment = await createStoredAttachment({
        kind: 'image',
        name: file.name,
        mimeType: file.type || 'image/*',
        blob: file
      });
      controller.setBackgroundImage(attachment.assetId);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('group.settings.backgroundImage.saveFailed');
      controller.setCommandStatus(message, true);
    }
  };

  const pickBackgroundImage = async () => {
    if (pickingBackground) return;
    if (canUseNativePhotoLibraryPicker()) {
      try {
        setPickingBackground(true);
        const [file] = await pickNativePhotoLibraryFiles();
        await ingestBackgroundFile(file);
      } finally {
        setPickingBackground(false);
      }
      return;
    }
    backgroundFileInputRef.current?.click();
  };

  const onBackgroundFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    await ingestBackgroundFile(file);
    event.target.value = '';
  };

  const backgroundLabel = (id: GroupBackgroundId) => {
    if (id === 'aurora') return t('group.settings.background.aurora');
    if (id === 'dusk') return t('group.settings.background.dusk');
    if (id === 'moss') return t('group.settings.background.moss');
    return t('group.settings.background.paper');
  };

  return (
    <div className="group-settings">
      <label className="group-field">
        <span>{t('group.settings.nameLabel')}</span>
        <input
          type="text"
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitTitle();
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </label>

      <section className="group-settings-section">
        <header>
          <strong>{t('group.settings.background')}</strong>
        </header>
        <div className="group-background-row">
          {GROUP_BACKGROUND_IDS.map((id) => (
            <button
              type="button"
              key={id}
              className={`group-background-swatch ${settings.background === id ? 'is-active' : ''}`}
              data-group-bg={id}
              onClick={() => controller.setBackground(id)}
              aria-pressed={settings.background === id}
            >
              <span className="group-background-chip" aria-hidden="true" />
              <span>{backgroundLabel(id)}</span>
            </button>
          ))}
        </div>
        <div className="group-background-image">
          <div className="group-background-image-head">
            <span className="group-background-image-copy">
              <strong>{t('group.settings.backgroundImage')}</strong>
              <span>{t('group.settings.backgroundImageDetail')}</span>
            </span>
            {settings.backgroundAssetId ? (
              <button
                type="button"
                className="group-background-image-clear"
                onClick={() => controller.setBackgroundImage(null)}
              >
                {t('group.settings.backgroundImage.clear')}
              </button>
            ) : (
              <button
                type="button"
                className="group-background-image-pick"
                disabled={pickingBackground}
                onClick={() => void pickBackgroundImage()}
              >
                <Icon name="image" size={14} />
                <span>{t('group.settings.backgroundImage.pick')}</span>
              </button>
            )}
            <input
              ref={backgroundFileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void onBackgroundFileChange(event)}
            />
          </div>
          {settings.backgroundAssetId ? (
            <div className="group-background-image-body">
              {backgroundImageUrl ? (
                <span
                  className="group-background-image-preview"
                  style={{ backgroundImage: `url(${backgroundImageUrl})` }}
                  aria-hidden="true"
                />
              ) : null}
              <label className="group-background-veil">
                <span>{t('group.settings.backgroundImage.veil')}</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round((settings.backgroundVeil ?? 0.45) * 100)}
                  onChange={(event) => controller.setBackgroundVeil(Number(event.target.value) / 100)}
                />
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <section className="group-settings-section">
        <header>
          <strong>{t('group.settings.members')}</strong>
          <span>{t('group.settings.membersDetail')}</span>
        </header>
        <ul className="group-member-pick-list">
          {controller.personas.map((persona) => {
            const selected = settings.memberIds.includes(persona.id);
            return (
              <li key={persona.id}>
                <button
                  type="button"
                  className={`group-member-pick ${selected ? 'is-selected' : ''}`}
                  onClick={() => controller.toggleMember(persona.id)}
                  aria-pressed={selected}
                >
                  <GroupAvatar persona={persona} size={28} />
                  <span className="group-member-pick-name">{persona.name}</span>
                  <span className="group-member-pick-check" aria-hidden="true">
                    {selected ? <Icon name="check" size={13} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="group-settings-section">
        <header>
          <strong>{t('group.settings.rhythm')}</strong>
        </header>
        <div className="group-segment">
          <button
            type="button"
            className={settings.replyMode === 'round' ? 'is-active' : ''}
            onClick={() => controller.setReplyMode('round')}
          >
            <strong>{t('group.settings.replyMode.round')}</strong>
            <span>{t('group.settings.replyMode.roundDetail')}</span>
          </button>
          <button
            type="button"
            className={settings.replyMode === 'random' ? 'is-active' : ''}
            onClick={() => controller.setReplyMode('random')}
          >
            <strong>{t('group.settings.replyMode.random')}</strong>
            <span>{t('group.settings.replyMode.randomDetail')}</span>
          </button>
        </div>
        <GroupToggle
          on={settings.allowMemberSilence}
          onToggle={controller.setAllowMemberSilence}
          label={t('group.settings.silence')}
          detail={t('group.settings.silenceDetail')}
        />
        <GroupToggle
          on={settings.memoryRecallEnabled !== false}
          onToggle={controller.setMemoryRecallEnabled}
          label={t('group.settings.memoryRecall')}
          detail={t('group.settings.memoryRecallDetail')}
        />
      </section>

      <section className="group-settings-section">
        <header>
          <strong>{t('group.settings.tools')}</strong>
          <span>{t('group.settings.toolsDetail')}</span>
        </header>
        <GroupToggle
          on={settings.toolSettings.cards}
          onToggle={(next) => controller.setToolSetting('cards', next)}
          label={t('group.settings.tools.cards')}
          detail={t('group.settings.tools.cardsDetail')}
        />
        <GroupToggle
          on={settings.toolSettings.images}
          onToggle={(next) => controller.setToolSetting('images', next)}
          label={t('group.settings.tools.images')}
          detail={t('group.settings.tools.imagesDetail')}
        />
        <GroupToggle
          on={settings.toolSettings.attachments}
          onToggle={(next) => controller.setToolSetting('attachments', next)}
          label={t('group.settings.tools.attachments')}
          detail={t('group.settings.tools.attachmentsDetail')}
        />
        <GroupToggle
          on={settings.toolSettings.web}
          onToggle={(next) => controller.setToolSetting('web', next)}
          label={t('group.settings.tools.web')}
          detail={t('group.settings.tools.webDetail')}
        />
        <GroupToggle
          on={settings.toolSettings.mcp === true}
          onToggle={(next) => controller.setToolSetting('mcp', next)}
          label={t('group.settings.tools.mcp')}
          detail={t('group.settings.tools.mcpDetail')}
        />
        {settings.toolSettings.mcp === true && controller.mcpServers.filter((server) => server.isActive).length === 0 ? (
          <p className="group-mcp-empty">{t('group.settings.tools.mcpNoServers')}</p>
        ) : null}
      </section>

      <section className="group-settings-section is-danger">
        <button
          type="button"
          className={`group-danger-btn ${deleteArmed ? 'is-armed' : ''}`}
          onClick={() => {
            if (!deleteArmed) {
              setDeleteArmed(true);
              return;
            }
            controller.deleteGroup(group.id);
          }}
        >
          <Icon name="trash" size={14} />
          <span>{deleteArmed ? t('group.settings.deleteConfirm') : t('group.settings.delete')}</span>
        </button>
      </section>
    </div>
  );
}
