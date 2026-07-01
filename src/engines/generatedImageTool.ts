import { createStoredAttachment } from '../infrastructure/assetStore';
import type { ChatAttachment, ImageGenerationSettings, ProviderProfile } from '../types/domain';
import type { ToolResult } from './toolResult';
import { requestGeneratedImage } from './imageGenerationClient';

export type GenerateImageAttachmentResult = ToolResult<{
  attachment: ChatAttachment;
  detailText: string;
  model: string;
  size: string;
}>;

export function resolveImageGenerationProvider(args: {
  settings: ImageGenerationSettings;
  providers: ProviderProfile[];
}) {
  const providerId = args.settings.providerId?.trim();
  if (!providerId) return null;
  return args.providers.find((provider) => provider.id === providerId) ?? null;
}

export async function generateImageAttachment(args: {
  prompt: string;
  title?: string;
  settings: ImageGenerationSettings;
  providers: ProviderProfile[];
  globalApi: ProviderProfile;
  signal?: AbortSignal;
}): Promise<GenerateImageAttachmentResult> {
  try {
    const provider = resolveImageGenerationProvider(args);
    if (!provider) {
      return {
        ok: false,
        error: args.settings.providerId?.trim()
          ? '找不到已选择的图像供应商，请在生成设置里重新选择。'
          : '请先在生成设置里选择图像供应商。'
      };
    }
    const result = await requestGeneratedImage({
      api: provider,
      settings: args.settings,
      prompt: args.prompt,
      title: args.title,
      signal: args.signal
    });

    const attachment = await createStoredAttachment({
      kind: 'image',
      name: result.fileName,
      mimeType: result.mimeType,
      blob: result.blob
    });

    return {
      ok: true,
      attachment,
      model: result.model,
      size: result.size,
      detailText: [
        `模型：${result.model}`,
        `尺寸：${result.size}`,
        `提示词：${args.prompt.trim()}`
      ].join('\n')
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '生图失败。'
    };
  }
}
