import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createStoredAttachment } from '../../../../infrastructure/assetStore';
import { canUseNativePhotoLibraryPicker, pickNativePhotoLibraryFiles } from '../../../../native/imagePickerFiles';
import { canUseNativeSystemFilePicker, pickNativeSystemFiles } from '../../../../native/systemPickedFiles';
import type { AppCustomization } from '../../../../types/domain';
import { useI18n } from '../../../../i18n/useI18n';
import { Icon } from '../../../Icon';
import { useAssetMeta } from '../../../useAssetObjectUrl';
import { PersonaToggle } from '../PersonaToggle';

type RoomBackgroundSettingsSectionProps = {
  customization: AppCustomization;
  onSetCustomization: (patch: Partial<AppCustomization>) => void;
};

type BackgroundSliderId = 'opacity' | 'dim' | 'blur';

export function RoomBackgroundSettingsSection({
  customization,
  onSetCustomization
}: RoomBackgroundSettingsSectionProps) {
  const { t } = useI18n();
  const [pickingBackground, setPickingBackground] = useState(false);
  const [activeSlider, setActiveSlider] = useState<BackgroundSliderId | null>(null);
  const [backgroundControlsOpen, setBackgroundControlsOpen] = useState(Boolean(customization.backgroundAssetId));
  const backgroundPickerRef = useRef<HTMLInputElement | null>(null);
  const backgroundMeta = useAssetMeta(customization.backgroundAssetId ?? undefined);
  const hasBackground = Boolean(customization.backgroundAssetId);

  useEffect(() => {
    if (hasBackground) {
      setBackgroundControlsOpen(true);
    }
  }, [hasBackground]);

  const selectBackgroundFiles = async (files: FileList | File[]) => {
    const [file] = Array.from(files);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert(t('room.settings.background.imageOnly'));
      return;
    }

    try {
      const attachment = await createStoredAttachment({
        kind: 'image',
        name: file.name,
        mimeType: file.type || 'image/*',
        blob: file
      });
      onSetCustomization({
        backgroundAssetId: attachment.assetId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('room.settings.background.saveFailed');
      window.alert(message);
    }
  };

  const openBackgroundPhotoPicker = async () => {
    if (pickingBackground) return;
    if (canUseNativePhotoLibraryPicker()) {
      try {
        setPickingBackground(true);
        const [file] = await pickNativePhotoLibraryFiles();
        if (file) {
          await selectBackgroundFiles([file]);
        }
      } finally {
        setPickingBackground(false);
      }
      return;
    }
    backgroundPickerRef.current?.click();
  };

  const openBackgroundFilePicker = async () => {
    if (pickingBackground) return;
    if (canUseNativeSystemFilePicker()) {
      try {
        setPickingBackground(true);
        const [file] = await pickNativeSystemFiles({
          accept: 'image/*',
          multiple: false
        });
        if (file) {
          await selectBackgroundFiles([file]);
        }
      } finally {
        setPickingBackground(false);
      }
      return;
    }
    backgroundPickerRef.current?.click();
  };

  const handleBackgroundFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file) return;

    try {
      setPickingBackground(true);
      await selectBackgroundFiles([file]);
    } finally {
      setPickingBackground(false);
    }
  };

  return (
    <section className="theme-studio-section room-toggle-section room-background-settings">
      <input
        ref={backgroundPickerRef}
        type="file"
        hidden
        accept="image/*"
        onChange={(event) => {
          void handleBackgroundFileChange(event);
        }}
      />

      <PersonaToggle
        label={t('room.settings.background.toggle')}
        description={
          hasBackground
            ? t('room.settings.background.current', { name: backgroundMeta?.name ?? t('room.settings.background.selectedImage') })
            : backgroundControlsOpen
              ? t('room.settings.background.pickFirst')
              : t('room.settings.background.openHelp')
        }
        checked={backgroundControlsOpen}
        onToggle={() => {
          if (backgroundControlsOpen) {
            setBackgroundControlsOpen(false);
            setActiveSlider(null);
            if (hasBackground) {
              onSetCustomization({ backgroundAssetId: null });
            }
            return;
          }
          setBackgroundControlsOpen(true);
        }}
      />

      {backgroundControlsOpen ? (
        <div className="customization-asset-actions">
          <button
            type="button"
            className="btn-secondary room-background-picker-button"
            onClick={() => {
              void openBackgroundPhotoPicker();
            }}
            disabled={pickingBackground}
          >
            <Icon name="image" size={14} />
            <span>{pickingBackground ? t('room.settings.background.picking') : t('room.settings.background.photoLibrary')}</span>
          </button>
          <button
            type="button"
            className="btn-secondary room-background-picker-button"
            onClick={() => {
              void openBackgroundFilePicker();
            }}
            disabled={pickingBackground}
          >
            <Icon name="folder" size={14} />
            <span>{pickingBackground ? t('room.settings.background.picking') : t('room.settings.background.filePicker')}</span>
          </button>
          {hasBackground ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSetCustomization({ backgroundAssetId: null })}
            >
              {t('room.settings.background.clear')}
            </button>
          ) : null}
        </div>
      ) : null}

      {backgroundControlsOpen && hasBackground ? (
        <div className="customization-control-stack">
          <SliderRow
            sliderId="opacity"
            active={activeSlider === 'opacity'}
            label={t('room.settings.background.opacity')}
            value={customization.backgroundOpacity}
            min={0.12}
            max={0.82}
            step={0.02}
            displayValue={`${Math.round(customization.backgroundOpacity * 100)}%`}
            onChange={(value) => onSetCustomization({ backgroundOpacity: value })}
            onFocus={() => setActiveSlider('opacity')}
            onBlur={() => setActiveSlider(null)}
          />
          <SliderRow
            sliderId="dim"
            active={activeSlider === 'dim'}
            label={t('room.settings.background.dim')}
            value={customization.backgroundDim}
            min={0}
            max={0.72}
            step={0.02}
            displayValue={`${Math.round(customization.backgroundDim * 100)}%`}
            onChange={(value) => onSetCustomization({ backgroundDim: value })}
            onFocus={() => setActiveSlider('dim')}
            onBlur={() => setActiveSlider(null)}
          />
          <SliderRow
            sliderId="blur"
            active={activeSlider === 'blur'}
            label={t('room.settings.background.blur')}
            value={customization.backgroundBlur}
            min={0}
            max={28}
            step={1}
            displayValue={`${Math.round(customization.backgroundBlur)}px`}
            onChange={(value) => onSetCustomization({ backgroundBlur: value })}
            onFocus={() => setActiveSlider('blur')}
            onBlur={() => setActiveSlider(null)}
          />
          <div className="customization-fit-row">
            <div className="customization-fit-copy">
              <strong>{t('room.settings.background.fitTitle')}</strong>
              <span>{t('room.settings.background.fitDetail')}</span>
            </div>
            <div className="menu-chip-group">
              <button
                type="button"
                className={`menu-chip ${customization.backgroundFit === 'cover' ? 'active' : ''}`}
                onClick={() => onSetCustomization({ backgroundFit: 'cover' })}
              >
                {t('room.settings.background.fitCover')}
              </button>
              <button
                type="button"
                className={`menu-chip ${customization.backgroundFit === 'contain' ? 'active' : ''}`}
                onClick={() => onSetCustomization({ backgroundFit: 'contain' })}
              >
                {t('room.settings.background.fitContain')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type SliderRowProps = {
  sliderId: BackgroundSliderId;
  active: boolean;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
  onFocus: () => void;
  onBlur: () => void;
};

function SliderRow({
  sliderId,
  active,
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
  onFocus,
  onBlur
}: SliderRowProps) {
  return (
    <label className={`customization-slider-row ${active ? 'active' : ''}`.trim()} data-slider-id={sliderId}>
      <span className="customization-slider-copy">
        <strong>{label}</strong>
        <span>{displayValue}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={onFocus}
        onBlur={onBlur}
      />
    </label>
  );
}
