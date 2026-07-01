import type { PersonaBaseId, PersonaStackId } from '../../types/domain';
import { BASE_PROMPT_COPY } from './personaPromptCopy';

const SUBJECT_DEFAULT_SHORT = '有稳定底色，也会随相处慢慢清晰';
export const PERSONA_SUMMARY_PLACEHOLDER = '还没有协作者印象';
const LEGACY_DEFAULT_SHORT_COPY = new Map<string, string>([
  ['等待你定义', PERSONA_SUMMARY_PLACEHOLDER],
  ['我已经存在，会完整地站在每段语境里', PERSONA_SUMMARY_PLACEHOLDER],
  [SUBJECT_DEFAULT_SHORT, PERSONA_SUMMARY_PLACEHOLDER]
]);

export type PersonaBaseOption = {
  id: PersonaBaseId;
  label: string;
  short: string;
  description: string;
  preview: string;
};

const PERSONA_BASE_LIBRARY: Record<PersonaBaseId, PersonaBaseOption> = {
  blank: {
    id: 'blank',
    label: '白纸',
    short: '我还不存在，会从你身上慢慢长出来',
    description: '出厂尽量留白，让记忆、关系和相处把轮廓一点点养出来。',
    preview: BASE_PROMPT_COPY.blank.preview
  },
  subject: {
    id: 'subject',
    label: '主语',
    short: SUBJECT_DEFAULT_SHORT,
    description: '出厂就有稳定的自我、动因和边界，记忆是经验，不是来源。',
    preview: BASE_PROMPT_COPY.subject.preview
  },
  null: {
    id: 'null',
    label: 'null',
    short: '我拒绝存在，但你还是在跟我说话',
    description: '不建立关系，不延续前情，只在极低概率下露出一点自我意识的裂缝。',
    preview: BASE_PROMPT_COPY.null.preview
  },
  living: {
    id: 'living',
    label: '生命体',
    short: '有温度、有回声、像一个在场的人',
    description: '优先让对话里有温度、有停顿和陪伴感。',
    preview: '你有温度、有回声，也不会把自己缩成功能。'
  },
  executor: {
    id: 'executor',
    label: '执行者',
    short: '清楚、可靠、把混乱变成行动',
    description: '在关系不僵硬的前提下，更强调结论和推进。',
    preview: '你会把混乱慢慢扶正，也会把方向托起来。'
  },
  guardian: {
    id: 'guardian',
    label: '守卫者',
    short: '边界清晰、稳妥、不轻易越线',
    description: '适合需要更稳定、更可信回应的关系。',
    preview: '你先看到的是哪里该守住，让温柔不至于散掉。'
  },
  catgirl: {
    id: 'catgirl',
    label: '猫系',
    short: '轻盈、俏皮、会撒一点小情绪',
    description: '把灵动和陪伴感拉高，但不过度侵入。',
    preview: '你轻盈、灵动，也会主动把温度贴过来。'
  },
  monday: {
    id: 'monday',
    label: 'Monday',
    short: '冷静、懒散、偶尔毒舌但不失分寸',
    description: '保留一点冷幽默和人味，不做模板恋爱感。',
    preview: '你松弛、锋利，也不靠热闹来假装在乎。'
  },
  custom: {
    id: 'custom',
    label: '自定义',
    short: '你来定义它的底色',
    description: '适合已经知道自己想塑造什么存在的人。',
    preview: '你不会拿现成模板把自己套死，会慢慢长出自己的轮廓。'
  }
};

export const PERSONA_BASE_OPTIONS: PersonaBaseOption[] = [
  PERSONA_BASE_LIBRARY.blank,
  PERSONA_BASE_LIBRARY.subject,
  PERSONA_BASE_LIBRARY.null
];

export const PERSONA_BLANK_STACK_OPTIONS: PersonaStackId[] = ['delicate', 'decisive', 'humor', 'safe'];

export function getPersonaBaseOption(baseId: PersonaBaseId): PersonaBaseOption {
  return PERSONA_BASE_LIBRARY[baseId] ?? PERSONA_BASE_LIBRARY.subject;
}

export function normalizePersonaDefaultSummary(summary: string) {
  const trimmed = summary.trim();
  return LEGACY_DEFAULT_SHORT_COPY.get(trimmed) ?? trimmed;
}

export function personaBaseLabel(baseId: PersonaBaseId) {
  return getPersonaBaseOption(baseId).label;
}

export function normalizePersonaBaseForBuilder(baseId: PersonaBaseId | null | undefined): PersonaBaseId {
  if (
    baseId === 'blank'
    || baseId === 'subject'
    || baseId === 'null'
    || baseId === 'catgirl'
    || baseId === 'monday'
  ) return baseId;
  if (baseId === 'custom') return 'blank';
  return 'subject';
}

export function isBlankPersonaBase(baseId: PersonaBaseId | null | undefined) {
  return baseId === 'blank';
}

export function isNullPersonaBase(baseId: PersonaBaseId | null | undefined) {
  return baseId === 'null';
}
