import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThemePresetById } from '../../../config/theme/themePresets';
import { useI18n } from '../../../i18n/useI18n';
import type { ThemeState } from '../../../types/domain';
import { Icon } from '../../Icon';

type SavedSkinsSectionProps = {
  theme: ThemeState;
  saveName: string;
  copyFeedback: Record<string, 'copied' | 'failed'>;
  exportFeedback: Record<string, 'exported' | 'failed'>;
  onSaveNameChange: (value: string) => void;
  onSaveCurrentSkin: () => void;
  onApplySavedSkin: (savedSkinId: string) => void;
  onRenameSavedSkin: (savedSkinId: string, name: string) => void;
  onUpdateSavedSkinCss: (savedSkinId: string, css: string) => void;
  onCopySavedSkinFile: (savedSkinId: string) => void;
  onExportSavedSkinFile: (savedSkinId: string) => void;
  onDeleteSavedSkin: (savedSkinId: string) => void;
  getSavedSkinTargetSummary: (savedSkin: ThemeState['savedSkins'][number]) => string;
  getSavedSkinEditableCss: (savedSkin: ThemeState['savedSkins'][number]) => string;
};

type SavedSkinFilePageProps = {
  savedSkin: ThemeState['savedSkins'][number];
  cssDraft: string;
  copyFeedback: Record<string, 'copied' | 'failed'>;
  exportFeedback: Record<string, 'exported' | 'failed'>;
  onCssDraftChange: (value: string) => void;
  onApplySavedSkin: (savedSkinId: string) => void;
  onRenameSavedSkin: (savedSkinId: string, name: string) => void;
  onUpdateSavedSkinCss: (savedSkinId: string, css: string) => void;
  onCopySavedSkinFile: (savedSkinId: string) => void;
  onExportSavedSkinFile: (savedSkinId: string) => void;
  onClose: () => void;
  getSavedSkinTargetSummary: (savedSkin: ThemeState['savedSkins'][number]) => string;
};

function useSavedSkinSourceLabel() {
  const { t } = useI18n();
  return (savedSkin: ThemeState['savedSkins'][number]) => savedSkin.sourcePresetId
    ? t('theme.saved.basedOn', { name: getThemePresetById(savedSkin.sourcePresetId)?.name ?? t('theme.saved.presetFallback') })
    : t('theme.saved.standalone');
}

