import { useEffect, useState } from 'react';
import type { Persona } from '../../../types/domain';
import { isNullPersonaBase } from '../../../config/persona/personaBuilder';
import {
  createPersonaBuilderDraft,
  type PersonaBuilderDraft,
  type PersonaBuilderIntroCardSeed
} from '../../../app/persona/builder/builderShared';
import { buildPersonaBuilderHandoff } from '../../../app/persona/builder/builderHandoff';
import { PERSONA_VIBE_STEPS, type PersonaVibeStepId } from '../../../app/persona/builder/vibeBuilderModel';
import { PersonaBuilderQuickPanel } from './builder/selectors/PersonaBuilderQuickPanel';
import { PersonaBuilderResultPanel } from './builder/result/PersonaBuilderResultPanel';
import type { PersonaUpdatePatch } from './personaUiShared';

type PersonaBuilderTabProps = {
  activePersona: Persona | null;
  onApplyToCurrent: (patch: PersonaUpdatePatch) => void;
  onCreateCollaborator: (patch: PersonaUpdatePatch, introCard: PersonaBuilderIntroCardSeed) => void;
};

export function PersonaBuilderTab({
  activePersona,
  onApplyToCurrent,
  onCreateCollaborator
}: PersonaBuilderTabProps) {
  const [draft, setDraft] = useState<PersonaBuilderDraft>(() => createPersonaBuilderDraft(activePersona));
  const [activeStep, setActiveStep] = useState<PersonaVibeStepId>('quick');

  useEffect(() => {
    setDraft(createPersonaBuilderDraft(activePersona));
    setActiveStep('quick');
  }, [activePersona?.id]);

  const patchDraft = (patch: Partial<PersonaBuilderDraft> | ((draft: PersonaBuilderDraft) => PersonaBuilderDraft)) => {
    setDraft((current) => typeof patch === 'function' ? patch(current) : ({ ...current, ...patch }));
  };
  const handoff = buildPersonaBuilderHandoff(draft);
  const nullMode = isNullPersonaBase(draft.baseId);

  return (
    <div className={`pb-shell ${nullMode ? 'pb-shell-null' : ''}`}>
      <div className="pb-hero">
        <div>
          <div className="pb-header-label">Persona Prompt Builder</div>
          <h3>新建协作者</h3>
          <p>写名字，选倾向，生成提示词</p>
        </div>
      </div>

      <div className="pb-flow-nav" role="tablist" aria-label="捏人步骤">
        {PERSONA_VIBE_STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={activeStep === step.id}
            className={activeStep === step.id ? 'active' : ''}
            onClick={() => setActiveStep(step.id)}
          >
            <span>{step.label}</span>
          </button>
        ))}
      </div>

      <div className="pb-stage">
        <div className="pb-stage-main">
          {activeStep === 'quick' ? <PersonaBuilderQuickPanel draft={draft} onDraftChange={patchDraft} /> : null}
          {activeStep === 'preview' ? (
            <PersonaBuilderResultPanel
              activePersona={activePersona}
              draft={draft}
              handoff={handoff}
              canApplyToCurrent={Boolean(activePersona)}
              onApplyToCurrent={onApplyToCurrent}
              onCreateCollaborator={onCreateCollaborator}
            />
          ) : null}
        </div>

        <div className="pb-step-actions">
          {activeStep !== 'quick' ? (
            <button type="button" className="btn-secondary compact-btn" onClick={() => setActiveStep('quick')}>
              上一步
            </button>
          ) : null}
          {activeStep !== 'preview' ? (
            <button type="button" className="btn-primary compact-btn" onClick={() => setActiveStep('preview')}>
              完成
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
