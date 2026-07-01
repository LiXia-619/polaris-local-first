export function buildUserBubbleCycleAttrs(userBubbleIndex?: number) {
  if (userBubbleIndex == null) return {};

  return {
    'data-user-bubble-cycle2': String(userBubbleIndex % 2),
    'data-user-bubble-cycle3': String(userBubbleIndex % 3),
    'data-user-bubble-cycle4': String(userBubbleIndex % 4),
    'data-user-bubble-cycle5': String(userBubbleIndex % 5),
    'data-user-bubble-cycle6': String(userBubbleIndex % 6)
  };
}

export function buildMessageCycleAttrs(messageIndex: number | null) {
  if (messageIndex == null) return {};

  return {
    'data-message-cycle2': String(messageIndex % 2),
    'data-message-cycle3': String(messageIndex % 3),
    'data-message-cycle4': String(messageIndex % 4),
    'data-message-cycle5': String(messageIndex % 5),
    'data-message-cycle6': String(messageIndex % 6)
  };
}
