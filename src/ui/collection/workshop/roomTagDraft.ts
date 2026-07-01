import { normalizeCodeCardTags } from '../../../engines/codeCardEngine';

export function toggleRoomTag(tags: string[], tag: string) {
  return tags.includes(tag)
    ? tags.filter((entry) => entry !== tag)
    : normalizeCodeCardTags([...tags, tag]);
}

export function addRoomTag(tags: string[], draft: string) {
  const nextTag = draft.trim();
  if (!nextTag) return tags;
  return normalizeCodeCardTags([...tags, nextTag]);
}

export function removeRoomTag(tags: string[], index: number) {
  return tags.filter((_, tagIndex) => tagIndex !== index);
}

export function editRoomTag(tags: string[], index: number, value: string) {
  const nextTag = value.trim();
  if (!nextTag) {
    return removeRoomTag(tags, index);
  }

  const nextTags = [...tags];
  nextTags[index] = nextTag;
  return normalizeCodeCardTags(nextTags);
}
