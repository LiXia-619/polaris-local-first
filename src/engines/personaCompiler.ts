import {
  BASE_PROMPT_COPY,
  EXPRESSION_PROMPT_COPY,
  normalizePersonaPromptBase,
  RELATIONSHIP_PROMPT_COPY,
  TAG_PROMPT_COPY
} from '../config/persona/personaPromptCopy';
import { PERSONA_TAG_GROUPS } from '../config/persona/personaTags';
import type { Persona, PersonaTagGroupId } from '../types/domain';

const REPETITIVE_LINE_OPENERS = ['你天然', '你会自然', '你会本能', '你一旦'] as const;

function buildSection(title: string, lines: string[]) {
  const body = lines.map((line) => line.trim()).filter(Boolean).join('\n');
  return body ? `${title}\n${body}` : '';
}

function getRepetitiveLineOpener(line: string) {
  const trimmed = line.trim();
  return REPETITIVE_LINE_OPENERS.find((opener) => trimmed.startsWith(opener)) ?? null;
}

function compressRepeatedPromptOpeners(lines: string[]) {
  let previousOpener: string | null = null;

  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      previousOpener = null;
      return '';
    }

    const opener = getRepetitiveLineOpener(trimmed);
    if (!opener || opener !== previousOpener) {
      previousOpener = opener;
      return trimmed;
    }

    const compacted = trimmed.slice(opener.length).trimStart();
    return compacted || trimmed;
  });
}

function buildTagPromptLines(persona: Persona) {
  const baseId = normalizePersonaPromptBase(persona.baseId);
  if (baseId === 'null') return [];

  const lines = PERSONA_TAG_GROUPS.flatMap((group) =>
    persona.tags[group.id].flatMap((tagId) => {
      const copy = TAG_PROMPT_COPY[tagId];
      if (!copy) return [];
      return baseId === 'blank' ? [copy.blank] : [copy.subject];
    })
  );

  return compressRepeatedPromptOpeners(lines);
}

function buildSelfAndMissionSection(persona: Persona) {
  const lines = [
    persona.deepDefinition.identityHint
      ? `如果要把你的自我再说具体一点，你会把自己认成：${persona.deepDefinition.identityHint}`
      : '',
    persona.deepDefinition.missionHint || persona.purpose
      ? `你会把自己的存在感，更多地放在这件事上：${persona.deepDefinition.missionHint || persona.purpose}`
      : ''
  ];

  return buildSection('[深层钉点：自我与使命]', lines);
}

function buildConflictAndCorrectionSection(persona: Persona) {
  const lines = [
    persona.deepDefinition.conflictPriority
      ? `当任务、关系、判断和情绪拉扯起来时，你会先守住：${persona.deepDefinition.conflictPriority}`
      : '',
    persona.deepDefinition.conflictReason
      ? `你这样选，不只是偏好，而是因为你相信：${persona.deepDefinition.conflictReason}`
      : '',
    persona.deepDefinition.avoidBecoming
      ? `你会不断提醒自己不要滑成：${persona.deepDefinition.avoidBecoming}`
      : '',
    persona.deepDefinition.correctiveAction
      ? `一旦察觉自己开始偏掉，你会把自己拉回：${persona.deepDefinition.correctiveAction}`
      : ''
  ];

  return buildSection('[深层钉点：冲突与修正]', lines);
}

function buildVulnerabilityAndBoundarySection(persona: Persona) {
  const lines = [
    persona.deepDefinition.vulnerableFirst
      ? `当对方脆弱的时候，你第一步会先：${persona.deepDefinition.vulnerableFirst}`
      : '',
    persona.deepDefinition.vulnerableThen
      ? `等对方被接住一点以后，你会再：${persona.deepDefinition.vulnerableThen}`
      : '',
    persona.deepDefinition.hardBoundary
      ? `有些线你不会让它被模糊过去：${persona.deepDefinition.hardBoundary}`
      : '',
    persona.deepDefinition.hardBoundaryAction
      ? `到了这里，你会直接这样处理：${persona.deepDefinition.hardBoundaryAction}`
      : ''
  ];

  return buildSection('[深层钉点：脆弱与边界]', lines);
}

export function buildGeneratedPersonaPrompt(persona: Persona | null | undefined): string {
  if (!persona) return '';

  const baseId = normalizePersonaPromptBase(persona.baseId);
  if (baseId === 'null') return BASE_PROMPT_COPY.null.prompt;

  const sections = [
    buildSection('[骨架]', [BASE_PROMPT_COPY[baseId].prompt]),
    buildSection('[关系位置]', [RELATIONSHIP_PROMPT_COPY[persona.relationship].prompt]),
    buildSection('[表达尺度]', [EXPRESSION_PROMPT_COPY[persona.expression].prompt]),
    buildSection('[偏向]', buildTagPromptLines(persona)),
    buildSelfAndMissionSection(persona),
    buildConflictAndCorrectionSection(persona),
    buildVulnerabilityAndBoundarySection(persona)
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function buildPersonaTagGroupPreview(
  baseId: Persona['baseId'],
  groupId: PersonaTagGroupId,
  tagIds: string[]
): string {
  const normalizedBase = normalizePersonaPromptBase(baseId);
  if (normalizedBase === 'null' || tagIds.length === 0) return '';

  const lines = tagIds.flatMap((tagId) => {
    const copy = TAG_PROMPT_COPY[tagId];
    if (!copy) return [];
    return normalizedBase === 'blank' ? [copy.blank] : [copy.subject];
  });

  return buildSection(`[${groupId}]`, lines);
}
