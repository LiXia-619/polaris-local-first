import { buildNumberedPromptLines } from './promptFormatting';

export type MemoryTier = 'core' | 'preference' | 'context';
export type MemorySensitivity = 'low' | 'high';

export type MemoryDescriptor = {
  text: string;
  normalizedText: string;
  tier: MemoryTier;
  sensitivity: MemorySensitivity;
};

const HIGH_RISK_PATTERN =
  /身份证|手机号|电话|地址|住址|生日|年龄|真名|本名|全名|公司|学校|银行卡|密码|邮箱|病史|疾病|药物|收入|财务|家庭成员|家人|坐标|位置/i;
const CORE_PATTERN = /称呼|叫我|关系|长期|总是|固定|一定要|边界|禁区|不要提/i;
const PREFERENCE_PATTERN = /喜欢|偏好|习惯|常用|倾向|更爱|最好|希望|想要|讨厌|不喜欢/i;

function normalizeMemoryText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function classifyMemoryTier(text: string): MemoryTier {
  if (CORE_PATTERN.test(text)) return 'core';
  if (PREFERENCE_PATTERN.test(text)) return 'preference';
  return 'context';
}

function classifyMemorySensitivity(text: string): MemorySensitivity {
  return HIGH_RISK_PATTERN.test(text) ? 'high' : 'low';
}

export function describeMemoryItem(text: string): MemoryDescriptor | null {
  const normalizedText = normalizeMemoryText(text);
  if (!normalizedText) return null;

  return {
    text: normalizedText,
    normalizedText: normalizedText.toLowerCase(),
    tier: classifyMemoryTier(normalizedText),
    sensitivity: classifyMemorySensitivity(normalizedText)
  };
}

function memoryTierWeight(tier: MemoryTier): number {
  switch (tier) {
    case 'core':
      return 0;
    case 'preference':
      return 1;
    default:
      return 2;
  }
}

export function buildWeightedMemoryLines(lines: string[]): string[] {
  const deduped = new Map<string, MemoryDescriptor>();
  for (const line of lines) {
    const descriptor = describeMemoryItem(line);
    if (!descriptor) continue;
    if (!deduped.has(descriptor.normalizedText)) {
      deduped.set(descriptor.normalizedText, descriptor);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => memoryTierWeight(left.tier) - memoryTierWeight(right.tier) || left.text.localeCompare(right.text))
    .map((item) => item.text);
}

export function buildMemorySegmentLines(lines: string[]): string[] {
  return buildNumberedPromptLines(buildWeightedMemoryLines(lines), (line) => line);
}

export function classifyMemoryWriteItems(items: string[]) {
  const lowRisk: string[] = [];
  const highRisk: string[] = [];

  for (const item of buildWeightedMemoryLines(items)) {
    const descriptor = describeMemoryItem(item);
    if (!descriptor) continue;

    if (descriptor.sensitivity === 'high') {
      highRisk.push(descriptor.text);
    } else {
      lowRisk.push(descriptor.text);
    }
  }

  return { lowRisk, highRisk };
}

export function memoryPreviewSummary(items: string[]): string {
  return `检测到 ${items.length} 条可能偏敏感的记忆，待确认后再写入`;
}
