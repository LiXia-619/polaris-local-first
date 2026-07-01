import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/chat/chat-rich-content.css', 'utf8');

describe('chat rich content spacing', () => {
  it('keeps assistant paragraph spacing independent of flex gap', () => {
    expect(css).toContain('.bubble.assistant > .message-rich-text > * + *');
    expect(css).toContain('.bubble.assistant > .message-markdown > * + *');
  });
});
