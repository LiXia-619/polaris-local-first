import type { AvatarIconId } from '../../types/domain';

export const AVATAR_ICON_IDS: AvatarIconId[] = [
  'openai',
  'claude',
  'deepseek',
  'gemini',
  'kimi',
  'mimo',
  'mistral',
  'perplexity',
  'qwen',
  'xai',
  'doubao'
];

export const AVATAR_ICON_LABELS: Record<AvatarIconId, string> = {
  openai: 'GPT',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  kimi: 'Kimi',
  mimo: 'MiMo',
  mistral: 'Mistral',
  perplexity: 'Perplexity',
  qwen: 'Qwen',
  xai: 'Grok',
  doubao: '豆包'
};

export function normalizeAvatarIconId(value: unknown): AvatarIconId | null {
  return AVATAR_ICON_IDS.includes(value as AvatarIconId) ? value as AvatarIconId : null;
}
