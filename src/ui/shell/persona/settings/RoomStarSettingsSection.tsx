import { useState, type CSSProperties } from 'react';
import {
  DEFAULT_APP_CUSTOMIZATION,
  DEFAULT_APP_STAR_COLOR
} from '../../../../stores/runtimeStoreCustomization';
import type { AppCustomization } from '../../../../types/domain';
import type { I18nKey } from '../../../../i18n/messages';
import { useI18n } from '../../../../i18n/useI18n';
import { Icon } from '../../../Icon';

type RoomStarSettingsSectionProps = {
  customization: AppCustomization;
  onSetCustomization: (patch: Partial<AppCustomization>) => void;
};

type StarTuningKey = 'starOpacity' | 'starGlow' | 'starScale' | 'starWarmth';

const STAR_COLOR_SWATCHES = ['#8edfff', '#d6a4ff', '#ff9fcb', '#f5d79a', '#9df2c8'];

const STAR_TUNING_CONTROLS: Array<{
  key: StarTuningKey;
  labelKey: I18nKey;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'starOpacity', labelKey: 'room.settings.star.opacity', min: 0.36, max: 1, step: 0.01 },
  { key: 'starGlow', labelKey: 'room.settings.star.glow', min: 0, max: 1, step: 0.01 },
  { key: 'starScale', labelKey: 'room.settings.star.scale', min: 0.82, max: 1.18, step: 0.01 },
  { key: 'starWarmth', labelKey: 'room.settings.star.warmth', min: 0, max: 1, step: 0.01 }
];

function formatControlValue(value: number, min: number, max: number) {
  return `${Math.round(((value - min) / (max - min)) * 100)}%`;
}

function isDefaultStarCustomization(customization: AppCustomization) {
  return (
    !customization.starColor &&
    customization.starOpacity === DEFAULT_APP_CUSTOMIZATION.starOpacity &&
    customization.starGlow === DEFAULT_APP_CUSTOMIZATION.starGlow &&
    customization.starScale === DEFAULT_APP_CUSTOMIZATION.starScale &&
    customization.starWarmth === DEFAULT_APP_CUSTOMIZATION.starWarmth
  );
}

export function RoomStarSettingsSection({
  customization,
  onSetCustomization
}: RoomStarSettingsSectionProps) {
  const { t } = useI18n();
  const [customOpen, setCustomOpen] = useState(false);
  const starColor = customization.starColor ?? DEFAULT_APP_STAR_COLOR;
  const isPresetColor = STAR_COLOR_SWATCHES.includes(starColor);
  const customActive = customOpen || !isPresetColor;
  const previewStyle = {
    color: starColor,
    opacity: customization.starOpacity,
    transform: `scale(${customization.starScale})`,
    boxShadow: `0 0 ${Math.round(8 + customization.starGlow * 22)}px color-mix(in srgb, currentColor ${Math.round(18 + customization.starGlow * 42)}%, transparent)`
  } satisfies CSSProperties;

  return (
    <section className="theme-studio-section room-toggle-section room-star-settings">
      <div className="room-star-settings-head">
        <span className="room-star-settings-icon" style={previewStyle} aria-hidden="true">
          <Icon name="sparkle" size={16} />
        </span>
        <div>
          <strong>{t('room.settings.star.title')}</strong>
          <span>{t('room.settings.star.detail')}</span>
        </div>
      </div>

      <div className="room-star-color-row">
        <button
          type="button"
          className={`room-star-custom-trigger ${customActive ? 'active' : ''}`}
          style={{ color: starColor }}
          aria-label={t('room.settings.star.customAria')}
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
        >
          <span className="room-star-color-preview" />
        </button>
        <div className="room-star-color-swatches" aria-label={t('room.settings.star.swatchesAria')}>
          {STAR_COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={`room-star-color-swatch ${starColor === color ? 'active' : ''}`}
              style={{ color }}
              aria-label={t('room.settings.star.chooseColorAria', { color })}
              onClick={() => onSetCustomization({ starColor: color })}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary compact-btn room-star-reset-button"
          onClick={() => onSetCustomization({ starColor: null })}
          disabled={!customization.starColor}
        >
          {t('room.settings.star.defaultColor')}
        </button>
      </div>

      {customOpen ? (
        <div className="room-star-custom-panel">
          <label className="room-star-custom-color-picker" style={{ color: starColor }}>
            <span className="room-star-custom-color-copy">{t('room.settings.star.colorLabel')}</span>
            <span className="room-star-custom-color-preview" />
            <input
              type="color"
              value={starColor}
              aria-label={t('room.settings.star.colorPickerAria')}
              onChange={(event) => onSetCustomization({ starColor: event.target.value })}
            />
          </label>

          <div className="room-star-tuning-grid">
            {STAR_TUNING_CONTROLS.map((control) => {
              const value = customization[control.key];
              return (
                <label className="room-star-tuning-control" key={control.key}>
                  <span className="room-star-tuning-copy">
                    <strong>{t(control.labelKey)}</strong>
                    <em>{formatControlValue(value, control.min, control.max)}</em>
                  </span>
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value}
                    onChange={(event) => onSetCustomization({
                      [control.key]: Number(event.target.value)
                    } as Partial<AppCustomization>)}
                  />
                </label>
              );
            })}
          </div>

          <button
            type="button"
            className="btn-secondary compact-btn room-star-reset-all-button"
            onClick={() => onSetCustomization({
              starColor: null,
              starOpacity: DEFAULT_APP_CUSTOMIZATION.starOpacity,
              starGlow: DEFAULT_APP_CUSTOMIZATION.starGlow,
              starScale: DEFAULT_APP_CUSTOMIZATION.starScale,
              starWarmth: DEFAULT_APP_CUSTOMIZATION.starWarmth
            })}
            disabled={isDefaultStarCustomization(customization)}
          >
            {t('room.settings.star.reset')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
