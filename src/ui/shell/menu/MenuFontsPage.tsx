import { useEffect, useMemo, useState } from 'react';
import { getAssetMeta, listAssetMeta } from '../../../infrastructure/assetStore';
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN
} from '../../../stores/spaceStoreDisplayPreferences';
import { CUSTOM_FONT_SCOPES } from '../../../stores/runtimeStoreCustomization';
import type { I18nTranslator } from '../../../i18n/translator';
import { useI18n } from '../../../i18n/useI18n';
import type {
  AppCustomization,
  AppDisplayPreferences,
  CustomFontScope
} from '../../../types/domain';
import type { StoredAssetMeta } from '../../../infrastructure/assetStore';
import { Icon } from '../../Icon';

type MenuFontsPageProps = {
  customization: AppCustomization;
  displayPreferences: AppDisplayPreferences;
  onBack: () => void;
  onImportFont: () => void;
  onSetFontScale: (fontScale: number) => void;
  onSetCustomFontScope: (scope: CustomFontScope, assetId: string | null) => void;
  onDeleteCustomFont: (assetId: string) => boolean | Promise<boolean>;
};

type CustomFontRecord = {
  id: string;
  meta: StoredAssetMeta | null;
};

function getFontScopeLabel(scope: CustomFontScope, t: I18nTranslator['t']) {
  switch (scope) {
    case 'titles':
      return {
        title: t('settings.fonts.scope.titles.title'),
        detail: t('settings.fonts.scope.titles.detail')
      };
    case 'chat':
      return {
        title: t('settings.fonts.scope.chat.title'),
        detail: t('settings.fonts.scope.chat.detail')
      };
    case 'cards':
      return {
        title: t('settings.fonts.scope.cards.title'),
        detail: t('settings.fonts.scope.cards.detail')
      };
    default:
      return {
        title: t('settings.fonts.scope.global.title'),
        detail: t('settings.fonts.scope.global.detail')
      };
  }
}

