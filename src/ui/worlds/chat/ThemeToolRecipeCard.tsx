import type { ThemeRecipeMeta } from '../../../types/domain';
import { useI18n } from '../../../i18n';

type ThemeToolRecipeCardProps = {
  recipe: ThemeRecipeMeta;
};

export function ThemeToolRecipeCard({ recipe }: ThemeToolRecipeCardProps) {
  const { t } = useI18n();

  return (
    <div className="tool-event-recipe">
      <span className="tool-event-recipe-kicker">{t('chat.toolEvent.recipeKicker')}</span>
      <div className="tool-event-recipe-copy">
        <strong>{recipe.name}</strong>
        {recipe.note && <p>{recipe.note}</p>}
      </div>
    </div>
  );
}
