import { useMemo } from 'react';
import { useI18n } from '../../../i18n';
import type { Conversation, Persona, RoomProject } from '../../../types/domain';
import { CollectionShelfLead } from './CollectionShelfLead';
import { ConversationCardGrid } from './ConversationCardGrid';

type DialogueCollectionShelfProps = {
  cardsExpanded: boolean;
  conversations: Conversation[];
  personas: Persona[];
  roomProjects: RoomProject[];
  activeConversationId: string | null;
  editingConversationId: string | null;
  conversationTitleDraft: string;
  onConversationTitleDraftChange: (value: string) => void;
  onStartConversationRename: (conversationId: string, title: string) => void;
  onCommitConversationRename: (conversationId: string) => void;
  onCancelConversationRename: () => void;
  onConversationPinToggle: (conversationId: string) => void;
  onConversationDelete: (conversationId: string, title: string) => void;
  onOpenConversation: (conversationId: string) => void;
};

export function DialogueCollectionShelf({
  cardsExpanded,
  conversations,
  personas,
  roomProjects,
  activeConversationId,
  editingConversationId,
  conversationTitleDraft,
  onConversationTitleDraftChange,
  onStartConversationRename,
  onCommitConversationRename,
  onCancelConversationRename,
  onConversationPinToggle,
  onConversationDelete,
  onOpenConversation
}: DialogueCollectionShelfProps) {
  const { t, formatNumber } = useI18n();
  const projectTitleById = useMemo(
    () => Object.fromEntries(roomProjects.map((project) => [project.id, project.title] as const)),
    [roomProjects]
  );
  const densityClass = conversations.length > 8 ? 'cards-heavy' : 'cards-normal';
  const sectionMeta = t('collection.dialogue.shelfCount', { count: formatNumber(conversations.length) });

  return (
    <section className={`collection-shelf-stack collection-shelf-stack--dialogue ${densityClass}`}>
      <CollectionShelfLead
        meta={sectionMeta}
        helpText={t('collection.dialogue.shelfHelp')}
      />
      <ConversationCardGrid
        cardsExpanded={cardsExpanded}
        conversations={conversations}
        personas={personas}
        projectTitleById={projectTitleById}
        activeConversationId={activeConversationId}
        editingConversationId={editingConversationId}
        conversationTitleDraft={conversationTitleDraft}
        onConversationTitleDraftChange={onConversationTitleDraftChange}
        onStartConversationRename={onStartConversationRename}
        onCommitConversationRename={onCommitConversationRename}
        onCancelConversationRename={onCancelConversationRename}
        onConversationPinToggle={onConversationPinToggle}
        onConversationDelete={onConversationDelete}
        onOpenConversation={onOpenConversation}
      />
    </section>
  );
}
