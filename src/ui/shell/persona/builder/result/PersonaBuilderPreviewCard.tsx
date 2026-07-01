import {
  expressionLabel,
  personaTagCountLabel,
  personaTagSummary,
  personaBaseLabel,
  relationshipLabel
} from '../../../../../config/persona/personaBuilder';
import {
  resolvePersonaBuilderDescription,
  resolvePersonaBuilderName,
  type PersonaBuilderDraft
} from '../../../../../app/persona/builder/builderShared';

type PersonaBuilderPreviewCardProps = {
  draft: PersonaBuilderDraft;
};

export function PersonaBuilderPreviewCard({
  draft
}: PersonaBuilderPreviewCardProps) {
  const resolvedName = resolvePersonaBuilderName(draft);
  const resolvedDescription = resolvePersonaBuilderDescription(draft);
  const scentLine = [expressionLabel(draft.expression), personaTagSummary(draft.tags)].join(' / ');

  return (
    <div className="pb-preview-card">
      <div className="pb-preview-kicker">Current Shape</div>
      <div className="pb-preview-head">
        <strong>{resolvedName}</strong>
        <span>{personaBaseLabel(draft.baseId)} · {relationshipLabel(draft.relationship)}</span>
      </div>
      <p>{resolvedDescription}</p>
      <div className="pb-preview-meta">
        <span>{scentLine}</span>
        <span>{personaTagCountLabel(draft.tags)}</span>
      </div>
    </div>
  );
}
