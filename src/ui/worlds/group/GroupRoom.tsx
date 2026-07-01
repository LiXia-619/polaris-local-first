import { useI18n } from '../../../i18n';
import { Icon, type IconName } from '../../Icon';
import type { GroupWorldTab } from '../../../app/group/useGroupWorldController';
import type { Conversation } from '../../../types/domain';
import { GroupAvatar } from './GroupAvatar';
import { GroupTimeline } from './GroupTimeline';
import { GroupComposer } from './GroupComposer';
import { GroupCardsTab } from './GroupCardsTab';
import { GroupImagesTab } from './GroupImagesTab';
import { GroupSettingsTab } from './GroupSettingsTab';
import type { GroupController } from './groupController';

const TABS: Array<{ id: GroupWorldTab; icon: IconName; labelKey: 'group.tab.dialogue' | 'group.tab.cards' | 'group.tab.images' | 'group.tab.settings' }> = [
  { id: 'dialogue', icon: 'navDialogue', labelKey: 'group.tab.dialogue' },
  { id: 'cards', icon: 'folder', labelKey: 'group.tab.cards' },
  { id: 'images', icon: 'navImage', labelKey: 'group.tab.images' },
  { id: 'settings', icon: 'settings', labelKey: 'group.tab.settings' }
];

type GroupRoomProps = {
  controller: GroupController;
};

function conversationPreview(conversation: Conversation, emptyLabel: string) {
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index];
    if (message.role === 'system' || message.origin === 'tool-runtime') continue;
    const text = message.content.replace(/\s+/g, ' ').trim();
    if (text) return text.length > 38 ? `${text.slice(0, 38)}…` : text;
  }
  return emptyLabel;
}

function GroupConversationsSheet({ controller }: GroupRoomProps) {
  const { t } = useI18n();
  return (
    <div className="group-sheet-backdrop" onClick={() => controller.setConversationSheetOpen(false)}>
      <div
        className="group-sheet"
        role="dialog"
        aria-label={t('group.conversations.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="group-sheet-header">
          <strong>{t('group.conversations.title')}</strong>
          <button
            type="button"
            className="group-icon-btn"
            onClick={() => controller.setConversationSheetOpen(false)}
            aria-label={t('group.create.cancel')}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        <button type="button" className="group-conversation-new" onClick={() => controller.createSubConversation()}>
          <span className="group-conversation-new-mark" aria-hidden="true">
            <Icon name="plus" size={15} />
          </span>
          <span className="group-conversation-new-copy">
            <strong>{t('group.conversations.new')}</strong>
            <span>{t('group.conversations.newDetail')}</span>
          </span>
        </button>
        <ul className="group-conversation-list">
          {controller.familyConversations.map((conversation) => {
            const isCurrent = conversation.id === controller.activeGroup?.id;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={`group-conversation-item ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => controller.switchConversation(conversation.id)}
                >
                  <span className="group-conversation-copy">
                    <strong>{conversationPreview(conversation, t('group.conversations.empty'))}</strong>
                    <span>
                      {new Date(conversation.updatedAt).toLocaleString(undefined, {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </span>
                  {isCurrent ? <em className="group-conversation-current">{t('group.conversations.current')}</em> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function GroupRoom({ controller }: GroupRoomProps) {
  const { t } = useI18n();
  const group = controller.activeGroup;
  if (!group?.group) return null;

  return (
    <div className="group-room">
      <header className="group-room-header">
        <button
          type="button"
          className="group-icon-btn"
          onClick={controller.exitToHome}
          aria-label={t('group.world.title')}
        >
          <span className="group-chevron-back"><Icon name="chevron" size={17} /></span>
        </button>
        <button
          type="button"
          className="group-room-heading"
          onClick={() => controller.setConversationSheetOpen(true)}
          aria-label={t('group.conversations.title')}
        >
          <strong>
            {group.group.title}
            <span className="group-room-heading-chevron"><Icon name="chevronDown" size={13} /></span>
          </strong>
          <span>
            {t('group.home.memberCount', { count: controller.memberPersonas.length })}
            {controller.familyConversations.length > 1
              ? ` · ${t('group.home.conversationCount', { count: controller.familyConversations.length })}`
              : ''}
          </span>
        </button>
        <div className="group-room-member-strip" role="group">
          {controller.memberLiveStates.map(({ member, typing }) => (
            <button
              type="button"
              key={member.id}
              className={`group-room-member ${typing ? 'is-typing' : ''}`}
              onClick={() => controller.setLaneMemberId(member.id)}
              aria-label={t('group.lane.title', { name: member.name })}
            >
              <GroupAvatar persona={member} size={28} />
            </button>
          ))}
        </div>
      </header>

      <div className="group-room-body">
        {controller.activeTab === 'dialogue' ? (
          <div className="group-dialogue">
            <GroupTimeline controller={controller} />
            <GroupComposer controller={controller} />
          </div>
        ) : null}
        {controller.activeTab === 'cards' ? <GroupCardsTab controller={controller} /> : null}
        {controller.activeTab === 'images' ? <GroupImagesTab controller={controller} /> : null}
        {controller.activeTab === 'settings' ? <GroupSettingsTab controller={controller} /> : null}
      </div>

      {controller.conversationSheetOpen ? (
        <GroupConversationsSheet controller={controller} />
      ) : null}

      <nav className="group-tabbar" aria-label={t('group.world.title')}>
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`group-tabbar-item ${controller.activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => controller.setActiveTab(tab.id)}
            aria-pressed={controller.activeTab === tab.id}
          >
            <Icon name={tab.icon} size={18} />
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
