import { describe, expect, it, vi } from 'vitest';
import { createDomainObjectBase } from './domainObject';

describe('createDomainObjectBase', () => {
  it('uses provided identity and timestamps when present', () => {
    expect(createDomainObjectBase('card', {
      id: ' card-1 ',
      createdAt: 10,
      updatedAt: 20
    })).toEqual({
      id: 'card-1',
      createdAt: 10,
      updatedAt: 20
    });
  });

  it('falls updatedAt back to createdAt', () => {
    expect(createDomainObjectBase('file', {
      id: 'file-1',
      createdAt: 10
    })).toEqual({
      id: 'file-1',
      createdAt: 10,
      updatedAt: 10
    });
  });

  it('creates a prefixed id and one shared timestamp when missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T09:00:00.000Z'));

    try {
      const base = createDomainObjectBase('proj');

      expect(base.id).toMatch(/^proj-/);
      expect(base.createdAt).toBe(Date.now());
      expect(base.updatedAt).toBe(base.createdAt);
    } finally {
      vi.useRealTimers();
    }
  });
});