function formatFontSize(size: number | undefined) {
  if (!size || size <= 0) return '';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function displayFontName(record: CustomFontRecord) {
  return record.meta?.name?.trim() || record.id;
}

function displayFontDetail(record: CustomFontRecord) {
  const parts = [
    record.meta?.mimeType,
    formatFontSize(record.meta?.size)
  ].filter(Boolean);
  return parts.join(' · ');
}

function isFontAssetMeta(meta: StoredAssetMeta | null): meta is StoredAssetMeta {
  if (!meta || meta.kind !== 'file') return false;
  const mimeType = meta.mimeType.trim().toLowerCase();
  const name = meta.name.trim().toLowerCase();
  return mimeType.startsWith('font/')
    || mimeType.includes('font')
    || /\.(ttf|otf|woff|woff2)$/.test(name);
}

function formatFontScale(fontScale: number) {
  return `${Math.round(fontScale * 100)}%`;
}

export function MenuFontsPage({
  customization,
  displayPreferences,
  onBack,
  onImportFont,
  onSetFontScale,
  onSetCustomFontScope,
  onDeleteCustomFont
}: MenuFontsPageProps) {
  const { t } = useI18n();
  const [fontRecords, setFontRecords] = useState<CustomFontRecord[]>([]);
  const fontIdsSignature = customization.customFontAssetIds.join('|');
  const assignedScopeByFontId = useMemo(() => {
    const result = new Map<string, CustomFontScope[]>();
    CUSTOM_FONT_SCOPES.forEach((scope) => {
      const assetId = customization.customFontScopeAssignments[scope];
      if (!assetId) return;
      const scopes = result.get(assetId) ?? [];
      scopes.push(scope);
      result.set(assetId, scopes);
    });
    return result;
  }, [customization.customFontScopeAssignments]);
  const totalFontBytes = useMemo(
    () => fontRecords.reduce((total, record) => total + (record.meta?.size ?? 0), 0),
    [fontRecords]
  );
  const totalFontSizeLabel = formatFontSize(totalFontBytes) || t('settings.fonts.sizeReading');

  const handleDeleteFont = async (assetId: string) => {
    const didDelete = await onDeleteCustomFont(assetId);
    if (didDelete) {
      setFontRecords((records) => records.filter((record) => record.id !== assetId));
    }
  };

  useEffect(() => {
    let disposed = false;

    const loadFontRecords = async () => {
      const recordsById = new Map<string, CustomFontRecord>();
      const referencedRecords = await Promise.all(
        customization.customFontAssetIds.map(async (assetId) => ({
          id: assetId,
          meta: await getAssetMeta(assetId)
        }))
      );
      referencedRecords.forEach((record) => {
        recordsById.set(record.id, record);
      });

      const storedFontAssets = await listAssetMeta();
      storedFontAssets
        .filter(isFontAssetMeta)
        .forEach((meta) => {
          if (!recordsById.has(meta.id)) {
            recordsById.set(meta.id, { id: meta.id, meta });
          }
        });

      if (!disposed) setFontRecords(Array.from(recordsById.values()));
    };

    void loadFontRecords();

    return () => {
      disposed = true;
    };
  }, [fontIdsSignature]);

  return (
    <div className="menu-sheet-page menu-fonts-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{t('settings.fonts.section')}</small>
          <h2>{t('settings.fonts.title')}</h2>
        </div>
      </div>

      <section className="menu-section menu-display-preferences-section">
        <div className="menu-preference-list">
          <div className="menu-preference-row menu-preference-row--font-size">
            <span className="menu-preference-copy">
              <strong>{t('settings.fonts.fontSizeTitle')}</strong>
              <small>{formatFontScale(displayPreferences.fontScale)}</small>
            </span>
            <input
              type="range"
              min={FONT_SCALE_MIN}
              max={FONT_SCALE_MAX}
              step={0.01}
              value={displayPreferences.fontScale}
              aria-label={t('settings.fonts.fontSizeAria')}
              onChange={(event) => onSetFontScale(Number(event.target.value))}
            />
            <p
              className="menu-font-preview"
              style={{ fontSize: `calc(13.5px * ${displayPreferences.fontScale})` }}
            >
              {t('settings.fonts.previewText')}
            </p>
          </div>
        </div>
      </section>

      <section className="menu-section menu-font-import-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.fonts.fontLibrary')}</span>
          <p className="menu-section-note">
            {fontRecords.length > 0
              ? t('settings.fonts.libraryDetail', { count: fontRecords.length, size: totalFontSizeLabel })
              : t('settings.fonts.libraryEmpty')}
          </p>
        </div>
        <div className="menu-font-actions">
          <button type="button" className="btn-secondary" onClick={onImportFont}>
            {t('settings.fonts.import')}
          </button>
        </div>
        {fontRecords.length > 0 ? (
          <div className="menu-font-list">
            {fontRecords.map((record) => {
              const assignedScopes = assignedScopeByFontId.get(record.id) ?? [];
              return (
                <div className="menu-font-card" key={record.id}>
                  <div className="menu-font-card-copy">
                    <strong>{displayFontName(record)}</strong>
                    <span>{displayFontDetail(record) || t('settings.fonts.localFontFile')}</span>
                  </div>
                  <div className="menu-font-card-side">
                    {assignedScopes.length > 0 ? (
                      <div className="menu-font-card-badges">
                        {assignedScopes.map((scope) => (
                          <small key={scope}>{getFontScopeLabel(scope, t).title}</small>
                        ))}
                      </div>
                    ) : (
                      <small className="menu-font-card-idle">{t('settings.fonts.unused')}</small>
                    )}
                    <button
                      type="button"
                      className="menu-font-delete"
                      onClick={() => {
                        void handleDeleteFont(record.id);
                      }}
                    >
                      {t('settings.fonts.delete')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="menu-section">
        <div className="menu-section-head">
          <span className="menu-section-kicker">{t('settings.fonts.scopeSection')}</span>
        </div>
        <div className="menu-font-scope-list">
          {CUSTOM_FONT_SCOPES.map((scope) => {
            const scopeLabel = getFontScopeLabel(scope, t);
            return (
              <label className="menu-font-scope-row" key={scope}>
                <span className="menu-font-scope-copy">
                  <strong>{scopeLabel.title}</strong>
                  <small>{scopeLabel.detail}</small>
                </span>
                <select
                  value={customization.customFontScopeAssignments[scope] ?? ''}
                  onChange={(event) => onSetCustomFontScope(scope, event.target.value || null)}
                  disabled={fontRecords.length === 0}
                >
                  <option value="">{t('settings.fonts.followSystem')}</option>
                  {fontRecords.map((record) => (
                    <option key={record.id} value={record.id}>{displayFontName(record)}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
