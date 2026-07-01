import { useMemo, useState } from 'react';
import { useI18n } from '../../../i18n';
import { Icon } from '../../Icon';
import type { Conversation, Persona } from '../../../types/domain';
import { GroupAvatar } from './GroupAvatar';
import type { GroupController } from './groupController';

function lastPublicLine(conversation: Conversation) {
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index];
    if (message.role === 'system') continue;
    if (message.origin === 'tool-runtime') continue;
    const text = message.content.replace(/\s+/g, ' ').trim();
    if (text) return text.length > 42 ? `${text.slice(0, 42)}…` : text;
  }
  return null;
}

type GroupHomeProps = {
  controller: GroupController;
  onExitWorld?: () => void;
};

export function GroupHome({ controller, onExitWorld }: GroupHomeProps) {
  const { t } = useI18n();
  const personaById = useMemo(
    () => new Map(controller.personas.map((persona) => [persona.id, persona])),
    [controller.personas]
  );

  return (
    <div className="group-home">
      <header className="group-home-header">
        <button
          type="button"
          className="group-icon-btn"
          onClick={onExitWorld ?? controller.exitWorld}
          aria-label={t('group.home.exit')}
        >
          <span className="group-chevron-back"><Icon name="chevron" size={17} /></span>
        </button>
        <h1 className="group-home-title">{t('group.world.title')}</h1>
        <button
          type="button"
          className="group-icon-btn"
          onClick={() => controller.setCreateSheetOpen(true)}
          aria-label={t('group.home.create')}
        >
          <Icon name="plus" size={17} />
        </button>
      </header>
      <div className="group-home-body">
        {controller.groups.length === 0 ? (
          <div className="group-home-empty">
            <span className="group-home-empty-mark" aria-hidden="true">
              <Icon name="navGroup" size={26} />
            </span>
            <h2>{t('group.home.empty.title')}</h2>
            <p>{t('group.home.empty.body')}</p>
            <button type="button" className="group-primary-btn" onClick={() => controller.setCreateSheetOpen(true)}>
              {t('group.home.create')}
            </button>
          </div>
        ) : (
          <ul className="group-home-list">
            {controller.families.map((family) => {
              const conversation = family.latest;
              const members = (conversation.group?.memberIds ?? [])
                .map((memberId) => personaById.get(memberId))
                .filter((member): member is Persona => Boolean(member));
              const previewParts = [
                family.conversations.length > 1
                  ? t('group.home.conversationCount', { count: family.conversations.length })
                  : null,
                lastPublicLine(conversation) ?? t('group.home.memberCount', { count: members.length })
              ].filter(Boolean);
              const preview = previewParts.join(' · ');
              return (
                <li key={family.lineageId}>
                  <button
                    type="button"
                    className="group-home-item"
                    onClick={() => controller.enterGroup(conversation.id)}
                  >
                    <span className="group-avatar-cluster" aria-hidden="true">
                      {members.slice(0, 3).map((member) => (
                        <span key={member.id} className="group-avatar-cluster-slot">
                          <GroupAvatar persona={member} size={26} />
                        </span>
                      ))}
                      {members.length === 0 ? (
                        <span className="group-avatar-cluster-slot group-avatar-cluster-fallback">
                          <Icon name="navGroup" size={15} />
                        </span>
                      ) : null}
                    </span>
                    <span className="group-home-item-copy">
                      <strong>{conversation.group?.title ?? conversation.title}</strong>
                      <span>{preview}</span>
                    </span>
                    <span className="group-home-item-chevron"><Icon name="chevron" size={14} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {controller.createSheetOpen ? <GroupCreateSheet controller={controller} /> : null}
    </div>
  );
}

function GroupCreateSheet({ controller }: GroupHomeProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (personaId: string) => {
    setSelectedIds((current) =>
      current.includes(personaId)
        ? current.filter((id) => id !== personaId)
        : [...current, personaId]
    );
  };

  return (
    <div className="group-sheet-backdrop" onClick={() => controller.setCreateSheetOpen(false)}>
      <div className="group-sheet" role="dialog" aria-label={t('group.create.title')} onClick={(event) => event.stopPropagation()}>
        <header className="group-sheet-header">
          <strong>{t('group.create.title')}</strong>
          <button
            type="button"
            className="group-icon-btn"
            onClick={() => controller.setCreateSheetOpen(false)}
            aria-label={t('group.create.cancel')}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        {controller.personas.length === 0 ? (
          <p className="group-sheet-empty">{t('group.create.noPersonas')}</p>
        ) : (
          <>
            <label className="group-field">
              <span>{t('group.create.nameLabel')}</span>
              <input
                type="text"
                value={title}
                placeholder={t('group.create.namePlaceholder')}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <div className="group-field">
              <span>{t('group.create.membersLabel')}</span>
              <ul className="group-member-pick-list">
                {controller.personas.map((persona) => {
                  const selected = selectedIds.includes(persona.id);
                  return (
                    <li key={persona.id}>
                      <button
                        type="button"
                        className={`group-member-pick ${selected ? 'is-selected' : ''}`}
                        onClick={() => toggle(persona.id)}
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
            </div>
            <footer className="group-sheet-footer">
              <button
                type="button"
                className="group-primary-btn"
                disabled={selectedIds.length === 0}
                onClick={() => controller.createGroup({ title, memberIds: selectedIds })}
              >
                {selectedIds.length === 0 ? t('group.create.needMembers') : t('group.create.confirm')}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
