const TEXT_ONLY_IMAGE_PLACEHOLDER = '[图片附件：当前内置线路不支持直接看图。]';

type ChatContentPart = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isImageContentPart(part: ChatContentPart) {
  return part.type === 'image_url' || part.type === 'input_image';
}

function extractTextPart(part: ChatContentPart) {
  if (typeof part.text === 'string') {
    return part.text.trim();
  }
  return '';
}

export function builtInChatModelSupportsImages(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized === 'mimo-v2-omni' || normalized === 'xiaomi/mimo-v2-omni';
}

export function coerceMessageContentToText(content: unknown) {
  if (!Array.isArray(content)) {
    return content;
  }

  let sawImage = false;
  const sections: string[] = [];

  for (const part of content) {
    if (!isRecord(part)) continue;
    const text = extractTextPart(part);
    if (text) {
      sections.push(text);
    }
    if (isImageContentPart(part)) {
      sawImage = true;
      sections.push(TEXT_ONLY_IMAGE_PLACEHOLDER);
    }
  }

  if (!sawImage) {
    return content;
  }

  return sections.filter(Boolean).join('\n\n') || TEXT_ONLY_IMAGE_PLACEHOLDER;
}

export function coerceChatPayloadImagesToText(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.messages)) {
    return payload;
  }

  return {
    ...payload,
    messages: payload.messages.map((message) => {
      if (!isRecord(message)) {
        return message;
      }

      return {
        ...message,
        content: coerceMessageContentToText(message.content)
      };
    })
  };
}

export function prepareBuiltInChatPayloadForModel(payload: Record<string, unknown>, model: string): Record<string, unknown> {
  const normalizedPayload = {
    ...payload,
    model
  };
  return builtInChatModelSupportsImages(model)
    ? normalizedPayload
    : coerceChatPayloadImagesToText(normalizedPayload);
}
