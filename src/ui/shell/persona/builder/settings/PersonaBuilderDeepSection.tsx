import type { PersonaBuilderDraft, PersonaBuilderDeepFieldKey } from '../../../../../app/persona/builder/builderShared';

type PersonaBuilderDeepSectionProps = {
  title: string;
  note: string;
  fields: Array<readonly [PersonaBuilderDeepFieldKey, string, string]>;
  draft: PersonaBuilderDraft;
  onDraftChange: (patch: Partial<PersonaBuilderDraft>) => void;
};

export function PersonaBuilderDeepSection({
  title,
  note,
  fields,
  draft,
  onDraftChange
}: PersonaBuilderDeepSectionProps) {
  return (
    <section className="pb-deep-section">
      <div className="pb-block-head">
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
      <div className="pb-deep-grid">
        {fields.map(([field, label, placeholder]) => (
          <label key={field} className="pb-field">
            <span>{label}</span>
            <textarea
              className="ps-textarea"
              rows={3}
              value={draft.deepDefinition[field]}
              onChange={(event) =>
                onDraftChange({
                  deepDefinition: {
                    ...draft.deepDefinition,
                    [field]: event.target.value
                  }
                })
              }
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
