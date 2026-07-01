export type MentionTarget = {
  id: string;
  name: string;
};

/**
 * 从消息里解析 @成员。
 * 长名字优先占位，避免「@小助手」同时命中名为「小助」的成员；
 * 已占用的文本区间不再被更短的名字重复命中。
 */
export function extractMentions<T extends MentionTarget>(
  content: string,
  members: T[],
  excludeId?: string
): T[] {
  // 被排除的名字（发言者自己）也参与占位，否则「@小助手」的残段会泄漏命中「小助」
  const candidates = members
    .filter((member) => member.name.trim().length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const takenRanges: Array<[number, number]> = [];
  const hits: Array<{ id: string; index: number }> = [];

  for (const member of candidates) {
    const token = `@${member.name}`;
    let searchFrom = 0;
    while (true) {
      const at = content.indexOf(token, searchFrom);
      if (at === -1) break;
      const end = at + token.length;
      const overlaps = takenRanges.some(([start, stop]) => at < stop && end > start);
      if (!overlaps) {
        takenRanges.push([at, end]);
        if (member.id !== excludeId) {
          hits.push({ id: member.id, index: at });
        }
      }
      searchFrom = end;
    }
  }

  const firstHitById = new Map<string, number>();
  for (const hit of hits) {
    firstHitById.set(hit.id, Math.min(firstHitById.get(hit.id) ?? hit.index, hit.index));
  }
  return [...firstHitById.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => members.find((member) => member.id === id))
    .filter((member): member is T => Boolean(member));
}
