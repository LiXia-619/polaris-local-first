import { useEffect, useState } from 'react';
import {
  expressionLabel,
  personaBaseLabel,
  relationshipLabel
} from '../../../../../config/persona/personaBuilder';
import type { Persona } from '../../../../../types/domain';
import { runImpactAction, runSuccessAction } from '../../../../haptics';
import {
  buildPersonaPatchFromDraft,
  resolvePersonaBuilderDescription,
  resolvePersonaBuilderName,
  type PersonaBuilderDraft,
  type PersonaBuilderHandoff,
  type PersonaBuilderIntroCardSeed
} from '../../../../../app/persona/builder/builderShared';
import type { PersonaUpdatePatch } from '../../personaUiShared';

type PersonaBuilderResultPanelProps = {
  activePersona: Persona | null;
  draft: PersonaBuilderDraft;
  handoff: PersonaBuilderHandoff;
  canApplyToCurrent: boolean;
  onApplyToCurrent: (patch: PersonaUpdatePatch) => void;
  onCreateCollaborator: (patch: PersonaUpdatePatch, introCard: PersonaBuilderIntroCardSeed) => void;
};

function mergeMemories(existing: string[], next: string[]) {
  return Array.from(new Set([...existing, ...next].map((item) => item.trim()).filter(Boolean)));
}

function buildVisiblePromptPreview(prompt: string) {
  return prompt
    .split('\n\n')
    .filter((section) => !section.trim().startsWith('[边界]'))
    .join('\n\n')
    .trim();
}

function countPromptLines(prompt: string) {
  return prompt.split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
}

function PersonaResultTextPreview({
  draft,
  handoff,
  finalPrompt
}: {
  draft: PersonaBuilderDraft;
  handoff: PersonaBuilderHandoff;
  finalPrompt: string;
}) {
  const resolvedName = resolvePersonaBuilderName(draft);
  const resolvedDescription = resolvePersonaBuilderDescription(draft);
  const promptBody = buildVisiblePromptPreview(finalPrompt);
  const promptLineCount = countPromptLines(promptBody);

  return (
    <section className="pb-result-namecard">
      <div className="pb-result-namecard-top">
        <span>预览</span>
        <span>{personaBaseLabel(draft.baseId)}</span>
      </div>

      <div className="pb-result-identity">
        <strong>{resolvedName}</strong>
        <p>{resolvedDescription}</p>
      </div>

      <div className="pb-result-namecard-meta">
        <span>{relationshipLabel(draft.relationship)}</span>
        <span>{expressionLabel(draft.expression)}</span>
      </div>

      <div className="pb-result-divider" />

      <div className="pb-result-text-block">
        <div className="pb-result-head">
          <strong>人格摘要</strong>
        </div>
        <div className="pb-result-summary">{handoff.summary || '先从左侧定一个底色，它的轮廓就会开始长出来。'}</div>
      </div>

      <div className="pb-result-text-block">
        <div className="pb-result-head">
          <strong>提示词</strong>
          <span>本地草稿 · {promptLineCount} 行</span>
        </div>
        <pre className="pb-result-prompt">{promptBody || '提示词会在这里根据当前人设结构生成。'}</pre>
      </div>
    </section>
  );
}

function mergeIntroCardMemories(card: PersonaBuilderIntroCardSeed, memories: string[]) {
  return {
    ...card,
    code: card.code.replace(/<span class="memory-count">\d+ 条<\/span>/, `<span class="memory-count">${memories.length} 条</span>`)
  };
}

