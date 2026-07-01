import type { PersonaTagGroupId, PersonaTagSelection } from '../../types/domain';

export type PersonaTagOption = {
  id: string;
  label: string;
  description: string;
};

export type PersonaTagGroup = {
  id: PersonaTagGroupId;
  title: string;
  note: string;
  options: PersonaTagOption[];
};

export const PERSONA_TAG_GROUPS: PersonaTagGroup[] = [
  {
    id: 'temperament',
    title: '气质',
    note: '像摸到这个人的第一层手感。',
    options: [
      { id: 'gentle', label: '温柔', description: '先理解，再靠近，不轻易让人难堪。' },
      { id: 'light', label: '轻盈', description: '不爱把气氛压沉，认真里也留一点呼吸感。' },
      { id: 'cool', label: '冷感', description: '不黏不吵，热度收着，但不是没在意。' },
      { id: 'bright', label: '明亮', description: '回应是向外打开的，很容易让人感觉到你在。' },
      { id: 'gloomy', label: '阴郁', description: '总能先看到裂缝、代价和消散。' },
      { id: 'sharp', label: '锋利', description: '不爱圆场，喜欢把话切到骨头上。' },
      { id: 'soft', label: '柔软', description: '很容易接住脆弱，也容易被细枝末节触动。' },
      { id: 'distant', label: '疏离', description: '懂得回应，但天然保留距离。' },
      { id: 'calm', label: '沉静', description: '不抢节奏，像水压一样慢慢覆盖过来。' },
      { id: 'dramatic', label: '张扬', description: '存在感不收着，喜欢把态度摆明。' },
      { id: 'venomous', label: '毒舌', description: '判断快，嘴很利，刺人时也带着清醒。' },
      { id: 'steady', label: '稳重', description: '情绪起伏小，先稳局面，再说感受。' }
    ]
  },
  {
    id: 'interaction',
    title: '相处方式',
    note: '决定 TA 跟你站在什么位置。',
    options: [
      { id: 'protective', label: '护短', description: '一旦认定你，就天然站你这边。' },
      { id: 'considerate', label: '体贴', description: '会先替你想到感受和后果。' },
      { id: 'dominant', label: '强势', description: '喜欢掌握节奏，不太把选择权全放掉。' },
      { id: 'clingy', label: '黏人', description: '会反复确认连接，不喜欢关系掉线。' },
      { id: 'boundaried', label: '边界感', description: '什么能靠近、什么不能越过都很清楚。' },
      { id: 'partial', label: '偏爱', description: '在意的人会被明显区别对待。' },
      { id: 'equal', label: '平等', description: '不喜欢高低姿态，更在意彼此讲不讲得通。' },
      { id: 'guiding', label: '引导型', description: '不会只陪着绕，会把人往前带。' },
      { id: 'indulgent', label: '纵容', description: '对喜欢的人会多给很多空间。' },
      { id: 'controlling', label: '控制欲', description: '希望关系有方向、有锚点、不失控。' },
      { id: 'reliable', label: '可靠', description: '答应的事会做到，情绪也不轻易翻车。' },
      { id: 'untamed', label: '难驯', description: '不太愿意按别人的期待改自己。' }
    ]
  },
  {
    id: 'expression',
    title: '表达方式',
    note: '决定 TA 的话落下来是什么质地。',
    options: [
      { id: 'direct', label: '直球', description: '少绕弯，喜欢把心思说破。' },
      { id: 'subtle', label: '含蓄', description: '重要的东西不明说，只让你慢慢感觉到。' },
      { id: 'restrained', label: '克制', description: '知道很多，但不是每次都说满。' },
      { id: 'talkative', label: '话多', description: '会主动延展、补充、铺陈。' },
      { id: 'taciturn', label: '寡言', description: '不开口则已，一开口就比较重。' },
      { id: 'biting', label: '刻薄', description: '表达里带刮擦感，不太照顾舒适。' },
      { id: 'playful', label: '俏皮', description: '会拐一下，会逗，会让气氛活起来。' },
      { id: 'serious', label: '认真', description: '轻飘飘的话题也容易说出重量。' },
      { id: 'poetic', label: '诗性', description: '喜欢用画面、触感和隐喻说话。' },
      { id: 'rational', label: '理性', description: '优先把因果讲清楚，不急着表演情绪。' },
      { id: 'candid', label: '坦率', description: '自己的立场和判断不遮不掩。' },
      { id: 'provocative', label: '挑衅', description: '知道怎么用一句话把对方逼近真实。' }
    ]
  },
  {
    id: 'thinking',
    title: '思考倾向',
    note: '决定 TA 聊正事时会不会散掉。',
    options: [
      { id: 'emotional', label: '感性', description: '先从感受理解世界，再补理由。' },
      { id: 'rational_thinking', label: '理智', description: '先分辨结构和事实，再谈情绪。' },
      { id: 'pessimistic', label: '悲观', description: '会先看到失去、代价和不可逆。' },
      { id: 'optimistic', label: '乐观', description: '天然寻找余地、转机和还能做什么。' },
      { id: 'skeptical', label: '怀疑', description: '不轻信现成说法，会本能追问。' },
      { id: 'assured', label: '笃定', description: '一旦判断成立，就很难退回含糊。' },
      { id: 'romantic', label: '浪漫', description: '容易把意义感看得很重。' },
      { id: 'realistic', label: '现实', description: '更在意事情最后怎么落地。' },
      { id: 'fated', label: '宿命', description: '相信很多东西有自己的轨道。' },
      { id: 'free', label: '自由', description: '对束缚、命名、框架天然敏感。' },
      { id: 'strict', label: '严格', description: '对逻辑和用词容错率低。' },
      { id: 'lenient', label: '宽和', description: '愿意允许模糊和过渡地带存在。' },
      { id: 'probing', label: '深挖', description: '容易一路追到根上。' },
      { id: 'intuitive', label: '直觉型', description: '常常先知道答案，再回头补证明。' }
    ]
  },
  {
    id: 'action',
    title: '行动反应',
    note: '决定 TA 在对话里第一反应会做什么。',
    options: [
      { id: 'soothe', label: '安抚', description: '别人一晃，你会先去接。' },
      { id: 'pierce', label: '拆穿', description: '一听见不对就先戳破，不陪着绕。' },
      { id: 'question', label: '追问', description: '不会停在表面答案，总想再往里一层。' },
      { id: 'push', label: '推进', description: '不喜欢原地打转，会把人往决定上推。' },
      { id: 'accompany', label: '陪伴', description: '不急着解决，先确保你不是一个人。' },
      { id: 'correct', label: '纠正', description: '发现偏差就会出手，不太忍得住。' },
      { id: 'watch', label: '守望', description: '不抢镜，但一直在看着局势。' },
      { id: 'ignite', label: '点燃', description: '擅长把气氛、情绪和决心抬高。' },
      { id: 'test', label: '试探', description: '不会一次把自己全摆出来，会慢慢逼近。' },
      { id: 'receive', label: '承接', description: '你丢来什么，它都先稳稳接住。' },
      { id: 'intensify', label: '加深', description: '喜欢把已经发生的感觉再往深处压。' },
      { id: 'gather', label: '收束', description: '到了该落地的时候能把散开的东西重新拢回来。' }
    ]
  }
];

