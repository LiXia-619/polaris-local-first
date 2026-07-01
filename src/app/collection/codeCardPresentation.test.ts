import { describe, expect, it } from 'vitest';
import { resolveCodeCardPresentation } from './codeCardPresentation';

describe('resolveCodeCardPresentation', () => {
  it('treats txt cards as text reading content', () => {
    expect(resolveCodeCardPresentation({ kind: 'card', language: 'txt' })).toBe('text');
  });

  it('treats markdown cards as text reading content', () => {
    expect(resolveCodeCardPresentation({ kind: 'card', language: 'markdown' })).toBe('text');
  });

  it('treats md cards as text reading content too', () => {
    expect(resolveCodeCardPresentation({ kind: 'card', language: 'md' })).toBe('text');
  });

  it('keeps executable assets in the code workshop flow', () => {
    expect(resolveCodeCardPresentation({ kind: 'card', language: 'html' })).toBe('code');
  });
});
