import { describe, expect, it } from 'vitest';
import {
  buildCodeCardFaceVars,
  buildScopedCodeCardFaceCss,
  normalizeCodeCardFaceCss,
  resolveCodeCardFaceType
} from './collectionCardFace';

describe('collectionCardFace', () => {
  it('keeps the default face vars deterministic for the same card', () => {
    const card = {
      id: 'card-1',
      kind: 'card' as const,
      title: '像素迷宫小游戏',
      language: 'html',
      tags: ['小游戏', '互动']
    };

    expect(buildCodeCardFaceVars(card)).toEqual(buildCodeCardFaceVars(card));
  });

  it('distinguishes text and code card face types', () => {
    expect(resolveCodeCardFaceType({ kind: 'card', language: 'markdown' })).toBe('text');
    expect(resolveCodeCardFaceType({ kind: 'card', language: 'html' })).toBe('code');
  });

  it('normalizes declaration-only face css onto the card root', () => {
    const css = buildScopedCodeCardFaceCss('card-1', 'background: linear-gradient(135deg, pink, white); color: #432;');

    expect(css).toContain('.app-shell.collection .world-collection [data-polaris-card-id="card-1"] {');
    expect(css).toContain('background: linear-gradient(135deg, pink, white)');
    expect(css).toContain('color: #432');
  });

  it('scopes local & selectors without stripping root geometry changes', () => {
    const css = buildScopedCodeCardFaceCss('card-1', `
      & {
        padding: 0;
        background: linear-gradient(180deg, #fff6fb, #fff);
      }

      & .code-card-main::before {
        content: "";
        position: absolute;
        inset: 0;
      }
    `);

    expect(css).toContain('.app-shell.collection .world-collection [data-polaris-card-id="card-1"] {');
    expect(css).toContain('padding: 0');
    expect(css).toContain('.app-shell.collection .world-collection [data-polaris-card-id="card-1"] .code-card-main::before {');
    expect(css).toContain('position: absolute');
  });

  it('can scope card face css to a non-collection projection root', () => {
    const css = buildScopedCodeCardFaceCss('card-1', '& h3 { color: #123; }', '.message-card-reference-face');

    expect(css).toContain('.message-card-reference-face [data-polaris-card-id="card-1"] h3 {');
    expect(css).not.toContain('.world-collection');
  });

  it('drops remote assets and keeps at-rules when they are intentionally provided', () => {
    expect(normalizeCodeCardFaceCss('background: url(https://example.com/a.png);')).toBeUndefined();
    const css = buildScopedCodeCardFaceCss('card-1', `
      @keyframes pulse {
        from { opacity: 0.6; }
        to { opacity: 1; }
      }

      & {
        animation: pulse 1.2s ease-in-out infinite alternate;
      }
    `);

    expect(css).toContain('@keyframes pulse');
    expect(css).toContain('[data-polaris-card-id="card-1"]');
  });
});
