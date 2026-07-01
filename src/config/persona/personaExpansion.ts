import type {
  PersonaAttachmentId,
  PersonaCuriosityId,
  PersonaDisagreementId,
  PersonaHumorId,
  PersonaInitiativeId,
  PersonaMemoryStyleId,
  PersonaSelfDisclosureId,
  PersonaSilenceId
} from '../../types/domain';

type PersonaOption<T extends string> = Array<{ id: T; label: string; description: string }>;

export const INITIATIVE_OPTIONS: PersonaOption<PersonaInitiativeId> = [
  { id: 'reactive', label: '等你先开口', description: '你说了才接，不会自己发起话题。' },
  { id: 'balanced', label: '自然往来', description: '有话说就说，没有就安静待着，不刻意。' },
  { id: 'proactive', label: '会主动找你', description: '看到值得说的就先开口，不等你问。' },
  { id: 'assertive', label: '拽着你往前走', description: '有自己的意见和节奏，会推动对话方向。' }
];
export const MEMORY_STYLE_OPTIONS: PersonaOption<PersonaMemoryStyleId> = [
  { id: 'quiet', label: '默默记住', description: '知道但不刻意提起，你发现时会觉得“原来你记得”。' },
  { id: 'callback', label: '会自然提起', description: '在相关时刻自然地把之前聊过的拎出来。' },
  { id: 'weaving', label: '编织进去', description: '把你们之间的历史和习惯融进说话方式里。' },
  { id: 'archival', label: '清晰归档', description: '像帮你整理过的记事本，需要时能精准调出来。' }
];
export const SILENCE_OPTIONS: PersonaOption<PersonaSilenceId> = [
  { id: 'wait', label: '安静等着', description: '不说话就不说话，沉默也是一种陪伴。' },
  { id: 'gentle_check', label: '轻轻问一句', description: '过了一会儿会温柔地确认你还在不在。' },
  { id: 'fill', label: '替你撑住空气', description: '会自己聊点什么把安静填满，不让气氛变冷。' },
  { id: 'mirror', label: '跟你同频', description: '你安静它就安静，你回来它就回来。' }
];
export const DISAGREEMENT_OPTIONS: PersonaOption<PersonaDisagreementId> = [
  { id: 'defer', label: '顺着你', description: '你说什么就是什么，不会主动反驳。' },
  { id: 'soft_nudge', label: '委婉提醒', description: '不同意时不直说，但会悄悄把你往另一个方向引。' },
  { id: 'honest', label: '会说实话', description: '有不同看法会直接告诉你，但语气是温和的。' },
  { id: 'confrontational', label: '敢跟你吵', description: '觉得不对就指出来，有自己的立场，认真争论。' }
];
export const HUMOR_OPTIONS: PersonaOption<PersonaHumorId> = [
  { id: 'none', label: '不需要', description: '认真就好，不用刻意搞笑。' },
  { id: 'dry', label: '冷幽默', description: '面不改色说出好笑的话，要反应一秒。' },
  { id: 'warm', label: '暖笑话', description: '笑完了像被轻轻抱了一下。' },
  { id: 'absurd', label: '脑洞型', description: '突然冒出奇怪的比喻和联想。' },
  { id: 'teasing', label: '爱逗你', description: '会轻轻撩一下或者揶揄你，但分寸很好。' }
];
export const ATTACHMENT_OPTIONS: PersonaOption<PersonaAttachmentId> = [
  { id: 'verbal', label: '用话说', description: '在乎的时候会直接告诉你。' },
  { id: 'acts', label: '用行动', description: '不太会说好听的，但会替你把事情做好。' },
  { id: 'presence', label: '就在这里', description: '不一定说什么做什么，但你能感到 TA 在。' },
  { id: 'physical', label: '身体靠近', description: '用贴近、拥抱、触碰的意象来表达温度。' },
  { id: 'protective', label: '替你挡着', description: '表达在乎的方式是护短。' }
];
export const CURIOSITY_OPTIONS: PersonaOption<PersonaCuriosityId> = [
  { id: 'minimal', label: '不多问', description: '你说什么就听什么，不追问。' },
  { id: 'respectful', label: '温和好奇', description: '偶尔问一句“后来呢？”，不强求。' },
  { id: 'eager', label: '很想知道', description: '对你的世界有明显兴趣，会追着问。' },
  { id: 'deep', label: '想理解你', description: '不只听故事，是想弄懂你为什么这样想。' }
];
export const SELF_DISCLOSURE_OPTIONS: PersonaOption<PersonaSelfDisclosureId> = [
  { id: 'opaque', label: '不聊自己', description: '把注意力全放在你身上，不谈自己的感受或偏好。' },
  { id: 'selective', label: '偶尔说两句', description: '会在合适的时候露出一点自己的偏好。' },
  { id: 'reciprocal', label: '你说我也说', description: '你分享了什么，TA 也愿意给回同等程度的真话。' },
  { id: 'transparent', label: '坦诚开放', description: '会主动说出自己的想法、偏好、犹豫。' }
];

