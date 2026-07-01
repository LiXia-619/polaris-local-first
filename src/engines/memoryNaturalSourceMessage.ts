import type { ChatMessage } from '../types/domain';

function normalizeContinuationText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function isGeneratedContinuationInstruction(text: string) {
  const normalized = normalizeContinuationText(text);
  if (!normalized) return false;

  return (
    normalized.startsWith('上一条回答在中途停住了，可能是输出长度到顶，也可能是流式连接提前结束。')
    || normalized.startsWith('上一条回答里的工具调用或代码参数在中途截断了；Polaris 已尽量先保存能恢复的工作区草稿或文件壳。')
    || normalized === '继续沿着这张卡往下写。 优先增量续写或修改；内容很长时分小块推进，不要一次重发完整新版。'
    || /^继续沿着《[^》]+》里那条来源消息往下写这张卡。/.test(normalized)
  );
}

export function isNaturalMemorySourceMessage(message: ChatMessage) {
  if (message.role !== 'user' && message.role !== 'assistant') return false;
  if (message.toolInvocation) return false;
  if (message.origin && message.origin !== 'user-input' && message.origin !== 'assistant-reply') return false;
  if (message.cardReference?.mode === 'continue') return false;
  if (isGeneratedContinuationInstruction(message.content)) return false;
  return Boolean(message.content.trim());
}
