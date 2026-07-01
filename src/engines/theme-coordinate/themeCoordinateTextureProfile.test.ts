import { describe, expect, it } from 'vitest';
import {
  resolveSurfaceEdgeLabel,
  resolveSurfaceOrnamentLabel,
  resolveSurfaceTextureLabel
} from './themeCoordinateTextureProfile';

describe('resolveSurfaceTextureLabel', () => {
  it('lets airy backgrounds and bubbles branch into nearby but different families', () => {
    const background = resolveSurfaceTextureLabel({
      surface: 'background',
      meaning: -6,
      emotion: 7,
      seed: 9
    });
    const bubble = resolveSurfaceTextureLabel({
      surface: 'chat-user-bubble',
      meaning: -6,
      emotion: 7,
      seed: 9
    });

    expect(background).not.toBe(bubble);
    expect(['pearlescent', 'candy-film', 'wash-cloud', 'frosted-glass']).toContain(background);
    expect(['candy-film', 'pearlescent', 'frosted-glass', 'wash-cloud']).toContain(bubble);
  });

  it('keeps tactile-side textures stable instead of adding cross-family drift', () => {
    const background = resolveSurfaceTextureLabel({
      surface: 'background',
      meaning: 6,
      emotion: 0,
      seed: 9
    });
    const bubble = resolveSurfaceTextureLabel({
      surface: 'chat-user-bubble',
      meaning: 6,
      emotion: 0,
      seed: 9
    });

    expect(background).toBe('linen');
    expect(bubble).toBe('linen');
  });

  it('keeps mid-right expressive themes in atmospheric families before true material territory', () => {
    const background = resolveSurfaceTextureLabel({
      surface: 'background',
      meaning: 3,
      emotion: 8,
      seed: 7
    });
    const bubble = resolveSurfaceTextureLabel({
      surface: 'chat-user-bubble',
      meaning: 3,
      emotion: 8,
      seed: 7
    });

    expect(['candy-film', 'pearlescent', 'frosted-glass', 'wash-cloud']).toContain(background);
    expect(['frosted-glass', 'wash-cloud', 'candy-film', 'pearlescent']).toContain(bubble);
    expect(background).not.toBe('paper');
    expect(background).not.toBe('fabric');
  });

  it('keeps extreme flower-mist away from thin-mist texture families', () => {
    const background = resolveSurfaceTextureLabel({
      surface: 'background',
      meaning: -10,
      emotion: 10,
      seed: 2
    });
    const bubble = resolveSurfaceTextureLabel({
      surface: 'chat-user-bubble',
      meaning: -10,
      emotion: 10,
      seed: 2
    });
    const panel = resolveSurfaceTextureLabel({
      surface: 'panel',
      meaning: -10,
      emotion: 10,
      seed: 2
    });

    expect(['pearlescent', 'candy-film', 'frosted-glass']).toContain(background);
    expect(['wash-cloud', 'frosted-glass', 'pearlescent']).toContain(bubble);
    expect(['frosted-glass', 'wash-cloud', 'pearlescent', 'candy-film']).toContain(panel);
    expect(background).not.toBe('glass');
    expect(bubble).not.toBe('glass');
    expect(panel).not.toBe('powder-dust');
  });
});

describe('resolveSurfaceEdgeLabel', () => {
  it('varies airy edge language between background and bubble surfaces', () => {
    const background = resolveSurfaceEdgeLabel({
      surface: 'background',
      meaning: -6,
      emotion: 7,
      seed: 9
    });
    const bubble = resolveSurfaceEdgeLabel({
      surface: 'chat-user-bubble',
      meaning: -6,
      emotion: 7,
      seed: 9
    });

    expect(background).not.toBe(bubble);
  });

  it('keeps extreme flower-mist edge language out of soft thin-mist shells', () => {
    const background = resolveSurfaceEdgeLabel({
      surface: 'background',
      meaning: -10,
      emotion: 10,
      seed: 2
    });
    const bubble = resolveSurfaceEdgeLabel({
      surface: 'chat-user-bubble',
      meaning: -10,
      emotion: 10,
      seed: 2
    });

    expect(['halo-mist', 'mist-cut']).toContain(background);
    expect(['halo-mist', 'mist-cut']).toContain(bubble);
    expect(background).not.toBe('soft-mist');
    expect(bubble).not.toBe('mist-shell');
  });

  it('keeps mid-right expressive edge language atmospheric before tactile framing takes over', () => {
    const background = resolveSurfaceEdgeLabel({
      surface: 'background',
      meaning: 3,
      emotion: 8,
      seed: 7
    });

    expect(['halo-mist', 'mist-cut', 'candy-cut']).toContain(background);
    expect(background).not.toBe('stitched-solid');
  });
});

describe('resolveSurfaceOrnamentLabel', () => {
  it('lets airy ornament choices split across surface roles', () => {
    const background = resolveSurfaceOrnamentLabel({
      surface: 'background',
      meaning: -6,
      emotion: 7,
      seed: 0
    });
    const bubble = resolveSurfaceOrnamentLabel({
      surface: 'chat-user-bubble',
      meaning: -6,
      emotion: 7,
      seed: 0
    });

    expect(background).not.toBe(bubble);
  });

  it('keeps extreme flower-mist ornament language out of quiet thin-mist territory', () => {
    const background = resolveSurfaceOrnamentLabel({
      surface: 'background',
      meaning: -10,
      emotion: 10,
      seed: 2
    });
    const bubble = resolveSurfaceOrnamentLabel({
      surface: 'chat-user-bubble',
      meaning: -10,
      emotion: 10,
      seed: 2
    });

    expect(['prism-halo', 'prism', 'sheen']).toContain(background);
    expect(['prism-halo', 'prism', 'sheen']).toContain(bubble);
    expect(background).not.toBe('quiet');
    expect(bubble).not.toBe('grain');
  });

  it('keeps mid-right expressive ornament language atmospheric before tactile ornament takes over', () => {
    const background = resolveSurfaceOrnamentLabel({
      surface: 'background',
      meaning: 3,
      emotion: 8,
      seed: 7
    });

    expect(['prism-halo', 'prism', 'sheen']).toContain(background);
    expect(background).not.toBe('stitched');
    expect(background).not.toBe('banded');
  });
});
