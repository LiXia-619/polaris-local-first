import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types/domain';
import { isNaturalMemorySourceMessage } from './memoryNaturalSourceMessage';

function message(seed: Partial<ChatMessage> & {
  id?: string;
  content: string;
  role?: ChatMessage['role'];
}): ChatMessage {
  return {
    id: seed.id ?? 'message-1',
    role: seed.role ?? 'user',
    content: seed.content,
    timestamp: 1,
    origin: seed.origin,
    toolInvocation: seed.toolInvocation,
    cardReference: seed.cardReference
  };
}

describe('isNaturalMemorySourceMessage', () => {
  it('keeps ordinary user continuation wording as natural source material', () => {
    expect(isNaturalMemorySourceMessage(message({
      content: '继续聊最近事项。'
    }))).toBe(true);
  });

  it('drops Polaris-generated continuation instructions', () => {
    expect(isNaturalMemorySourceMessage(message({
      content: [
        '上一条回答在中途停住了，可能是输出长度到顶，也可能是流式连接提前结束。',
        '不要重头开始，不要道歉，不要复述前文。',
        '直接从刚才断开的那一句继续，但只接下一小段。'
      ].join(' ')
    }))).toBe(false);
  });

  it('drops continue-card transport prompts instead of indexing them as memory', () => {
    expect(isNaturalMemorySourceMessage(message({
      content: '继续沿着这张卡往下写。\n优先增量续写或修改；内容很长时分小块推进，不要一次重发完整新版。',
      cardReference: {
        id: 'card-1',
        title: '卡片',
        language: 'text',
        code: '正文',
        mode: 'continue'
      }
    }))).toBe(false);
  });
});
