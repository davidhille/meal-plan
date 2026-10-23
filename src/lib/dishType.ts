import { MealType } from '../types';
import { isFishDish } from './recipeCategories';

/** Was ein einzelnes Gericht ist – „Fleisch & Fisch“ wird beim Anzeigen in Fleisch bzw. Fisch aufgeteilt */
export type DishKind = 'vegetarisch' | 'fleisch' | 'fisch' | 'wochenende';

export const DISH_KIND_LABEL: Record<DishKind, string> = {
  vegetarisch: 'Vegetarisch',
  fleisch: 'Fleisch',
  fisch: 'Fisch',
  wochenende: 'Wochenende',
};

/** Typ eines Gerichts für die Anzeige (Plan, Rezepte, Rezeptansicht, KI-Vorschau) */
export function dishKind(type: MealType, name: string, ingredients: string[] = []): DishKind {
  if (type === 'fleisch' && isFishDish({ name, ingredients })) return 'fisch';
  return type;
}
