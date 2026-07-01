import { normalizeCodeLanguage } from '../../engines/codeCardEngine';
import type { CodeCard } from '../../types/domain';

export type CodeCardPresentation = 'code' | 'text';

const TEXT_CARD_LANGUAGES = new Set(['text', 'txt', 'markdown', 'md']);

export function resolveCodeCardPresentation(card: Pick<CodeCard, 'kind' | 'language'>): CodeCardPresentation {
  return TEXT_CARD_LANGUAGES.has(normalizeCodeLanguage(card.language)) ? 'text' : 'code';
}
