import { describe, expect, it } from 'vitest';
import { parseRichCardBlock, parseRichDetailsBlock, renderRichInlineContent } from './messageRichMarkup';

describe('messageRichMarkup', () => {
  it('parses details blocks', () => {
    expect(parseRichDetailsBlock('<details open><summary>点开看</summary>里面是正文</details>')).toEqual({
      open: true,
      summary: '点开看',
      body: '里面是正文'
    });
  });

  it('parses polaris cards', () => {
    expect(parseRichCardBlock('<polaris-card title="今晚" kicker="夜色" tone="rose">慢一点说话</polaris-card>')).toEqual({
      title: '今晚',
      kicker: '夜色',
      tone: 'rose',
      body: '慢一点说话'
    });
  });

  it('keeps supported span markup as styled react nodes', () => {
    const nodes = renderRichInlineContent('留一点 <span style="color: #c48; font-weight: 700;">玫瑰色</span> 在这里');
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({
      props: {
        style: {
          color: '#c48',
          fontWeight: '700'
        }
      }
    });
  });

  it('renders markdown strikethrough into del nodes', () => {
    const nodes = renderRichInlineContent('这里有 ~~删掉的话~~ 留着');
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toMatchObject({
      type: 'del',
      props: {
        className: 'message-markdown-strikethrough',
        children: '删掉的话'
      }
    });
  });
});
