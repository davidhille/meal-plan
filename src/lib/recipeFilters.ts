import { RecipeFilter } from '../types';

export const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Passt ein Rezept zu einem eigenen Filter? Begriffe: einer muss in Name oder Zutaten vorkommen; Zeit: höchstens maxMinutes */
export function matchesRecipeFilter(
  filter: RecipeFilter,
  recipe: { name: string; ingredients: string[]; durationMin: number | null }
): boolean {
  if (filter.maxMinutes && (!recipe.durationMin || recipe.durationMin > filter.maxMinutes)) return false;
  if (!filter.keywords.length) return true;
  const haystack = [recipe.name, ...recipe.ingredients].map(normalizeText);
  return filter.keywords.some((k) => {
    const needle = normalizeText(k.trim());
    return needle && haystack.some((h) => h.includes(needle));
  });
}

/** Filter, die für einen Bereich der Übersicht gelten */
export const filtersFor = (filters: RecipeFilter[], section: 'gerichte' | 'nachtische') =>
  filters.filter((f) => f.scope === 'beide' || f.scope === section);
