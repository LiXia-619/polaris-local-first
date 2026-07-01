import type { ChatMessage } from '../../../types/domain';
import type { CodeCardActionMode, CodeCardMessageProgress } from '../../../app/chat/chatDerivedState';
import type { I18nTranslator } from '../../../i18n';

export function resolveMessageRowRoleClass(message: ChatMessage, isToolEvent: boolean) {
  if (isToolEvent) return 'system';
  if (message.role === 'assistant') return 'assistant';
  if (message.role === 'system') return 'system';
  return 'user';
}

export function resolveCodeCardActionCopy(
  codeCardActionMode: CodeCardActionMode,
  codeCardProgress: CodeCardMessageProgress | null,
  t: I18nTranslator['t']
) {
  const label = codeCardActionMode === 'open'
    ? t('chat.codeCard.open')
    : codeCardProgress && codeCardProgress.saved > 0 && codeCardProgress.saved < codeCardProgress.total
      ? t('chat.codeCard.saveRemaining', { count: codeCardProgress.total - codeCardProgress.saved })
      : t('chat.codeCard.save');
  const progressLabel = codeCardProgress && codeCardProgress.total > 1
    ? t('chat.codeCard.progress', { saved: codeCardProgress.saved, total: codeCardProgress.total })
    : null;

  return { label, progressLabel };
}
