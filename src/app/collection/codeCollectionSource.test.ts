import { describe, expect, it } from 'vitest';
import {
  buildCardReference,
  buildChatPromptFromCard,
  buildChatPromptFromSourceCard,
  resolveChatCardReference
} from './codeCollectionSource';

describe('codeCollectionSource', () => {
  it('keeps the continue-writing prompt short and leaves the card itself to structured transport', () => {
    const prompt = buildChatPromptFromCard({
      id: 'card-7',
      title: '未命名卡片',
      cardNote: '像留给明天的薄纸条。',
      language: 'text',
      code: '111',
      cardFaceCss: '& { --code-card-face-panel-top: #fff; }'
    });

    expect(prompt).toBe([
      '继续沿着这张卡往下写。',
      '优先增量续写或修改；内容很长时分小块推进，不要一次重发完整新版。'
    ].join('\n'));
  });

  it('keeps source-context prompts short too', () => {
    const prompt = buildChatPromptFromSourceCard(
      {
        id: 'card-9',
        title: '来源卡片',
        language: 'text',
        code: '正文',
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        kind: 'card',
        source: 'chat-generated'
      },
      {
        conversationId: 'conv-1',
        conversationTitle: '旧对话',
        messageId: 'msg-1',
        messagePreview: '原始片段',
        blockLabel: null,
        messageRole: 'assistant',
        messageTimestamp: 1,
        collaboratorName: 'Pharos'
      }
    );

    expect(prompt).toContain('继续沿着《旧对话》里那条来源消息往下写这张卡。');
    expect(prompt).toContain('来源协作者：Pharos');
    expect(prompt).toContain('优先增量续写或修改');
    expect(prompt).toContain('不要一次重发完整新版');
  });

  it('builds structured card references for chat transport', () => {
    expect(buildCardReference({
      id: 'card-3',
      title: '测试卡',
      cardNote: '像贴在边角的提醒。',
      language: 'text',
      code: '正文',
      cardFaceCss: '& { color: #234; }'
    }, 'continue')).toEqual({
      id: 'card-3',
      title: '测试卡',
      cardNote: '像贴在边角的提醒。',
      language: 'text',
      code: '正文',
      cardFaceCss: '& { color: #234; }',
      mode: 'continue'
    });
  });

  it('resolves card references against the latest saved card snapshot', () => {
    expect(resolveChatCardReference({
      id: 'card-3',
      title: '旧标题',
      cardNote: '旧小字',
      language: 'text',
      code: '旧正文',
      cardFaceCss: '& { color: #999; }',
      mode: 'continue'
    }, [
      {
        id: 'card-3',
        title: '新标题',
        cardNote: '新小字',
        language: 'html',
        code: '<section>new</section>',
        cardFaceCss: '& { color: #234; }',
        tags: [],
        createdAt: 1,
        updatedAt: 2,
        kind: 'card',
        source: 'chat-generated'
      }
    ])).toEqual({
      id: 'card-3',
      title: '新标题',
      cardNote: '新小字',
      language: 'html',
      code: '<section>new</section>',
      cardFaceCss: '& { color: #234; }',
      mode: 'continue'
    });
  });
});
