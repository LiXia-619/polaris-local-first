import { describe, expect, it } from 'vitest';
import { inferModelTier } from './modelTier';

describe('inferModelTier', () => {
  it('treats OpenRouter DeepSeek V4 Pro as a strong model', () => {
    expect(inferModelTier({
      modelId: 'deepseek/deepseek-v4-pro',
      isMirrorAggregator: true
    })).toBe('strong');
  });
});
