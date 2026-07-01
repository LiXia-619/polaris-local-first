import { describe, expect, it } from 'vitest';
import { buildThemeCoordinatePreview } from './themeCoordinateSpaceMapping';
import { buildSurfaceRules } from './themeCoordinateStableSurfaceRules';

describe('buildSurfaceRules', () => {
  it('never gives the topbar a compiled shadow shell', () => {
    const preview = buildThemeCoordinatePreview({
      hue: 24,
      hueCount: 3,
      emotion: 6,
      meaning: 1,
      seed: 7
    });

    const css = buildSurfaceRules('chat', preview, ['topbar']);
    expect(css).toContain('box-shadow: none;');
    expect(css).not.toMatch(/box-shadow:\s*0 /);
  });

  it('renders bubble-left-rail without a literal vertical border rail', () => {
    const preview = buildThemeCoordinatePreview(
      {
        hue: 142,
        hueCount: 3,
        emotion: -4,
        meaning: -3,
        seed: 9
      },
      {
        forcedTraits: {
          'chat-ai-bubble': 'bubble-left-rail'
        }
      }
    );

    const css = buildSurfaceRules('chat', preview, ['chat-ai-bubble']);
    expect(css).toContain('linear-gradient(90deg');
    expect(css).toContain('inset 3px 0 0');
    expect(css).not.toContain('border-inline-start');
  });

  it('renders bubble-bare as text without a shell', () => {
    const preview = buildThemeCoordinatePreview(
      {
        hue: 204,
        hueCount: 2,
        emotion: -8,
        meaning: -8,
        seed: 6
      },
      {
        forcedTraits: {
          'chat-ai-bubble': 'bubble-bare'
        }
      }
    );

    const css = buildSurfaceRules('chat', preview, ['chat-ai-bubble']);
    expect(css).toContain('background: transparent;');
    expect(css).toContain('border: 0;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('backdrop-filter: none;');
    expect(css).toContain('padding: 0;');
  });

  it('renders bubble-recessed as an inset mist pocket', () => {
    const preview = buildThemeCoordinatePreview(
      {
        hue: 222,
        hueCount: 3,
        emotion: -8,
        meaning: -8,
        seed: 10
      },
      {
        forcedTraits: {
          'chat-user-bubble': 'bubble-recessed'
        }
      }
    );

    const css = buildSurfaceRules('chat', preview, ['chat-user-bubble']);
    expect(css).toContain('linear-gradient(180deg, color-mix(in srgb,');
    expect(css).toContain('inset 0 1px 0');
    expect(css).toContain('inset 0 12px 18px');
  });

  it('renders bubble-cloud as a soft dotted candy frame', () => {
    const preview = buildThemeCoordinatePreview(
      {
        hue: 318,
        hueCount: 4,
        emotion: 8,
        meaning: -7,
        seed: 9
      },
      {
        forcedTraits: {
          'chat-user-bubble': 'bubble-cloud'
        }
      }
    );

    const css = buildSurfaceRules('chat', preview, ['chat-user-bubble']);
    expect(css).toContain('1.6px dotted transparent');
    expect(css).toContain('linear-gradient(135deg');
    expect(css).toContain('0 10px 26px');
  });

  it('keeps recovery buttons on fixed menu and composer rails', () => {
    const preview = buildThemeCoordinatePreview({
      hue: 312,
      hueCount: 5,
      emotion: 8,
      meaning: -6,
      seed: 11
    });

    const css = buildSurfaceRules('chat', preview, ['topbar', 'composer']);
    expect(css).toContain('.topbar .theme-menu-btn');
    expect(css).toContain('width: 40px;');
    expect(css).toContain('height: 40px;');
    expect(css).toContain('.chat-composer .composer-slot-btn');
    expect(css).toContain('width: 34px;');
    expect(css).toContain('height: 34px;');
    expect(css).toContain('.chat-box .send-btn');
    expect(css).toContain('border-radius: 15px;');
  });

  it('renders cloud composer controls with dotted cloud frames', () => {
    const preview = buildThemeCoordinatePreview(
      {
        hue: 318,
        hueCount: 4,
        emotion: 8,
        meaning: -7,
        seed: 9
      },
      {
        forcedTraits: {
          composer: 'composer-cloud'
        }
      }
    );

    const css = buildSurfaceRules('chat', preview, ['topbar', 'composer']);
    expect(css).toContain('.chat-box .send-btn');
    expect(css).toContain('1.5px dotted transparent');
    expect(css).toContain('.chat-composer .composer-slot-btn');
    expect(css).toContain('0 8px 20px');
  });

  it('keeps shell background handoff on the built-in world chroma chain', () => {
    const preview = buildThemeCoordinatePreview({
      hue: 24,
      hueCount: 3,
      emotion: 2,
      meaning: 4,
      seed: 5
    });

    const chatCss = buildSurfaceRules('chat', preview, ['background']);
    const collectionCss = buildSurfaceRules('collection', preview, ['background']);
    const appCss = buildSurfaceRules('app', preview, ['background']);

    expect(chatCss).not.toMatch(/\.app-shell\.chat\s*\{[\s\S]*background:/);
    expect(collectionCss).not.toMatch(/\.app-shell\.collection\s*\{[\s\S]*background:/);
    expect(appCss).not.toMatch(/\.app-shell\.chat\s*\{[\s\S]*background:/);
    expect(appCss).not.toMatch(/\.app-shell\.collection\s*\{[\s\S]*background:/);
  });

  it('feeds collection workshop surfaces from the same card face chain', () => {
    const preview = buildThemeCoordinatePreview({
      hue: 36,
      hueCount: 3,
      emotion: 1,
      meaning: 5,
      seed: 8
    });

    const css = buildSurfaceRules('collection', preview, ['card'], {
      card: new Set(['face'])
    });

    expect(css).toContain('--collection-workshop-panel-fill:');
    expect(css).toContain('--code-workshop-sheet-fill:');
    expect(css).toContain('--code-workshop-board-fill:');
    expect(css).toContain('--collection-card-background:');
  });

  it('lets material-side collection cards and dialogue cards share the same recessed sheet language', () => {
    const preview = buildThemeCoordinatePreview({
      hue: 38,
      hueCount: 2,
      emotion: -3,
      meaning: 6,
      seed: 3
    });

    const css = buildSurfaceRules('collection', preview, ['card']);
    expect(css).toContain('--collection-card-active-transform: none;');
    expect(css).toContain('--collection-dialogue-card-background:');
    expect(css).toContain('--collection-dialogue-card-shadow:');
    expect(css).toContain('--collection-dialogue-card-hover-transform: none;');
  });
});
