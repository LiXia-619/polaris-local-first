import { describe, expect, it } from 'vitest';
import { isAllowedPolarisApiOrigin } from './corsOrigin';

describe('isAllowedPolarisApiOrigin', () => {
  it('allows native and desktop app origins', () => {
    expect(isAllowedPolarisApiOrigin('capacitor://localhost')).toBe(true);
    expect(isAllowedPolarisApiOrigin('polaris://app')).toBe(true);
  });

  it('allows hosted preview origins', () => {
    expect(isAllowedPolarisApiOrigin('https://preview-user.vercel.app')).toBe(true);
  });

  it('rejects unrelated origins', () => {
    expect(isAllowedPolarisApiOrigin('https://polaris.example.com')).toBe(false);
    expect(isAllowedPolarisApiOrigin('https://example.com')).toBe(false);
  });
});
