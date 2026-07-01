import type { AssistantMessageContent, AssistantRequestContext } from './requestContext';
import type { RequestMessage } from './requestMessage';
import {
  AUTO_INLINE_FILE_MAX_CHARS,
  AUTO_INLINE_TOTAL_FILE_CHARS
} from './requestContextContent';

const MESSAGE_OVERHEAD_TOKENS = 12;
const IMAGE_ATTACHMENT_TOKENS = 200;
const FILE_ATTACHMENT_TOKENS = 40;

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.trim().length / 4);
}

function estimateAttachmentTokens(message: RequestMessage): number {
  let remainingInlineChars = AUTO_INLINE_TOTAL_FILE_CHARS;
  return (message.attachments ?? []).reduce((total, attachment) => {
    if (attachment.clearedAt) return total;
    const textContent = attachment.kind === 'file' ? attachment.textContent?.trim() ?? '' : '';
    const inlineChars = Math.min(textContent.length, AUTO_INLINE_FILE_MAX_CHARS, remainingInlineChars);
    remainingInlineChars = Math.max(0, remainingInlineChars - inlineChars);
    const textTokens = estimateTextTokens(textContent.slice(0, inlineChars));
    return total + textTokens + (attachment.kind === 'image' ? IMAGE_ATTACHMENT_TOKENS : FILE_ATTACHMENT_TOKENS);
  }, 0);
}

export function estimateConversationMessageTokens(message: RequestMessage): number {
  const contentTokens = estimateTextTokens(message.content ?? '');
  const toolTokens =
    estimateTextTokens(message.toolInvocation?.summary ?? '')
    + estimateTextTokens(message.toolInvocation?.detailText ?? '')
    + (message.nativeToolCalls ?? []).reduce(
      (total, toolCall) =>
        total + estimateTextTokens(toolCall.name) + estimateTextTokens(toolCall.argumentsText),
      0
    );
  return contentTokens + toolTokens + estimateAttachmentTokens(message) + MESSAGE_OVERHEAD_TOKENS;
}

export function estimateAssistantMessageContentTokens(content: AssistantMessageContent): number {
  if (typeof content === 'string') {
    return estimateTextTokens(content) + MESSAGE_OVERHEAD_TOKENS;
  }

  return content.reduce((total, part) => {
    if (part.type === 'text') {
      return total + estimateTextTokens(part.text);
    }
    return total + IMAGE_ATTACHMENT_TOKENS;
  }, MESSAGE_OVERHEAD_TOKENS);
}

export function estimateAssistantContextTokens(context: AssistantRequestContext): number {
  return context.segments.reduce(
    (segmentTotal, segment) =>
      segmentTotal
      + segment.messages.reduce(
        (messageTotal, message) =>
          messageTotal
          + estimateAssistantMessageContentTokens(message.content)
          + (message.toolCalls ?? []).reduce(
            (toolCallTotal, toolCall) =>
              toolCallTotal + estimateTextTokens(toolCall.name) + estimateTextTokens(toolCall.argumentsText),
            0
          ),
        0
      ),
    0
  );
}
