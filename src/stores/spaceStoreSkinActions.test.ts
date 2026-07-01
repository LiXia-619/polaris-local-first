import { beforeEach, describe, expect, it } from 'vitest';
import { useSpaceStore } from './spaceStore';
import { createInitialThemeState } from './spaceStoreTheme';

describe('spaceStore skin actions', () => {
  beforeEach(() => {
    useSpaceStore.setState(useSpaceStore.getInitialState(), true);
  });

  it('commits an active preview before saving the visible theme as a skin', () => {
    const beforeTheme = {
      ...createInitialThemeState(),
      generatedCSS: '.bubble.user::after { background-image: url("polaris-asset://white-bg"); }'
    };
    const previewTheme = {
      ...beforeTheme,
      generatedCSS: '.bubble.user::after { background-image: url("polaris-asset://transparent-png"); }',
      patchLedger: [{
        id: 'patch-1',
        previewId: 'preview-1',
        conversationId: 'conversation-1',
        kind: 'patchRawCss' as const,
        label: '透明 PNG 装饰',
        summary: '透明 PNG 装饰',
        status: 'preview' as const,
        layer: 'generated' as const,
        createdAt: 1,
        updatedAt: 1
      }]
    };

    useSpaceStore.setState({
      frontstageCollaboratorId: 'pharos',
      activeThemePreview: {
        id: 'preview-1',
        conversationId: 'conversation-1',
        before: beforeTheme,
        pending: '',
        patchLedgerEntryId: 'patch-1'
      },
      theme: previewTheme,
      collaboratorThemes: {}
    });

    const savedSkin = useSpaceStore.getState().saveCurrentSkin('透明 PNG 气泡');
    const state = useSpaceStore.getState();

    expect(savedSkin?.generatedCSS).toContain('transparent-png');
    expect(state.activeThemePreview).toBeNull();
    expect(state.theme.savedSkins[0]?.generatedCSS).toContain('transparent-png');
    expect(state.theme.patchLedger[0]?.status).toBe('applied');
    expect(state.collaboratorThemes.pharos?.theme.generatedCSS).toContain('transparent-png');
    expect(state.collaboratorThemes.pharos?.theme.generatedCSS).not.toContain('white-bg');
  });

  it('renames a saved skin in the shared library', () => {
    useSpaceStore.setState({ frontstageCollaboratorId: 'pharos' });

    const savedSkin = useSpaceStore.getState().saveCurrentSkin('原来的名字');
    expect(savedSkin).not.toBeNull();

    useSpaceStore.getState().renameSavedSkin(savedSkin!.id, '  南瓜气泡  ');
    const state = useSpaceStore.getState();

    expect(state.theme.savedSkins[0]?.name).toBe('南瓜气泡');
    expect(state.theme.activeSavedSkinId).toBe(savedSkin!.id);
    expect(state.collaboratorThemes.pharos?.theme.savedSkins).toEqual([]);
  });
});
