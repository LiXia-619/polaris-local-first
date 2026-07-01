import { describe, expect, it } from 'vitest';
import { resolveRoomContextMode } from './roomContextMode';

describe('roomContextMode', () => {
  it('activates room context while the code shelf is open', () => {
    expect(resolveRoomContextMode({
      activeWorld: 'collection',
      collectionShelf: 'code',
      hasActiveCard: false
    })).toBe('active');
  });

  it('activates room context when there is an active card', () => {
    expect(resolveRoomContextMode({
      activeWorld: 'chat',
      collectionShelf: 'info',
      hasActiveCard: true
    })).toBe('active');
  });

  it('keeps room context available when there is no active card and shelf is not code', () => {
    expect(resolveRoomContextMode({
      activeWorld: 'chat',
      collectionShelf: 'info',
      hasActiveCard: false
    })).toBe('available');
  });
});
