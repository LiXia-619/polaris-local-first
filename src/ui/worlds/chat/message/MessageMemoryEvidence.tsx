import type { ChatMemoryEvidence, ChatMemoryEvidenceChunkKind, ChatMemoryEvidenceItemKind } from '../../../../types/domain';
import { Icon } from '../../../Icon';

type MessageMemoryEvidenceProps = {
  evidence: ChatMemoryEvidence;
  expanded: boolean;
  onToggle: () => void;
  showTrigger?: boolean;
};

type EvidenceTone = 'vector' | 'text' | 'tail' | 'voice';

function formatEvidenceKind(kind: ChatMemoryEvidenceItemKind) {
  if (kind === 'recent_tail') return '接着聊';
  if (kind === 'vector_match') return '向量片段';
  if (kind === 'voice_anchor') return '语感锚点';
  return '锚点命中';
}

function evidenceTone(kind: ChatMemoryEvidenceItemKind): EvidenceTone {
  if (kind === 'vector_match') return 'vector';
  if (kind === 'matched_context') return 'text';
  if (kind === 'voice_anchor') return 'voice';
  return 'tail';
}

function triggerKind(evidence: ChatMemoryEvidence) {
  const hasVector = evidence.items.some((item) => item.kind === 'vector_match');
  const hasText = evidence.items.some((item) => item.kind === 'matched_context');
  if (hasVector && hasText) return 'mixed';
  if (hasVector) return 'vector';
  if (hasText) return 'text';
  return 'local';
}

function triggerIcon(kind: ReturnType<typeof triggerKind>) {
  if (kind === 'vector') return 'sparkle';
  if (kind === 'text') return 'search';
  if (kind === 'mixed') return 'memoryMap';
  return 'openBook';
}

function formatChunkKind(kind: ChatMemoryEvidenceChunkKind | undefined) {
  if (kind === 'dialogue_turn') return '对话轮';
  if (kind === 'user_intent') return '用户意图';
  if (kind === 'source_message') return '原文消息';
  return null;
}

function formatScore(score: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return score > 1 ? score.toFixed(2) : score.toFixed(3);
}

export function MessageMemoryEvidence({
  evidence,
  expanded,
  onToggle,
  showTrigger = true
}: MessageMemoryEvidenceProps) {
  const vectorCount = evidence.items.filter((item) => item.kind === 'vector_match').length;
  const textCount = evidence.items.filter((item) => item.kind === 'matched_context').length;
  const kind = triggerKind(evidence);
  const labelParts = [
    `${evidence.items.length} 条记忆`,
    vectorCount > 0 ? `${vectorCount} 条向量` : null,
    textCount > 0 ? `${textCount} 条锚点` : null
  ].filter(Boolean);
  const label = labelParts.join(' · ');
  const showPanel = expanded || !showTrigger;

  return (
    <div className={`message-memory-evidence ${showPanel ? 'expanded' : 'collapsed'} ${showTrigger ? '' : 'embedded'}`} data-kind={kind}>
      {showTrigger ? (
        <button
          type="button"
          className="message-memory-evidence-trigger"
          data-kind={kind}
          aria-expanded={expanded}
          aria-label={expanded ? '收起本轮记忆来源' : '查看本轮记忆来源'}
          onClick={onToggle}
        >
          <Icon name={triggerIcon(kind)} size={15} />
          <span>{label}</span>
        </button>
      ) : null}
      {showPanel ? (
        <div className="message-memory-evidence-panel">
          <div className="message-memory-evidence-panel-head">
            <span>{showTrigger ? '送入本轮的记忆' : label}</span>
            <span>{evidence.strategy === 'semantic_index' ? '向量索引' : '本地检索'}</span>
          </div>
          <div className="message-memory-evidence-list">
            {evidence.items.map((item) => {
              const chunkKind = formatChunkKind(item.memoryChunkKind);
              const score = formatScore(item.score);
              const tone = evidenceTone(item.kind);
              return (
                <article key={item.id} className={`message-memory-evidence-item ${item.kind}`} data-kind={tone}>
                  <div className="message-memory-evidence-item-head">
                    <strong>{formatEvidenceKind(item.kind)}</strong>
                    <span>{item.sourceMessageIds.length} 条消息</span>
                    {chunkKind ? <span>{chunkKind}</span> : null}
                    {score ? <span>相似 {score}</span> : null}
                  </div>
                  <p className="message-memory-evidence-title">{item.label}</p>
                  <p className="message-memory-evidence-excerpt">{item.textExcerpt}</p>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
