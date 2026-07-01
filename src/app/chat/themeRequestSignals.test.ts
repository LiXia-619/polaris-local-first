import { describe, expect, it } from 'vitest';
import { buildExplicitThemeSurfaceCodes, isRecentThemeToolInvocation } from './themeRequestSignals';

describe('themeRequestSignals', () => {
  it('treats active stable theme tool results as recent theme activity', () => {
    expect(isRecentThemeToolInvocation({
      kind: 'applyThemeCoordinates',
      status: 'preview'
    } as never)).toBe(true);

    expect(isRecentThemeToolInvocation({
      kind: 'applyThemeCoordinates',
      status: 'rolled_back'
    } as never)).toBe(false);
  });

  it('maps natural-language surface mentions into stable surface codes', () => {
    expect(buildExplicitThemeSurfaceCodes('给你自己换个气泡嘛')).toEqual(['04']);
    expect(buildExplicitThemeSurfaceCodes('把气泡换得柔一点')).toEqual(['03']);
    expect(buildExplicitThemeSurfaceCodes('把我的气泡换得柔一点')).toEqual(['03']);
    expect(buildExplicitThemeSurfaceCodes('收藏卡卡面更软一点')).toEqual(['08']);
  });
});
