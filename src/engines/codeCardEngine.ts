import type { CodeCard } from '../types/domain';
import { deriveCodeCardTitle, MAX_CODE_CARD_TAGS, normalizeCodeCardTags, parseCodeCardTags, formatCodeCardTags, extractCodeBlocksFromMessage, stripCodeBlocksFromMessage } from './codeCardText';
import { inferCodeLanguage, normalizeCodeLanguage } from './codeCardLanguage';
import { buildCodeCardFallback, buildCodeCardPreview } from './codeCardPreview';
import { createDomainObjectBase } from './domainObject';

export { MAX_CODE_CARD_TAGS, parseCodeCardTags, normalizeCodeCardTags, formatCodeCardTags };
export { normalizeCodeLanguage, inferCodeLanguage };
export { deriveCodeCardTitle, extractCodeBlocksFromMessage, stripCodeBlocksFromMessage };
export { buildCodeCardPreview, buildCodeCardFallback };
export type { CodeBlockCandidate } from './codeCardText';

export function createCodeCard(seed: {
  kind?: CodeCard['kind'];
  title?: string;
  cardNote?: string;
  language?: string;
  code?: string;
  cardFaceCss?: string;
  tags?: string[];
  source?: CodeCard['source'];
  originConversationId?: string;
  originMessageId?: string;
  originBlockIndex?: number;
  originBlockTitle?: string;
}): CodeCard {
  const base = createDomainObjectBase('card');
  const code = seed.code ?? '';
  const language = inferCodeLanguage(code, seed.language);
  const tags = normalizeCodeCardTags(seed.tags);

  return {
    ...base,
    kind: seed.kind ?? 'card',
    title: (seed.title ?? '').trim() || deriveCodeCardTitle(code, '未命名房间', language),
    cardNote: seed.cardNote?.trim() || undefined,
    language,
    code,
    cardFaceCss: seed.cardFaceCss,
    tags,
    source: seed.source ?? 'manual',
    originConversationId: seed.originConversationId,
    originMessageId: seed.originMessageId,
    originBlockIndex: seed.originBlockIndex,
    originBlockTitle: seed.originBlockTitle
  };
}
