import type { ChatMessage } from '../../../../types/domain';

export const TOOL_PRODUCT_CARD_ACTIVATION_GUARD_MS = 450;

export function buildVisibleToolProductCardMessageIds(toolMessages: ChatMessage[]) {
  const latestMessageIdByCardId = new Map<string, string>();

  toolMessages.forEach((message) => {
    const tool = message.toolInvocation;
    if (!tool?.cardId || tool.status === 'failed') return;
    latestMessageIdByCardId.set(tool.cardId, message.id);
  });

  return new Set(latestMessageIdByCardId.values());
}

export function nextToolProductCardActivationBlockedUntil(
  nowMs: number,
  durationMs = TOOL_PRODUCT_CARD_ACTIVATION_GUARD_MS
) {
  return nowMs + durationMs;
}

export function shouldBlockToolProductCardActivation(blockedUntilMs: number, nowMs: number) {
  return nowMs < blockedUntilMs;
}