export function PersonaBuilderResultPanel({
  activePersona,
  draft,
  handoff,
  canApplyToCurrent,
  onApplyToCurrent,
  onCreateCollaborator
}: PersonaBuilderResultPanelProps) {
  const [memoryItems, setMemoryItems] = useState(handoff.memories);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memoryDirty, setMemoryDirty] = useState(false);
  const handoffMemorySignature = handoff.memories.join('\u0000');

  useEffect(() => {
    if (memoryDirty) return;
    setMemoryItems(handoff.memories);
  }, [handoffMemorySignature, memoryDirty]);

  useEffect(() => {
    setMemoryDirty(false);
    setMemoryItems(handoff.memories);
    setMemoryDraft('');
  }, [activePersona?.id]);

  const confirmedMemories = memoryItems.map((item) => item.trim()).filter(Boolean);
  const finalCompiledPrompt = handoff.compiledPrompt;
  const updateMemoryItem = (index: number, value: string) => {
    setMemoryDirty(true);
    setMemoryItems((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? value : entry
    )));
  };
  const pruneEmptyMemoryItem = (index: number) => {
    setMemoryDirty(true);
    setMemoryItems((current) => current.flatMap((entry, entryIndex) => {
      if (entryIndex !== index) return [entry];
      const trimmed = entry.trim();
      return trimmed ? [trimmed] : [];
    }));
  };
  const addMemoryDraft = () => {
    const nextValue = memoryDraft.trim();
    if (!nextValue) return;
    setMemoryDirty(true);
    setMemoryItems((current) => mergeMemories(current, [nextValue]));
    setMemoryDraft('');
  };
  const updateMemoryDraft = (value: string) => {
    setMemoryDirty(true);
    setMemoryDraft(value);
  };

  const applyBuilderToCurrent = () => {
    onApplyToCurrent({
      ...buildPersonaPatchFromDraft(draft),
      compiledPrompt: finalCompiledPrompt,
      builderManaged: true,
      generatedPromptMode: 'vnext',
      memory: {
        personalMemories: mergeMemories(activePersona?.memory.personalMemories ?? [], confirmedMemories)
      }
    });
  };

  const createFromBuilder = () => {
    onCreateCollaborator({
      ...buildPersonaPatchFromDraft(draft),
      compiledPrompt: finalCompiledPrompt,
      builderManaged: true,
      generatedPromptMode: 'vnext',
      memory: {
        personalMemories: confirmedMemories
      }
    }, mergeIntroCardMemories(handoff.introCard, confirmedMemories));
  };

  return (
    <aside className="pb-result-card">
      <PersonaResultTextPreview
        draft={draft}
        handoff={handoff}
        finalPrompt={finalCompiledPrompt}
      />

      <section className="pb-result-grid">
        <div className="pb-result-section">
          <div className="pb-result-head">
            <strong>建议记忆</strong>
            <span>{confirmedMemories.length} 条</span>
          </div>
          <div className="pb-result-list">
            {memoryItems.map((item, index) => (
              <div key={`memory-${index}`} className="pb-memory-chip">
                <input
                  className="pb-result-chip pb-memory-input"
                  value={item}
                  placeholder="记忆内容"
                  onChange={(event) => updateMemoryItem(index, event.target.value)}
                  onBlur={() => pruneEmptyMemoryItem(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
                <button
                  type="button"
                  className="pb-memory-remove"
                  aria-label={`删除记忆 ${item}`}
                  onClick={() => {
                    setMemoryDirty(true);
                    setMemoryItems((current) => current.filter((_, entryIndex) => entryIndex !== index));
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <input
              className="pb-memory-add pb-memory-add-input"
              value={memoryDraft}
              placeholder="＋ 添加记忆"
              onChange={(event) => updateMemoryDraft(event.target.value)}
              onBlur={addMemoryDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addMemoryDraft();
                }
              }}
            />
          </div>
        </div>
      </section>

      <div className="pb-actions">
        {canApplyToCurrent && (
          <button type="button" className="btn-secondary compact-btn" onClick={() => {
            void runSuccessAction(applyBuilderToCurrent);
          }}>
            保存到当前人格
          </button>
        )}
        <button type="button" className="btn-primary compact-btn" onClick={(event) => {
          runImpactAction(createFromBuilder, { element: event.currentTarget });
        }}>
          {canApplyToCurrent ? '另存为新人格' : '创建人格卡'}
        </button>
      </div>
    </aside>
  );
}
