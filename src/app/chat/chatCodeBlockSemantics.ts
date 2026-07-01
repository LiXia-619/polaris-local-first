import {
  extractCodeBlocksFromMessage,
  type CodeBlockCandidate
} from '../../engines/codeCardEngine';
import type { ChatNativeToolCall } from '../../types/domain';

export function isThemeCssCodeBlock(block: Pick<CodeBlockCandidate, 'language'>) {
  const language = block.language.trim().toLowerCase();
  return language === 'css' || language === 'scss' || language === 'sass' || language === 'less';
}

export function hasOnlyThemeCssCodeBlocks(content: string) {
  const codeBlocks = extractCodeBlocksFromMessage(content);
  return codeBlocks.length > 0 && codeBlocks.every((block) => isThemeCssCodeBlock(block));
}

export function hasThemeCssProjectionToolCall(nativeToolCalls: ChatNativeToolCall[] | undefined) {
  return nativeToolCalls?.some((toolCall) => {
    const name = toolCall.name.trim();
    return name === 'patchRawCss' || name === 'appendThemeCss' || name === 'insertThemeCss' || name === 'deleteThemeCss';
  }) ?? false;
}
