import { describe, expect, it } from 'vitest';
import {
  isProviderEmbeddingRelayTarget,
  isProviderEmbeddingRequestBody
} from './providerEmbeddingRelayShared';

describe('providerEmbeddingRelayShared', () => {
  it('accepts only public https embeddings endpoints', () => {
    expect(isProviderEmbeddingRelayTarget('https://api.example.com/v1/embeddings')).toBe(true);
    expect(isProviderEmbeddingRelayTarget('https://api.example.com/v1/chat/completions')).toBe(false);
    expect(isProviderEmbeddingRelayTarget('http://api.example.com/v1/embeddings')).toBe(false);
    expect(isProviderEmbeddingRelayTarget('https://127.0.0.1/v1/embeddings')).toBe(false);
  });

  it('accepts embedding request bodies without imposing product-level batch caps', () => {
    expect(isProviderEmbeddingRequestBody({
      model: 'text-embedding-3-small',
      input: ['one', 'two'],
      dimensions: 1536
    })).toBe(true);
    expect(isProviderEmbeddingRequestBody({
      model: 'text-embedding-3-small',
      input: 'one'
    })).toBe(true);
    expect(isProviderEmbeddingRequestBody({ model: '', input: ['one'] })).toBe(false);
    expect(isProviderEmbeddingRequestBody({ model: 'embed', input: [] })).toBe(false);
    expect(isProviderEmbeddingRequestBody({ model: 'embed', input: ['one'], dimensions: 0 })).toBe(false);
  });
});
