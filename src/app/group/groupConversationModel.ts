import { isGroupConversation } from '../../engines/conversationOwnership';
import type { Conversation, Persona } from '../../types/domain';

export function groupConversations(conversations: Conversation[]) {
  return conversations.filter(isGroupConversation);
}

export function groupLineageId(conversation: Conversation) {
  return conversation.group?.lineageId ?? conversation.id;
}

export type GroupFamily = {
  lineageId: string;
  latest: Conversation;
  conversations: Conversation[];
};

export function buildGroupFamilies(conversations: Conversation[]): GroupFamily[] {
  const byLineage = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const lineage = groupLineageId(conversation);
    byLineage.set(lineage, [...(byLineage.get(lineage) ?? []), conversation]);
  }
  return Array.from(byLineage.entries())
    .map(([lineageId, members]) => {
      const sorted = [...members].sort((a, b) => b.updatedAt - a.updatedAt);
      return { lineageId, latest: sorted[0], conversations: sorted };
    })
    .sort((a, b) => b.latest.updatedAt - a.latest.updatedAt);
}

export function groupTitleFromMembers(members: Persona[]) {
  const names = members.map((member) => member.name.trim()).filter(Boolean);
  if (names.length === 0) return '新群聊';
  if (names.length <= 3) return names.join(' / ');
  return `${names.slice(0, 3).join(' / ')} 等 ${names.length} 位`;
}