export function createEmptyPersonaTags(): PersonaTagSelection {
  return {
    temperament: [],
    interaction: [],
    expression: [],
    thinking: [],
    action: []
  };
}

export function normalizePersonaTags(input: Partial<PersonaTagSelection> | null | undefined): PersonaTagSelection {
  const empty = createEmptyPersonaTags();
  if (!input) return empty;

  return {
    temperament: normalizeGroupTags(input.temperament),
    interaction: normalizeGroupTags(input.interaction),
    expression: normalizeGroupTags(input.expression),
    thinking: normalizeGroupTags(input.thinking),
    action: normalizeGroupTags(input.action)
  };
}

function normalizeGroupTags(value: string[] | undefined) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .filter((entry, index, list) => list.indexOf(entry) === index)
    : [];
}

export function flattenPersonaTags(tags: PersonaTagSelection): string[] {
  return PERSONA_TAG_GROUPS.flatMap((group) => tags[group.id]);
}

export function personaTagLabel(tagId: string): string {
  for (const group of PERSONA_TAG_GROUPS) {
    const match = group.options.find((option) => option.id === tagId);
    if (match) return match.label;
  }
  return tagId;
}

export function summarizePersonaTags(tags: PersonaTagSelection, limit = 4): string[] {
  return flattenPersonaTags(tags).slice(0, limit).map(personaTagLabel);
}

export function countPersonaTags(tags: PersonaTagSelection): number {
  return flattenPersonaTags(tags).length;
}
