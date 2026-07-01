import {
  expressionLabel,
  personaTagCountLabel,
  personaTagPreview,
  personaBaseLabel,
  relationshipLabel
} from '../../../../../config/persona/personaBuilder';
import {
  PERSONA_BUILDER_DEEP_SECTIONS,
  countFilledDeepFields,
  resolvePersonaBuilderDescription,
  resolvePersonaBuilderName,
  type PersonaBuilderDraft
} from '../../../../../app/persona/builder/builderShared';

type PersonaBuilderDraftSummaryProps = {
  draft: PersonaBuilderDraft;
};

export function PersonaBuilderDraftSummary({
  draft
}: PersonaBuilderDraftSummaryProps) {
  const resolvedName = resolvePersonaBuilderName(draft);
  const resolvedDescription = resolvePersonaBuilderDescription(draft);
  const purposeReady = Boolean(draft.purpose.trim());

  return (
    <section className="pb-summary-card">
      <div className="pb-block-head">
        <strong>当前人格总览</strong>
        <span>应用前再看一眼</span>
      </div>

      <div className="pb-summary-identity">
        <strong>{resolvedName}</strong>
        <span>{resolvedDescription}</span>
      </div>

      <div className="pb-summary-grid">
        <div className="pb-summary-pill">{personaBaseLabel(draft.baseId)}</div>
        <div className="pb-summary-pill">{relationshipLabel(draft.relationship)}</div>
        <div className="pb-summary-pill">{expressionLabel(draft.expression)}</div>
        <div className="pb-summary-pill">{personaTagCountLabel(draft.tags)}</div>
        {personaTagPreview(draft.tags, 2).map((label) => (
          <div key={label} className="pb-summary-pill">{label}</div>
        ))}
      </div>

      <div className="pb-summary-sections">
        <div className={`pb-summary-section ${purposeReady ? 'ready' : ''}`}>
          <strong>存在目的</strong>
          <span>{purposeReady ? '已写' : '未写'}</span>
        </div>
        {PERSONA_BUILDER_DEEP_SECTIONS.map((section) => {
          const filled = countFilledDeepFields(draft, section.fields);
          return (
            <div key={section.id} className={`pb-summary-section ${filled > 0 ? 'ready' : ''}`}>
              <strong>{section.title}</strong>
              <span>{filled} / {section.fields.length}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
