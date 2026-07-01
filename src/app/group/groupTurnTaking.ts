import type { ChatMessage } from '../../types/domain';
import type { MentionTarget } from './groupMentions';

type SpeakerTarget = MentionTarget;

export type GroupRandomTurnPlan<T extends SpeakerTarget> = {
  member: T;
  delayMs: number;
};

function lastSpeakerId(messages: ChatMessage[], memberIds: Set<string>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const speakerId = message.speakerCollaboratorId ?? null;
    if (message.role === 'assistant' && speakerId && memberIds.has(speakerId) && message.content.trim()) {
      return speakerId;
    }
  }
  return null;
}

function rotateAfterLastSpeaker<T extends SpeakerTarget>(members: T[], messages: ChatMessage[]) {
  if (members.length <= 1) return members;
  const memberIds = new Set(members.map((member) => member.id));
  const speakerId = lastSpeakerId(messages, memberIds);
  if (!speakerId) return members;
  const speakerIndex = members.findIndex((member) => member.id === speakerId);
  if (speakerIndex < 0) return members;
  return [...members.slice(speakerIndex + 1), ...members.slice(0, speakerIndex + 1)];
}

export function orderGroupRoundRespondents<T extends SpeakerTarget>(
  members: T[],
  messages: ChatMessage[],
  mentioned: T[]
): T[] {
  const rotated = rotateAfterLastSpeaker(members, messages);
  if (mentioned.length === 0) return rotated;
  const mentionedIds = new Set(mentioned.map((member) => member.id));
  return [...mentioned, ...rotated.filter((member) => !mentionedIds.has(member.id))];
}

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function randomDelayMs(random: () => number) {
  const band = random();
  if (band < 0.42) return 0;
  if (band < 0.78) return 180 + Math.floor(random() * 520);
  return 760 + Math.floor(random() * 1240);
}

export function planGroupRandomRespondents<T extends SpeakerTarget>(
  members: T[],
  mentioned: T[],
  random: () => number = Math.random
): Array<GroupRandomTurnPlan<T>> {
  const candidates = mentioned.length > 0 ? mentioned : members;
  if (candidates.length === 0) return [];
  const count = mentioned.length > 0
    ? mentioned.length
    : Math.max(1, Math.min(candidates.length, 1 + Math.floor(random() * candidates.length)));
  return shuffle(candidates, random)
    .slice(0, count)
    .map((member) => ({ member, delayMs: randomDelayMs(random) }))
    .sort((a, b) => a.delayMs - b.delayMs);
}

export function insertRelayTargets<T extends SpeakerTarget>(
  queue: T[],
  targets: T[]
) {
  let inserted = 0;
  const queuedIds = new Set(queue.map((member) => member.id));
  for (const target of [...targets].reverse()) {
    if (queuedIds.has(target.id)) continue;
    queue.unshift(target);
    queuedIds.add(target.id);
    inserted += 1;
  }
  return inserted;
}
