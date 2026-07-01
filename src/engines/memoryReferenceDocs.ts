import type { PersonaMemoryReferenceDoc } from '../types/domain';

export function orderMemoryReferenceDocsNewestFirst(docs: PersonaMemoryReferenceDoc[]) {
  return [...docs].sort((left, right) => {
    const timeDelta = right.updatedAt - left.updatedAt;
    if (timeDelta !== 0) return timeDelta;
    return 0;
  });
}
