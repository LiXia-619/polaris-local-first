import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web'
  },
  registerPlugin: vi.fn(() => ({}))
}));

import { resolveCodeCardExportFileName } from './exportCodeCardDraft';

describe('resolveCodeCardExportFileName', () => {
  it('adds the language extension when the title has no matching extension', () => {
    expect(resolveCodeCardExportFileName('landing page', 'html')).toBe('landing-page.html');
  });

  it('keeps an existing matching extension', () => {
    expect(resolveCodeCardExportFileName('index.html', 'html')).toBe('index.html');
  });

  it('sanitizes nested file paths before export', () => {
    expect(resolveCodeCardExportFileName('src/views/home.tsx', 'tsx')).toBe('src-views-home.tsx');
  });
});
