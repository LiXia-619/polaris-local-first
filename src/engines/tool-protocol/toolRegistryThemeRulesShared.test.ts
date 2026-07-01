import { describe, expect, it } from 'vitest';
import { buildThemeSnapshotPrompt } from './toolRegistryThemeRulesShared';

describe('buildThemeSnapshotPrompt', () => {
  it('surfaces a recent theme mode switch as a hard handoff cue', () => {
    const prompt = buildThemeSnapshotPrompt({
      activeCard: null,
      visibleCards: [],
      themeContextMode: 'none',
      themeToolMode: 'stable',
      themeModeSwitchHint: {
        from: 'creative',
        to: 'stable'
      },
      themeSnapshot: {
        activePresetId: 'glass-mint',
        activeSavedSkinId: null,
        cssVariables: {},
        presetCSS: '',
        customCSS: '',
        generatedCSS: ''
      }
    });

    expect(prompt).toContain('刚刚换挡：上一轮还是创意模式，这轮已经切到稳定模式。');
    expect(prompt).toContain('不要延续上一轮的输出协议，直接按当前模式执行。');
  });
});