function SavedSkinFilePage({
  savedSkin,
  cssDraft,
  copyFeedback,
  exportFeedback,
  onCssDraftChange,
  onApplySavedSkin,
  onRenameSavedSkin,
  onUpdateSavedSkinCss,
  onCopySavedSkinFile,
  onExportSavedSkinFile,
  onClose,
  getSavedSkinTargetSummary
}: SavedSkinFilePageProps) {
  const { t } = useI18n();
  const getSourceLabel = useSavedSkinSourceLabel();
  const [nameDraft, setNameDraft] = useState(savedSkin.name);
  const displayName = nameDraft.trim() || savedSkin.name;
  const fileName = `${displayName}.polaris-theme.css`;

  useEffect(() => {
    setNameDraft(savedSkin.name);
  }, [savedSkin.name]);

  const commitNameDraft = () => {
    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      setNameDraft(savedSkin.name);
      return;
    }
    if (trimmedName !== savedSkin.name) {
      onRenameSavedSkin(savedSkin.id, trimmedName);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="theme-saved-file-fullscreen" role="dialog" aria-modal="true" aria-label={t('theme.saved.fileAria', { name: savedSkin.name })}>
      <div className="theme-saved-file-fullscreen-bar">
        <button type="button" className="theme-saved-file-fullscreen-back" onClick={onClose} aria-label={t('theme.saved.backAria')}>
          <Icon name="chevron" size={17} />
        </button>
        <div className="theme-saved-file-fullscreen-status">
          <span>{fileName}</span>
          <small>{t('theme.saved.documentType')}</small>
        </div>
        <button type="button" className="theme-saved-file-fullscreen-apply" onClick={() => onApplySavedSkin(savedSkin.id)}>
          {t('theme.saved.apply')}
        </button>
      </div>

      <div className="theme-saved-file-fullscreen-body">
        <section className="theme-saved-file-document">
          <header className="theme-saved-file-document-head">
            <div>
              <label className="theme-saved-file-name-field">
                <span className="theme-saved-file-name-label">{t('theme.saved.fileName')}</span>
                <span className="theme-saved-file-name-row">
                  <input
                    value={nameDraft}
                    style={{ width: `${Math.max(6, Math.min(nameDraft.length + 1, 24))}ch` }}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={commitNameDraft}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        setNameDraft(savedSkin.name);
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label={t('theme.saved.nameAria')}
                  />
                  <span>.polaris-theme.css</span>
                </span>
              </label>
              <span className="theme-saved-file-source">
                {getSourceLabel(savedSkin)}
              </span>
            </div>
          </header>

          <div className="theme-saved-file-document-meta">
            <span>{t('theme.saved.targetArea')}</span>
            <p>{getSavedSkinTargetSummary(savedSkin)}</p>
          </div>

          <textarea
            className="theme-css-editor theme-saved-file-document-editor"
            value={cssDraft}
            onChange={(event) => onCssDraftChange(event.target.value)}
            spellCheck={false}
          />

          <div className="theme-saved-file-document-actions">
            <button type="button" className="btn-secondary compact-btn" onClick={() => onCopySavedSkinFile(savedSkin.id)}>
              {copyFeedback[savedSkin.id] === 'copied' ? t('theme.saved.copyDone') : copyFeedback[savedSkin.id] === 'failed' ? t('theme.saved.copyFailed') : t('theme.saved.copyFile')}
            </button>
            <button type="button" className="btn-secondary compact-btn" onClick={() => onExportSavedSkinFile(savedSkin.id)}>
              {exportFeedback[savedSkin.id] === 'exported' ? t('theme.saved.exportDone') : exportFeedback[savedSkin.id] === 'failed' ? t('theme.saved.exportFailed') : t('theme.saved.export')}
            </button>
            <button
              type="button"
              className="btn-primary compact-btn"
              onClick={() => onUpdateSavedSkinCss(savedSkin.id, cssDraft)}
            >
              {t('theme.saved.saveChanges')}
            </button>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

export function SavedSkinsSection({
  theme,
  saveName,
  copyFeedback,
  exportFeedback,
  onSaveNameChange,
  onSaveCurrentSkin,
  onApplySavedSkin,
  onRenameSavedSkin,
  onUpdateSavedSkinCss,
  onCopySavedSkinFile,
  onExportSavedSkinFile,
  onDeleteSavedSkin,
  getSavedSkinTargetSummary,
  getSavedSkinEditableCss
}: SavedSkinsSectionProps) {
  const { t } = useI18n();
  const getSourceLabel = useSavedSkinSourceLabel();
  const [openSavedSkinId, setOpenSavedSkinId] = useState<string | null>(null);
  const [savedSkinCssDraft, setSavedSkinCssDraft] = useState('');
  const openSavedSkin = openSavedSkinId
    ? theme.savedSkins.find((savedSkin) => savedSkin.id === openSavedSkinId) ?? null
    : null;

  useEffect(() => {
    if (!openSavedSkin) {
      setSavedSkinCssDraft('');
      return;
    }
    setSavedSkinCssDraft(getSavedSkinEditableCss(openSavedSkin));
  }, [getSavedSkinEditableCss, openSavedSkin]);

  useEffect(() => {
    if (!openSavedSkinId) return;
    if (theme.savedSkins.some((savedSkin) => savedSkin.id === openSavedSkinId)) return;
    setOpenSavedSkinId(null);
  }, [openSavedSkinId, theme.savedSkins]);

  return (
    <section className="theme-studio-section">
      <div className="theme-studio-section-head">
        <div>
          <h3>{t('theme.saved.title')}</h3>
          <p>{t('theme.saved.detail')}</p>
        </div>
      </div>

      <div className="theme-save-row">
        <input
          className="theme-save-name-input"
          value={saveName}
          onChange={(event) => onSaveNameChange(event.target.value)}
          placeholder={t('theme.saved.namePlaceholder')}
        />
        <button type="button" className="btn-primary compact-btn" onClick={onSaveCurrentSkin}>
          {t('theme.saved.saveCurrent')}
        </button>
      </div>

      <div className="theme-saved-list">
        {theme.savedSkins.length === 0 && <div className="theme-empty-card">{t('theme.saved.empty')}</div>}
        {theme.savedSkins.map((savedSkin) => (
          <div key={savedSkin.id} className={`theme-saved-item ${theme.activeSavedSkinId === savedSkin.id ? 'active' : ''}`}>
            <button
              type="button"
              className="theme-saved-copy theme-saved-file-open"
              onClick={() => setOpenSavedSkinId(savedSkin.id)}
            >
              <strong>{savedSkin.name}</strong>
              <small>{getSourceLabel(savedSkin)}</small>
            </button>
            <div className="theme-saved-file-actions">
              <button type="button" className="btn-secondary compact-btn" onClick={() => onApplySavedSkin(savedSkin.id)}>
                {t('theme.saved.apply')}
              </button>
              <button type="button" className="theme-inline-action" onClick={() => onDeleteSavedSkin(savedSkin.id)}>
                {t('theme.saved.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
      {openSavedSkin ? (
        <SavedSkinFilePage
          savedSkin={openSavedSkin}
          cssDraft={savedSkinCssDraft}
          copyFeedback={copyFeedback}
          exportFeedback={exportFeedback}
          onCssDraftChange={setSavedSkinCssDraft}
          onApplySavedSkin={onApplySavedSkin}
          onRenameSavedSkin={onRenameSavedSkin}
          onUpdateSavedSkinCss={onUpdateSavedSkinCss}
          onCopySavedSkinFile={onCopySavedSkinFile}
          onExportSavedSkinFile={onExportSavedSkinFile}
          onClose={() => setOpenSavedSkinId(null)}
          getSavedSkinTargetSummary={getSavedSkinTargetSummary}
        />
      ) : null}
    </section>
  );
}
