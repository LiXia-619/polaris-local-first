import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/domain';
import { insertRelayTargets, orderGroupRoundRespondents, planGroupRandomRespondents } from './groupTurnTaking';

const MEMBERS = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' }
];

function assistant(id: string, speakerCollaboratorId: string, content = 'hi'): ChatMessage {
  return {
    id,
    role: 'assistant',
    content,
    timestamp: 1,
    speakerCollaboratorId
  };
}

describe('orderGroupRoundRespondents', () => {
  it('uses explicit mentions as the front of the round', () => {
    expect(orderGroupRoundRespondents(MEMBERS, [], [MEMBERS[2], MEMBERS[0]]).map((member) => member.id))
      .toEqual(['c', 'a', 'b']);
  });

  it('starts after the last member who spoke when nobody is mentioned', () => {
    expect(orderGroupRoundRespondents(MEMBERS, [assistant('m1', 'b')], []).map((member) => member.id))
      .toEqual(['c', 'a', 'b']);
  });

  it('ignores empty streaming placeholders when finding the last speaker', () => {
    expect(orderGroupRoundRespondents(MEMBERS, [assistant('m1', 'a'), assistant('m2', 'b', '')], []).map((member) => member.id))
      .toEqual(['b', 'c', 'a']);
  });
});

describe('planGroupRandomRespondents', () => {
  it('chooses a random subset with random delays', () => {
    const values = [0.68, 0.1, 0.9, 0.5, 0.2, 0.4, 0.9, 0.25, 0.7];
    let index = 0;
    const plan = planGroupRandomRespondents(MEMBERS, [], () => values[index++] ?? 0);
    expect(plan.map((item) => item.member.id)).toEqual(['b', 'c', 'a']);
    expect(plan.map((item) => item.delayMs)).toEqual([0, 284, 1070]);
  });

  it('keeps explicit mentions as the candidate set', () => {
    const plan = planGroupRandomRespondents(MEMBERS, [MEMBERS[2]], () => 0);
    expect(plan.map((item) => item.member.id)).toEqual(['c']);
    expect(plan[0].delayMs).toBe(0);
  });
});

describe('insertRelayTargets', () => {
  it('places mentioned relay targets next without duplicating queued members', () => {
    const queue = [MEMBERS[1], MEMBERS[2]];
    const inserted = insertRelayTargets(queue, [MEMBERS[2], MEMBERS[0]]);
    expect(inserted).toBe(1);
    expect(queue.map((member) => member.id)).toEqual(['a', 'b', 'c']);
  });

  it('allows a relay target to speak again when they already spoke earlier in the round', () => {
    const queue = [MEMBERS[2]];
    const inserted = insertRelayTargets(queue, [MEMBERS[0]]);
    expect(inserted).toBe(1);
    expect(queue.map((member) => member.id)).toEqual(['a', 'c']);
  });

  it('does not cap relay insertions before the user stops the group', () => {
    const queue: typeof MEMBERS = [];
    const inserted = insertRelayTargets(queue, MEMBERS);
    expect(inserted).toBe(3);
    expect(queue.map((member) => member.id)).toEqual(['a', 'b', 'c']);
  });
});
