import { RecipeFilter } from '../types';

export const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type FilterRecipe = { name: string; ingredients: string[]; durationMin: number | null };

/** Hat der Filter Regeln (Suchbegriffe oder Zeit)? Ohne Regeln zählen nur von Hand zugeordnete Gerichte. */
export const hasRules = (filter: RecipeFilter) => filter.keywords.length > 0 || !!filter.maxMinutes;

/** Passt ein Rezept nach den Regeln? Begriffe: einer muss in Name oder Zutaten vorkommen; Zeit: höchstens maxMinutes */
export function matchesRules(filter: RecipeFilter, recipe: FilterRecipe): boolean {
  if (!hasRules(filter)) return false;
  if (filter.maxMinutes && (!recipe.durationMin || recipe.durationMin > filter.maxMinutes)) return false;
  if (!filter.keywords.length) return true;
  const haystack = [recipe.name, ...recipe.ingredients].map(normalizeText);
  return filter.keywords.some((k) => {
    const needle = normalizeText(k.trim());
    return needle && haystack.some((h) => h.includes(needle));
  });
}

/** Gehört ein Rezept zum Filter? Von Hand zugeordnet/ausgenommen geht vor den Regeln. */
export function matchesRecipeFilter(filter: RecipeFilter, recipe: FilterRecipe): boolean {
  if (filter.excludeNames?.includes(recipe.name)) return false;
  if (filter.includeNames?.includes(recipe.name)) return true;
  return matchesRules(filter, recipe);
}

export type AssignState = 'include' | 'exclude' | 'auto';

/**
 * Was beim Antippen eines Filters am Gericht gespeichert wird:
 * an → aus: ausnehmen, wenn die Regeln passen, sonst nur die Zuordnung lösen; aus → an: zuordnen bzw. Ausnahme lösen.
 */
export function toggleAssignment(filter: RecipeFilter, recipe: FilterRecipe): AssignState {
  const byRules = matchesRules(filter, recipe);
  if (matchesRecipeFilter(filter, recipe)) return byRules ? 'exclude' : 'auto';
  return byRules ? 'auto' : 'include';
}

/** Filter, die für einen Bereich der Übersicht gelten */
export const filtersFor = (filters: RecipeFilter[], section: 'gerichte' | 'nachtische') =>
  filters.filter((f) => f.scope === 'beide' || f.scope === section);
