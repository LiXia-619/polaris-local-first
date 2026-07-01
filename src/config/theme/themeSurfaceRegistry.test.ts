import { describe, expect, it } from 'vitest';
import {
  findThemeSurfaceEntriesByContractGroup,
  findThemeSurfaceEntriesByFamily,
  findThemeSurfaceEntriesByLayer,
  findThemeSurfaceEntriesByMotionScope,
  findThemeSurfaceEntriesByWorld,
  findThemeSurfaceEntryByAlias,
  findThemeSurfaceEntryByCode
} from './themeSurfaceRegistry';

describe('themeSurfaceRegistry frontstage contract', () => {
  it('marks chat bubbles as content-layer surfaces', () => {
    const assistantBubble = findThemeSurfaceEntryByCode('04');
    expect(assistantBubble?.id).toBe('chat-bubble-assistant');
    expect(assistantBubble?.layer).toBe('content');
    expect(assistantBubble?.family).toBe('bubble');
  });

  it('marks supporting panels as overlay surfaces', () => {
    const panel = findThemeSurfaceEntryByCode('07');
    expect(panel?.id).toBe('supporting-panel');
    expect(panel?.layer).toBe('overlay');
    expect(panel?.contractGroup).toBe('content-surface');
  });

  it('can enumerate world, layer, family, contract, and motion groups', () => {
    expect(findThemeSurfaceEntriesByWorld('chat').map((entry) => entry.code)).toEqual(['03', '04', '05', '06']);
    expect(findThemeSurfaceEntriesByLayer('overlay').map((entry) => entry.code)).toEqual(['07']);
    expect(findThemeSurfaceEntriesByFamily('bubble').map((entry) => entry.code)).toEqual(['03', '04']);
    expect(findThemeSurfaceEntriesByContractGroup('world-background').map((entry) => entry.code)).toEqual(['01']);
    expect(findThemeSurfaceEntriesByMotionScope('world-local').map((entry) => entry.code)).toEqual(['05', '06', '08']);
  });

  it('marks topbar and background as world-level surfaces', () => {
    const background = findThemeSurfaceEntryByCode('01');
    const topbar = findThemeSurfaceEntryByCode('02');
    expect(background?.motionScopes).toContain('world-level');
    expect(topbar?.motionScopes).toContain('world-level');
    expect(topbar?.contractGroup).toBe('world-chrome');
  });

  it('maps workspace cover selectors to the card surface contract', () => {
    const workspaceCover = findThemeSurfaceEntryByAlias('collection-workspace-cover');

    expect(workspaceCover?.code).toBe('08');
    expect(workspaceCover?.id).toBe('collection-card');
  });
});
