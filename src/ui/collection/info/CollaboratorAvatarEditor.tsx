import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { AVATAR_ICON_IDS, AVATAR_ICON_LABELS } from '../../../config/catalog/avatarIconCatalog';
import { canUseNativePhotoLibraryPicker, pickNativePhotoLibraryFiles } from '../../../native/imagePickerFiles';
import type { AvatarDisplaySize, AvatarIconId, AvatarShape } from '../../../types/domain';
import { PersonaAvatar } from '../../collaborator/PersonaAvatar';
import { resolveAvatarEditorPreviewSize } from '../../collaborator/avatarDisplaySize';
import type { I18nKey } from '../../../i18n/messages';
import { useI18n } from '../../../i18n/useI18n';
import { CollaboratorAvatarCropDialog } from './CollaboratorAvatarCropDialog';

type CollaboratorAvatarEditorProps = {
  label: string;
  role: 'assistant' | 'user';
  seed: string | null;
  assetId: string | null;
  iconId: AvatarIconId | null;
  shape: AvatarShape;
  size: AvatarDisplaySize;
  compact?: boolean;
  onSelectFiles: (files: FileList | File[]) => Promise<void>;
  onSetIcon: (iconId: AvatarIconId | null) => void;
  onSetShape: (shape: AvatarShape) => void;
  onSetSize: (size: AvatarDisplaySize) => void;
};

const AVATAR_SHAPE_LABEL_KEYS = {
  rounded: 'collaborator.avatar.shapeRounded',
  circle: 'collaborator.avatar.shapeCircle'
} satisfies Record<AvatarShape, I18nKey>;

const AVATAR_SIZE_LABEL_KEYS = {
  small: 'collaborator.avatar.sizeSmall',
  medium: 'collaborator.avatar.sizeMedium',
  large: 'collaborator.avatar.sizeLarge'
} satisfies Record<AvatarDisplaySize, I18nKey>;

const AVATAR_SIZE_OPTIONS: AvatarDisplaySize[] = ['small', 'medium', 'large'];
const AVATAR_SHAPE_OPTIONS: AvatarShape[] = ['rounded', 'circle'];

export function CollaboratorAvatarEditor({
  label,
  role,
  seed,
  assetId,
  iconId,
  shape,
  size,
  compact = false,
  onSelectFiles,
  onSetIcon,
  onSetShape,
  onSetSize
}: CollaboratorAvatarEditorProps) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = async () => {
    if (picking) return;
    if (canUseNativePhotoLibraryPicker()) {
      try {
        setPicking(true);
        const [file] = await pickNativePhotoLibraryFiles();
        if (file) {
          setCropSourceFile(file);
        }
      } finally {
        setPicking(false);
      }
      return;
    }
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file) return;

    try {
      setPicking(true);
      setCropSourceFile(file);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className={`collaborator-avatar-editor ${compact ? 'compact' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/*"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />
      <div className="collaborator-avatar-preview">
        <PersonaAvatar
          role={role}
          seed={seed}
          assetId={assetId}
          iconId={iconId}
          shape={shape}
          size={resolveAvatarEditorPreviewSize(size, compact)}
          className="collaborator-avatar-preview-media"
        />
      </div>
      <div className="collaborator-avatar-body">
        <div className="collaborator-avatar-copy">
          <strong>{label}</strong>
        </div>
        <div className="collaborator-avatar-control-stack">
          <label className="collaborator-avatar-select-field">
            <select
              className="collaborator-avatar-select"
              aria-label={t('collaborator.avatar.shapeAria', { label })}
              value={shape}
              onChange={(event) => onSetShape(event.target.value as AvatarShape)}
            >
              {AVATAR_SHAPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{t(AVATAR_SHAPE_LABEL_KEYS[option])}</option>
              ))}
            </select>
          </label>
          <label className="collaborator-avatar-select-field">
            <select
              className="collaborator-avatar-select"
              aria-label={t('collaborator.avatar.iconAria', { label })}
              value={iconId ?? ''}
              onChange={(event) => onSetIcon(event.target.value ? event.target.value as AvatarIconId : null)}
            >
              <option value="">{t('collaborator.avatar.defaultIcon')}</option>
              {AVATAR_ICON_IDS.map((option) => (
                <option key={option} value={option}>{AVATAR_ICON_LABELS[option]}</option>
              ))}
            </select>
          </label>
          <label className="collaborator-avatar-select-field">
            <select
              className="collaborator-avatar-select"
              aria-label={t('collaborator.avatar.sizeAria', { label })}
              value={size}
              onChange={(event) => onSetSize(event.target.value as AvatarDisplaySize)}
            >
              {AVATAR_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{t(AVATAR_SIZE_LABEL_KEYS[option])}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="collaborator-avatar-actions">
        <button
          type="button"
          className={`btn-secondary ${compact ? 'compact' : ''}`.trim()}
          onClick={() => { void openPicker(); }}
        >
          {picking ? t('collaborator.avatar.picking') : assetId ? t('collaborator.avatar.replace') : t('collaborator.avatar.pick')}
        </button>
      </div>
      {cropSourceFile ? (
        <CollaboratorAvatarCropDialog
          file={cropSourceFile}
          label={label}
          shape={shape}
          onCancel={() => setCropSourceFile(null)}
          onConfirm={async (files) => {
            try {
              setPicking(true);
              await onSelectFiles(files);
              setCropSourceFile(null);
            } finally {
              setPicking(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
