import { describe, expect, it } from 'vitest';
import { analyzeThemeCustomCss } from './themeCssGuard';

describe('analyzeThemeCustomCss', () => {
  it('allows direct remote assets with a warning', () => {
    const result = analyzeThemeCustomCss(`
      .bubble.assistant::after {
        background-image: url("https://img.example.com/cat.png");
      }
    `);

    expect(result.blockingIssues).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('blocks remote imported stylesheets', () => {
    const result = analyzeThemeCustomCss('@import url("https://example.com/theme.css");');

    expect(result.blockingIssues).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});
