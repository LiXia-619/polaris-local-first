import { createUid } from './id';

export type DomainObjectBaseSeed = {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export function createDomainObjectBase(prefix: string, seed: DomainObjectBaseSeed = {}) {
  const createdAt = typeof seed.createdAt === 'number' ? seed.createdAt : Date.now();
  return {
    id: seed.id?.trim() || createUid(prefix),
    createdAt,
    updatedAt: typeof seed.updatedAt === 'number' ? seed.updatedAt : createdAt
  };
}
