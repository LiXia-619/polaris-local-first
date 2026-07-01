import { describe, expect, it } from 'vitest';
import { deriveMessageTitle, normalizeConversationTitle } from './chatStoreTitles';

describe('chatStoreTitles', () => {
  it('keeps the visible user text instead of cutting automatic titles to a fixed length', () => {
    expect(deriveMessageTitle({
      id: 'user-1',
      role: 'user',
      content: '你给我做个可以持续进化的做菜助手',
      timestamp: 1
    })).toBe('你给我做个可以持续进化的做菜助手');
  });

  it('normalizes whitespace in generated titles', () => {
    expect(deriveMessageTitle({
      id: 'user-1',
      role: 'user',
      content: '  帮我整理\n\n这一段对话  ',
      timestamp: 1
    })).toBe('帮我整理 这一段对话');
  });

  it('falls back to the attached card title when the user sent no visible text', () => {
    expect(deriveMessageTitle({
      id: 'user-1',
      role: 'user',
      content: '',
      timestamp: 1,
      cardReference: {
        id: 'card-1',
        title: '随便的卡片',
        language: 'text',
        code: '正文',
        mode: 'continue'
      }
    })).toBe('随便的卡片');
  });

  it('expands previously generated fixed-length titles when hydrating conversations', () => {
    const messages = [{
      id: 'user-1',
      role: 'user' as const,
      content: '你给我做个可以持续进化的做菜助手',
      timestamp: 1
    }];

    expect(normalizeConversationTitle('你给我做个可以持续进化的做菜', messages)).toBe('你给我做个可以持续进化的做菜助手');
  });

  it('keeps a custom conversation title', () => {
    const messages = [{
      id: 'user-1',
      role: 'user' as const,
      content: '你给我做个可以持续进化的做菜助手',
      timestamp: 1
    }];

    expect(normalizeConversationTitle('做菜计划', messages)).toBe('做菜计划');
  });
});
