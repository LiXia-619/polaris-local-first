import { createUid } from './id';
import type { ChatAttachment, ChatCardReference, ChatMessage } from '../types/domain';

export function createMessage(
  role: ChatMessage['role'],
  content: string,
  attachments?: ChatAttachment[],
  origin?: ChatMessage['origin'],
  id?: string,
  cardReference?: ChatCardReference | null
): ChatMessage {
  return {
    id: id ?? createUid(role),
    role,
    content,
    timestamp: Date.now(),
    origin:
      origin ??
      (role === 'user'
        ? 'user-input'
        : role === 'assistant'
          ? 'assistant-reply'
          : 'system-note'),
    attachments,
    cardReference: role === 'user' ? (cardReference ?? undefined) : undefined
  };
}
