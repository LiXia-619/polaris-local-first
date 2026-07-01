import type { AssistantRequestAudit } from '../../engines/request/requestAudit';
import type { ChatMemoryEvidence, ChatMemoryEvidenceItem } from '../../types/domain';

const MEMORY_EVIDENCE_EXCERPT_CHARS = 260;

function truncateEvidenceText(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MEMORY_EVIDENCE_EXCERPT_CHARS) return normalized;
  return `${normalized.slice(0, MEMORY_EVIDENCE_EXCERPT_CHARS - 1).trim()}...`;
}

export function buildChatMemoryEvidenceFromAudit(audit: AssistantRequestAudit | null | undefined): ChatMemoryEvidence | undefined {
  if (!audit?.semanticRecallPlan.selectedCandidates.length) return undefined;

  const contextCandidatesById = new Map(
    (audit.semanticRecallContextCandidates ?? []).map((candidate) => [candidate.id, candidate])
  );
  const items: ChatMemoryEvidenceItem[] = audit.semanticRecallPlan.selectedCandidates.flatMap((candidate) => {
    if (candidate.kind === 'recent_tail') return [];
    const contextCandidate = contextCandidatesById.get(candidate.id);
    const textExcerpt = truncateEvidenceText(contextCandidate?.text ?? '');
    if (!textExcerpt) return [];

    return [{
      id: candidate.id,
      kind: candidate.kind,
      label: candidate.label,
      sourceConversationId: candidate.sourceConversationId,
      sourceMessageIds: candidate.sourceMessageIds,
      textExcerpt,
      estimatedTokens: candidate.estimatedTokens,
      charCount: candidate.charCount,
      score: candidate.score,
      ...(candidate.memoryChunkKind ? { memoryChunkKind: candidate.memoryChunkKind } : {})
    }];
  });

  if (!items.length) return undefined;

  return {
    requestId: audit.requestId,
    strategy: audit.semanticRecallPlan.strategy,
    status: audit.semanticRecallPlan.status,
    items
  };
}
