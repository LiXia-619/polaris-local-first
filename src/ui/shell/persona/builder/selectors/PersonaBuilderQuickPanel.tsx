import { useState } from 'react';
import {
  applyPersonaVibeCase,
  applyPersonaVibeHumanBase,
  applyPersonaVibeLayerPreset,
  applyPersonaVibeUse,
  isPersonaVibeLayerActive,
  personaVibeTaskLayerGroupsForUse,
  PERSONA_VIBE_CASE_OPTIONS,
  PERSONA_VIBE_HUMAN_BASE_OPTIONS,
  PERSONA_VIBE_USE_OPTIONS,
  resolvePersonaVibeCaseId,
  resolvePersonaVibeHumanBaseId,
  resolvePersonaVibeUseId,
  togglePersonaVibeLayer,
  type PersonaVibeLayerId,
  type PersonaVibeUseId
} from '../../../../../app/persona/builder/vibeBuilderModel';
import type { PersonaBuilderDraft } from '../../../../../app/persona/builder/builderShared';

type PromptPreviewOption = {
  id: PersonaVibeLayerId;
  label: string;
  promptPreview: string;
};

type PersonaBuilderQuickPanelProps = {
  draft: PersonaBuilderDraft;
  onDraftChange: (patch: Partial<PersonaBuilderDraft> | ((draft: PersonaBuilderDraft) => PersonaBuilderDraft)) => void;
};

type VibePreset = {
  id: string;
  label: string;
  layerIds: PersonaVibeLayerId[];
};

type BuilderEntryMode = 'use' | 'cases' | null;

const SHARED_VIBE_PRESETS: VibePreset[] = [
  {
    id: 'results',
    label: '结果导向',
    layerIds: ['ship_fast', 'decision_owner', 'bias_action', 'conclusion_first', 'brief']
  },
  {
    id: 'careful',
    label: '稳扎稳打',
    layerIds: ['intent_align', 'structure_first', 'self_check', 'transparent_process', 'evidence_first']
  },
  {
    id: 'explore',
    label: '探索模式',
    layerIds: ['active_expand', 'self_check', 'long_term', 'examples_first', 'warm_voice']
  }
];

const USE_COPY: Record<PersonaVibeUseId, { sub: string; presetLabel: string; promptEmpty: string }> = {
  execution: {
    sub: '更好地完成事情',
    presetLabel: '推进预设',
    promptEmpty: '点几个选项，任务推进的提示词会出现在这里'
  },
  human: {
    sub: '更像一个人地陪着',
    presetLabel: '在场预设',
    promptEmpty: '点几个选项，自然在场的提示词会出现在这里'
  }
};

function selectedLabels(options: PromptPreviewOption[]) {
  return options.length ? options.map((option) => option.label).join(' / ') : '先选几个倾向';
}

function groupHasActiveSelection(
  draft: PersonaBuilderDraft,
  group: ReturnType<typeof personaVibeTaskLayerGroupsForUse>[number]
) {
  return group.options.some((option) => isPersonaVibeLayerActive(draft, option.id));
}

function visibleLayerGroupsForDraft(
  draft: PersonaBuilderDraft,
  groups: ReturnType<typeof personaVibeTaskLayerGroupsForUse>
) {
  const visibleGroups = [];

  for (const group of groups) {
    visibleGroups.push(group);
    if (!groupHasActiveSelection(draft, group)) break;
  }

  return visibleGroups;
}

function keepLayersThroughGroup(
  draft: PersonaBuilderDraft,
  groups: ReturnType<typeof personaVibeTaskLayerGroupsForUse>,
  groupIndex: number
) {
  const visibleLayerIds = new Set(
    groups
      .slice(0, groupIndex + 1)
      .flatMap((group) => group.options.map((option) => option.id))
  );
  return draft.vibeSelection.layerIds.filter((layerId) => visibleLayerIds.has(layerId));
}

function VibeComboStrip({
  useId,
  options,
  caseLabel
}: {
  useId: PersonaVibeUseId;
  options: PromptPreviewOption[];
  caseLabel?: string;
}) {
  const useOption = PERSONA_VIBE_USE_OPTIONS.find((option) => option.id === useId);
  const summary = caseLabel ? `彩蛋 / ${caseLabel}` : `${useOption?.label ?? '捏人'} / ${selectedLabels(options)}`;

  return (
    <div className="pb-vibe-combo pb-reveal" aria-label="当前组合">
      <span>组合</span>
      <strong>{summary}</strong>
    </div>
  );
}

