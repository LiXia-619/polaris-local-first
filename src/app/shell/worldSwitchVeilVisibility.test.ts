import { describe, expect, it } from 'vitest';
import { shouldShowWorldSwitchVeil } from './worldSwitchVeilVisibility';

describe('shouldShowWorldSwitchVeil', () => {
  it('keeps the world switch handle between chat and collection', () => {
    expect(shouldShowWorldSwitchVeil('chat')).toBe(true);
    expect(shouldShowWorldSwitchVeil('collection')).toBe(true);
  });

  it('removes the world switch handle from the group world', () => {
    expect(shouldShowWorldSwitchVeil('group')).toBe(false);
  });
});
