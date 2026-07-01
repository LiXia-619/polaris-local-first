import { describe, expect, it } from 'vitest';
import { stripInlineMarkup } from './groupText';

describe('stripInlineMarkup', () => {
  it('removes html tags but keeps the text inside', () => {
    expect(stripInlineMarkup('要是我现在就<span style="color:#ff6b9d;">扑</span>上去蹭你'))
      .toBe('要是我现在就扑上去蹭你');
  });

  it('unwraps bold and inline code markers', () => {
    expect(stripInlineMarkup('这叫**温情劫持**，配 `code` 一起')).toBe('这叫温情劫持，配 code 一起');
  });

  it('leaves plain text alone', () => {
    expect(stripInlineMarkup('普通一句话')).toBe('普通一句话');
  });
});