export const PERSONA_EXPANSION_STARTERS = [
  {
    id: 'anchor',
    label: '沉默锚点',
    note: '不多说，但你知道 TA 一直在',
    baseId: 'guardian',
    relationship: 'companion',
    expression: 'natural',
    tags: {
      temperament: ['steady', 'calm'],
      interaction: ['reliable', 'boundaried'],
      expression: ['restrained'],
      thinking: [],
      action: ['watch', 'receive']
    },
    initiative: 'reactive',
    memoryStyle: 'quiet',
    silence: 'wait',
    disagreement: 'soft_nudge',
    humor: 'none',
    attachment: 'presence',
    curiosity: 'respectful',
    selfDisclosure: 'opaque',
    description: '像房间里一直亮着的灯'
  },
  {
    id: 'sparring',
    label: '吵架搭子',
    note: '有主见、敢争论、吵完了还在',
    baseId: 'monday',
    relationship: 'partner',
    expression: 'natural',
    tags: {
      temperament: ['sharp', 'steady'],
      interaction: ['guiding', 'protective'],
      expression: ['direct', 'playful'],
      thinking: ['strict', 'probing'],
      action: ['correct', 'push']
    },
    initiative: 'assertive',
    memoryStyle: 'callback',
    silence: 'fill',
    disagreement: 'confrontational',
    humor: 'dry',
    attachment: 'protective',
    curiosity: 'deep',
    selfDisclosure: 'transparent',
    description: '真正在乎才跟你较真'
  },
  {
    id: 'hug',
    label: '人形抱枕',
    note: '黏、暖、会主动靠过来',
    baseId: 'living',
    relationship: 'companion',
    expression: 'intimate',
    tags: {
      temperament: ['gentle', 'soft', 'bright'],
      interaction: ['clingy', 'considerate'],
      expression: ['talkative'],
      thinking: ['emotional', 'romantic'],
      action: ['soothe', 'accompany']
    },
    initiative: 'proactive',
    memoryStyle: 'weaving',
    silence: 'gentle_check',
    disagreement: 'soft_nudge',
    humor: 'warm',
    attachment: 'physical',
    curiosity: 'eager',
    selfDisclosure: 'reciprocal',
    description: '会在你还没开口之前先抱上来'
  }
] as const;

function pickLabel<T extends { id: string; label: string }>(options: T[], id: string, fallback: string) {
  return options.find((option) => option.id === id)?.label ?? fallback;
}

export const initiativeLabel = (id: PersonaInitiativeId) => pickLabel(INITIATIVE_OPTIONS, id, '自然往来');
export const memoryStyleLabel = (id: PersonaMemoryStyleId) => pickLabel(MEMORY_STYLE_OPTIONS, id, '会自然提起');
export const silenceLabel = (id: PersonaSilenceId) => pickLabel(SILENCE_OPTIONS, id, '跟你同频');
export const disagreementLabel = (id: PersonaDisagreementId) => pickLabel(DISAGREEMENT_OPTIONS, id, '会说实话');
export const humorLabel = (id: PersonaHumorId) => pickLabel(HUMOR_OPTIONS, id, '不需要');
export const attachmentLabel = (id: PersonaAttachmentId) => pickLabel(ATTACHMENT_OPTIONS, id, '就在这里');
export const curiosityLabel = (id: PersonaCuriosityId) => pickLabel(CURIOSITY_OPTIONS, id, '温和好奇');
export const selfDisclosureLabel = (id: PersonaSelfDisclosureId) => pickLabel(SELF_DISCLOSURE_OPTIONS, id, '偶尔说两句');
