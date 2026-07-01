import { describe, expect, it } from 'vitest';
import { createInitialThemeState } from '../../stores/spaceStoreTheme';
import { buildExplicitThemeSurfaceCodes } from './themeRequestSignals';
import { buildThemeToolContext, resolveStableSnapshotFocus } from './chatThemeToolContext';

describe('themeToolContext stable focus', () => {
  it('defaults theme state to no explicit surface focus', () => {
    expect(createInitialThemeState().selectedSurfaceCodes).toEqual([]);
  });

  it('prefers user-mentioned surfaces over stale selected focus', () => {
    const result = resolveStableSnapshotFocus({
      explicitSurfaceCodes: buildExplicitThemeSurfaceCodes('给你自己换个气泡嘛'),
      selectedSurfaceCodes: ['02'],
      recentThemeSurfaceCodes: ['02'],
      activeWorld: 'chat'
    });

    expect(result.focusSource).toBe('user-hint');
    expect(result.focusSurfaceCodes).toEqual(['04']);
  });

  it('still falls back to selected focus when there is no explicit request', () => {
    const result = resolveStableSnapshotFocus({
      explicitSurfaceCodes: [],
      selectedSurfaceCodes: ['08'],
      recentThemeSurfaceCodes: ['02'],
      activeWorld: 'chat'
    });

    expect(result.focusSource).toBe('selected');
    expect(result.focusSurfaceCodes).toEqual(['08']);
  });

  it('falls back to recent theme surfaces when there is no selected focus', () => {
    const result = resolveStableSnapshotFocus({
      explicitSurfaceCodes: [],
      selectedSurfaceCodes: [],
      recentThemeSurfaceCodes: ['04'],
      activeWorld: 'chat'
    });

    expect(result.focusSource).toBe('recent-tool');
    expect(result.focusSurfaceCodes).toEqual(['04']);
  });

  it('does not default chat stable focus to the assistant bubble', () => {
    const result = resolveStableSnapshotFocus({
      explicitSurfaceCodes: [],
      selectedSurfaceCodes: [],
      recentThemeSurfaceCodes: [],
      activeWorld: 'chat'
    });

    expect(result.focusSource).toBe('world-default');
    expect(result.focusSurfaceCodes).toEqual(['03', '05', '01', '02']);
  });

  it('carries requested collection bottom selectors into creative context even from chat', () => {
    const result = buildThemeToolContext({
      messages: [{
        id: 'msg-user',
        role: 'user',
        content: '收藏区底栏还是白色，帮我改色',
        timestamp: 1
      }],
      activeWorld: 'chat',
      collectionShelf: 'code',
      themeToolMode: 'creative',
      themePreviewActive: true,
      selectedSurfaceCodes: [],
      currentThemeFrame: createInitialThemeState(),
      modelTier: 'small'
    });

    expect(result.selectorHints.map((hint) => hint.alias)).toContain('collection-shelf-tabs');
  });
});
