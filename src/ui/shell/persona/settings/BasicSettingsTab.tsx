import { useEffect, useRef } from 'react';
import { useI18n } from '../../../../i18n/useI18n';
import { type PersonaTabProps } from '../personaUiShared';
import { displayTitleClassName } from '../../../titleTypography';

export function BasicSettingsTab({
  activePersona,
  onUpdatePersona,
  onDeletePersona,
  deletePersonaLabel,
  deletePersonaHint
}: PersonaTabProps) {
  const { t } = useI18n();
  const lastNonEmptyNameRef = useRef(activePersona?.name?.trim() || t('collaborator.basic.defaultName'));
  const collaboratorName = activePersona?.name.trim() || t('collaborator.info.fallbackName');
  const resolvedDeleteLabel = deletePersonaLabel ?? t('collaborator.info.deleteLabel', { name: collaboratorName });
  const resolvedDeleteHint = deletePersonaHint ?? t('collaborator.info.deleteHint');

  useEffect(() => {
    const trimmedName = activePersona?.name.trim();
    if (trimmedName) {
      lastNonEmptyNameRef.current = trimmedName;
    }
  }, [activePersona?.id, activePersona?.name]);

  return (
    <>
      <div className="collaborator-identity-summary">
        <input
          className={displayTitleClassName(
            activePersona?.name || '',
            'collaborator-info-name-input',
            { systemWhenEmpty: true }
          )}
          value={activePersona?.name || ''}
          onChange={(event) => onUpdatePersona({ name: event.target.value })}
          onBlur={() => {
            if (activePersona?.name.trim()) return;
            onUpdatePersona({ name: lastNonEmptyNameRef.current });
          }}
          placeholder={t('collaborator.basic.namePlaceholder')}
        />
        <input
          className="collaborator-info-desc-input"
          value={activePersona?.description || ''}
          onChange={(event) => onUpdatePersona({ description: event.target.value })}
          placeholder={t('collaborator.basic.descriptionPlaceholder')}
        />
      </div>

      <div className="ps-field">
        <div className="ps-field-head">
          <span className="ps-field-label">{t('collaborator.basic.userNameLabel')}</span>
          <span className="ps-field-hint">{t('collaborator.basic.userNameHint')}</span>
        </div>
        <input
          className="ps-input"
          value={activePersona?.userName || ''}
          onChange={(event) => onUpdatePersona({ userName: event.target.value })}
          placeholder={t('collaborator.basic.userNamePlaceholder')}
        />
      </div>

      <div className="ps-field">
        <div className="ps-field-head">
          <span className="ps-field-label">{t('collaborator.basic.purposeLabel')}</span>
          <span className="ps-field-hint">{t('collaborator.basic.purposeHint')}</span>
        </div>
        <textarea
          className="ps-textarea"
          rows={3}
          value={activePersona?.purpose || ''}
          onChange={(e) => onUpdatePersona({ purpose: e.target.value })}
          placeholder={t('collaborator.basic.purposePlaceholder')}
        />
      </div>

      {activePersona && onDeletePersona ? (
        <div className="collaborator-identity-danger-zone">
          <button
            type="button"
            className="collaborator-identity-delete-button"
            onClick={onDeletePersona}
          >
            {resolvedDeleteLabel}
          </button>
          <span>{resolvedDeleteHint}</span>
        </div>
      ) : null}
    </>
  );
}
