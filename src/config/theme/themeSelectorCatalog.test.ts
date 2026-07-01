import { describe, expect, it } from 'vitest';
import { findSelectorEntryForCssSelector } from './themeSelectorCatalog';

describe('themeSelectorCatalog', () => {
  it('maps collection shelf tab icon selectors to the bottom tab surface', () => {
    const entry = findSelectorEntryForCssSelector('.app-shell.collection .shelf-tab-icon svg');

    expect(entry?.alias).toBe('collection-shelf-tabs');
    expect(entry?.name).toBe('收藏底栏');
  });

  it('maps project cover inner selectors to the workspace cover surface', () => {
    const entry = findSelectorEntryForCssSelector('.app-shell.collection .world-collection .project-cover-title strong');

    expect(entry?.alias).toBe('collection-workspace-cover');
    expect(entry?.name).toBe('工作区封面');
  });

  it('maps user avatar frame selectors without treating uploaded images as editable theme surfaces', () => {
    const entry = findSelectorEntryForCssSelector('.world-chat .message-avatar-slot.user .persona-avatar--user');

    expect(entry?.alias).toBe('chat-user-avatar-frame');
    expect(entry?.hint).toContain('不');
    expect(entry?.hint).toContain('图片本身');
  });
});
