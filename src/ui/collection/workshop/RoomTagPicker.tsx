import { useI18n } from '../../../i18n';

type RoomTagPickerProps = {
  roomTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
};

export function RoomTagPicker({
  roomTags,
  selectedTags,
  onToggleTag
}: RoomTagPickerProps) {
  const { t } = useI18n();
  if (roomTags.length === 0) return null;

  return (
    <div className="room-tag-picker" aria-label={t('collection.workshop.roomTagsAria')}>
      {roomTags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`room-tag-picker-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
          onClick={() => onToggleTag(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