function PromptPreviewDock({
  groups,
  baseOption,
  draft,
  emptyText,
  casePrompt
}: {
  groups: ReturnType<typeof personaVibeTaskLayerGroupsForUse>;
  baseOption?: PromptPreviewOption;
  draft: PersonaBuilderDraft;
  emptyText: string;
  casePrompt?: string;
}) {
  const selectedGroups = [
    ...(baseOption ? [{
      id: 'humanBase',
      label: '存在底色',
      options: [baseOption]
    }] : []),
    ...groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => isPersonaVibeLayerActive(draft, option.id))
    }))
    .filter((group) => group.options.length > 0)
  ];
  const trimmedCasePrompt = casePrompt?.trim() ?? '';
  const charCount = trimmedCasePrompt.length || selectedGroups.reduce((total, group) =>
    total + group.options.reduce((groupTotal, option) => groupTotal + option.promptPreview.length, 0), 0);

  return (
    <aside className="pb-prompt-dock pb-reveal" aria-label="当前提示词预览">
      <div className="pb-prompt-dock-head">
        <span>提示词预览</span>
        {charCount ? <small>{charCount} 字</small> : null}
      </div>
      {trimmedCasePrompt ? (
        <div className="pb-prompt-dock-body">
          <section className="pb-prompt-group">
            <span>## 自由提示词</span>
            <p className="pb-case-prompt-text">{trimmedCasePrompt}</p>
          </section>
        </div>
      ) : selectedGroups.length ? (
        <div className="pb-prompt-dock-body">
          {selectedGroups.map((group) => (
            <section key={group.id} className="pb-prompt-group">
              <span>## {group.label}</span>
              {group.options.map((option) => (
                <p key={option.id}>{option.promptPreview}</p>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p className="pb-prompt-empty">{emptyText}</p>
      )}
    </aside>
  );
}

function SeedNameField({
  draft,
  onDraftChange
}: PersonaBuilderQuickPanelProps) {
  return (
    <section className="pb-seed-name-panel pb-reveal" aria-label="名字">
      <label className="pb-field pb-seed-name-field">
        <span>名字</span>
        <input
          className="ps-input"
          value={draft.name}
          onChange={(event) => onDraftChange({ name: event.target.value })}
          placeholder="比如：月桂"
        />
      </label>
    </section>
  );
}

function PersonaBuilderCasePanel({
  draft,
  onDraftChange
}: PersonaBuilderQuickPanelProps) {
  const activeCaseId = resolvePersonaVibeCaseId(draft);

  return (
    <section className="pb-vibe-section pb-case-panel pb-reveal">
      <div className="pb-section-head">
        <strong>彩蛋</strong>
        <span>点一下，直接载入一份自由提示词。</span>
      </div>
      <div className="pb-case-grid">
        {PERSONA_VIBE_CASE_OPTIONS.map((option) => {
          const active = option.id === activeCaseId;
          return (
            <button
              key={option.id}
              type="button"
              className={`pb-case-card ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => onDraftChange((current) => applyPersonaVibeCase(current, option.id))}
            >
              <span className="pb-case-card-head">
                <span className="pb-case-card-name">{option.label}</span>
              </span>
              <span className="pb-case-card-desc">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PersonaBuilderQuickPanel({
  draft,
  onDraftChange
}: PersonaBuilderQuickPanelProps) {
  const [entryMode, setEntryMode] = useState<BuilderEntryMode>(null);
  const [humanBasePicked, setHumanBasePicked] = useState(false);
  const showCases = entryMode === 'cases';
  const activeUseId = resolvePersonaVibeUseId(draft);
  const activeHumanBaseId = resolvePersonaVibeHumanBaseId(draft);
  const layerGroups = personaVibeTaskLayerGroupsForUse(activeUseId);
  const showUseDetails = entryMode === 'use';
  const showLayerGroups = showUseDetails && (activeUseId !== 'human' || humanBasePicked);
  const visibleLayerGroups = showLayerGroups ? visibleLayerGroupsForDraft(draft, layerGroups) : [];
  const activeLayerOptions = layerGroups.flatMap((group) =>
    group.options.filter((option) => isPersonaVibeLayerActive(draft, option.id))
  );
  const activeLayerIds = new Set(draft.vibeSelection.layerIds);
  const activeBaseOption = PERSONA_VIBE_HUMAN_BASE_OPTIONS.find((option) => option.id === activeHumanBaseId);
  const activeCaseOption = PERSONA_VIBE_CASE_OPTIONS.find((option) => option.id === resolvePersonaVibeCaseId(draft));
  const previewBaseOption = activeUseId === 'human'
    && activeBaseOption
    && ['subject', 'blank'].includes(draft.baseId)
    ? activeBaseOption
    : undefined;
  const casePrompt = showCases ? draft.vibeSelection.casePrompt : '';

  return (
    <div className="pb-vibe-builder">
      <SeedNameField draft={draft} onDraftChange={onDraftChange} />

      <div className="pb-direction-row">
        {PERSONA_VIBE_USE_OPTIONS.map((option) => {
          const active = entryMode === 'use' && option.id === activeUseId;
          return (
            <button
              key={option.id}
              type="button"
              className={`pb-direction-card ${active ? 'selected' : ''}`}
              aria-pressed={active}
              onClick={() => {
                setEntryMode('use');
                setHumanBasePicked(false);
                onDraftChange((current) => applyPersonaVibeUse(current, option.id));
              }}
            >
              <span>{option.label}</span>
              <small>{USE_COPY[option.id].sub}</small>
            </button>
          );
        })}
        <button
          type="button"
          className={`pb-direction-card pb-direction-card-cases ${showCases ? 'selected' : ''}`}
          aria-pressed={showCases}
          onClick={() => {
            setEntryMode('cases');
            setHumanBasePicked(false);
          }}
        >
          <span>彩蛋</span>
          <small>试几个现成灵魂</small>
        </button>
      </div>

      {entryMode ? (
        <>
          <VibeComboStrip
            useId={activeUseId}
            options={activeLayerOptions}
            caseLabel={showCases ? activeCaseOption?.label : undefined}
          />

          <PromptPreviewDock
            groups={layerGroups}
            baseOption={showLayerGroups ? previewBaseOption : undefined}
            draft={draft}
            emptyText={showCases ? '点一个彩蛋，自由提示词会出现在这里' : USE_COPY[activeUseId].promptEmpty}
            casePrompt={casePrompt}
          />

          <div className="pb-vibe-divider" />

          {showCases ? (
            <PersonaBuilderCasePanel draft={draft} onDraftChange={onDraftChange} />
          ) : (
            <>
              {activeUseId === 'human' ? (
                <>
                  <div className="pb-preset-row pb-reveal" aria-label="存在底色">
                    {PERSONA_VIBE_HUMAN_BASE_OPTIONS.map((option) => {
                      const active = humanBasePicked && option.id === activeHumanBaseId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`pb-preset ${active ? 'active' : ''}`}
                          aria-pressed={active}
                          title={option.note}
                          onClick={() => {
                            setHumanBasePicked(true);
                            onDraftChange((current) => applyPersonaVibeHumanBase(current, option.id));
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {humanBasePicked ? <div className="pb-vibe-divider" /> : null}
                </>
              ) : null}

              {activeUseId === 'execution' ? (
                <>
                  <section className="pb-preset-section pb-reveal" aria-label={USE_COPY[activeUseId].presetLabel}>
                    <div className="pb-preset-head">
                      <strong>快速预设</strong>
                    </div>
                    <div className="pb-preset-row">
                      {SHARED_VIBE_PRESETS.map((preset) => {
                        const active = preset.layerIds.every((layerId) => activeLayerIds.has(layerId));
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            className={`pb-preset ${active ? 'active' : ''}`}
                            aria-pressed={active}
                            onClick={() =>
                              onDraftChange((current) => applyPersonaVibeLayerPreset(current, active ? [] : preset.layerIds))
                            }
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <div className="pb-vibe-divider" />
                </>
              ) : null}

              {visibleLayerGroups.map((group) => (
                <section key={group.id} className="pb-vibe-section pb-reveal">
                  <div className="pb-section-head">
                    <strong>{group.label}</strong>
                    <span>{group.note}</span>
                  </div>
                  <div className="pb-chip-grid pb-vibe-chip-grid">
                    {group.options.map((option) => {
                      const active = isPersonaVibeLayerActive(draft, option.id);
                      const groupIndex = layerGroups.findIndex((entry) => entry.id === group.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`pb-chip pb-layer-chip ${['expression', 'presenceExpression', 'presenceThinking', 'presenceAction'].includes(group.id) ? 'pb-chip-violet' : ''} ${active ? 'active' : ''}`}
                          aria-pressed={active}
                          onClick={() =>
                            onDraftChange((current) => {
                              const toggled = togglePersonaVibeLayer(current, option.id);
                              const keptLayerIds = keepLayersThroughGroup(toggled, layerGroups, groupIndex);
                              return applyPersonaVibeLayerPreset(toggled, keptLayerIds);
                            })
                          }
                          title={option.note}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

            </>
          )}
        </>
      ) : null}
    </div>
  );
}
