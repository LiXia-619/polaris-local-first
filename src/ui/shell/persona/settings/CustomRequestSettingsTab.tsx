import { type PersonaTabProps } from '../personaUiShared';
import { useI18n } from '../../../../i18n/useI18n';

export function CustomRequestSettingsTab({ activePersona, onUpdatePersona }: PersonaTabProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="ps-field">
        <div className="ps-field-head ps-field-head--meta-right">
          <span className="ps-field-label">{t('request.custom.headersLabel')}</span>
          <span className="ps-field-hint">{t('request.custom.headersHint')}</span>
        </div>
        <textarea
          className="ps-textarea ps-textarea--mono"
          rows={4}
          value={activePersona?.advanced.customHeaders || ''}
          onChange={(e) => onUpdatePersona({ advanced: { customHeaders: e.target.value } })}
          placeholder={'{ "Authorization": "Bearer ..." }'}
        />
      </div>

      <div className="ps-field">
        <div className="ps-field-head ps-field-head--meta-right">
          <span className="ps-field-label">{t('request.custom.bodyLabel')}</span>
          <span className="ps-field-hint">{t('request.custom.bodyHint')}</span>
        </div>
        <textarea
          className="ps-textarea ps-textarea--mono"
          rows={4}
          value={activePersona?.advanced.customBody || ''}
          onChange={(e) => onUpdatePersona({ advanced: { customBody: e.target.value } })}
          placeholder={'{ "response_format": { "type": "json_object" } }'}
        />
      </div>
    </>
  );
}
