import { describe, expect, it } from 'vitest';
import { buildThemeCoordinateSurfaceTokenPatch } from './themeCoordinateSurfaceTokens';
import { buildThemeCoordinateGlobalTheme } from './themeCoordinateGlobalTheme';
import { parseThemeLayers } from '../themeCssLayerBlocks';
import { serializeThemeCoordinateGeneratedPatch } from '../themeCssLayers';

function parseBubbleUserLayerBackground(cssText: string) {
  const layers = parseThemeLayers(cssText).layers;
  const bubbleLayer = layers.find((layer) => layer.id === 'stable:chat-user-bubble');
  if (!bubbleLayer) return null;
  const match = bubbleLayer.cssText.match(/\.app-shell\.chat \.bubble\.user\s*\{[\s\S]*?background:\s*([^;]+);/);
  return match?.[1] ?? null;
}

function parseRootBubbleUserVar(cssText: string) {
  const layers = parseThemeLayers(cssText).layers;
  const bubbleLayer = layers.find((layer) => layer.id === 'stable:chat-user-bubble');
  if (!bubbleLayer) return null;
  const match = bubbleLayer.cssText.match(/--bubble-user:\s*([^;]+);/);
  return match?.[1] ?? null;
}

describe('buildThemeCoordinateSurfaceTokenPatch', () => {
  it('does not derive airy bubble token defaults from the white highlight layer', () => {
    const airyTheme = buildThemeCoordinateGlobalTheme({
      targets: ['chat-user-bubble'],
      hue: 326,
      hueCount: 4,
      emotion: 8,
      meaning: -6,
      seed: 1
    });

    const airyCss = serializeThemeCoordinateGeneratedPatch(airyTheme.generatedPatch);
    const patch = buildThemeCoordinateSurfaceTokenPatch({
      beforeGeneratedCss: airyCss,
      action: {
        surface: 'chat-user-bubble',
        spell: 'transparent green',
        hue: 26
      }
    });
    const patchCss = serializeThemeCoordinateGeneratedPatch(patch.generatedPatch);

    const rootBubbleVar = parseRootBubbleUserVar(patchCss);
    const bubbleBackground = parseBubbleUserLayerBackground(patchCss);

    expect(rootBubbleVar).not.toContain('0% 100% / 1.000');
    expect(bubbleBackground).toBeTruthy();
    expect(bubbleBackground).not.toContain('hsla(26 0% 100% / 1.000)');
  });
});
