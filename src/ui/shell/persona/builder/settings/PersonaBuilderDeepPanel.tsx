import {
  PERSONA_BUILDER_DEEP_FIELDS,
  PERSONA_BUILDER_DEEP_SECTIONS,
  type PersonaBuilderDraft
} from '../../../../../app/persona/builder/builderShared';
import { PersonaBuilderDeepSection } from './PersonaBuilderDeepSection';

type PersonaBuilderDeepPanelProps = {
  draft: PersonaBuilderDraft;
  onDraftChange: (patch: Partial<PersonaBuilderDraft>) => void;
};

export function PersonaBuilderDeepPanel({
  draft,
  onDraftChange
}: PersonaBuilderDeepPanelProps) {
  return (
    <div className="pb-stack">
      <section className="pb-deep-purpose">
        <div className="pb-block-head">
          <strong>深入主语校准</strong>
          <span>这里不写台词，只钉住 TA 是谁、为什么这样做、什么绝不越过。</span>
        </div>
        <textarea
          className="ps-textarea"
          rows={3}
          value={draft.purpose}
          onChange={(event) => onDraftChange({ purpose: event.target.value })}
          placeholder="TA 如何理解自己为什么在这里"
        />
      </section>

      {PERSONA_BUILDER_DEEP_SECTIONS.map((section) => (
        <PersonaBuilderDeepSection
          key={section.id}
          title={section.title}
          note={section.note}
          fields={PERSONA_BUILDER_DEEP_FIELDS.filter(([field]) => section.fields.includes(field))}
          draft={draft}
          onDraftChange={onDraftChange}
        />
      ))}
    </div>
  );
}
