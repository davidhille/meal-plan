// Filter der Rezept-Übersicht als Gruppen: Art, Speiseart, Hauptzutat, eigene Filter.
// In einer Gruppe reicht eine der gewählten Möglichkeiten (oder), die Gruppen gelten zusammen (und).
import { CatalogRecipe, MealType, RecipeFilter } from '../types';
import { CategoryOverrides, DISH_KINDS, MAIN_INGREDIENTS, RecipeCategory, inCategory } from './recipeCategories';
import { matchesRecipeFilter } from './recipeFilters';

export type FacetGroup = 'types' | 'kinds' | 'ingredients' | 'custom';

export type FacetSelection = Record<FacetGroup, string[]>;

export const EMPTY_SELECTION: FacetSelection = { types: [], kinds: [], ingredients: [], custom: [] };

export const TYPE_OPTIONS: { id: MealType; label: string }[] = [
  { id: 'vegetarisch', label: 'Vegetarisch' },
  { id: 'fleisch', label: 'Fleisch & Fisch' },
  { id: 'wochenende', label: 'Wochenende' },
];

export interface FacetContext {
  customFilters: RecipeFilter[];
  overrides: CategoryOverrides;
}

const byId = (list: RecipeCategory[], id: string) => list.find((c) => c.id === id);

/** Passt das Gericht zu einer Möglichkeit der Gruppe? */
export function matchesOption(group: FacetGroup, id: string, r: CatalogRecipe, ctx: FacetContext): boolean {
  switch (group) {
    case 'types':
      return r.type === id;
    case 'kinds': {
      const c = byId(DISH_KINDS, id);
      return !!c && inCategory(c, r, ctx.overrides);
    }
    case 'ingredients': {
      const c = byId(MAIN_INGREDIENTS, id);
      return !!c && inCategory(c, r, ctx.overrides);
    }
    case 'custom': {
      const f = ctx.customFilters.find((x) => x.id === id);
      return !!f && matchesRecipeFilter(f, r);
    }
  }
}

/** Passt das Gericht zur Auswahl? `except`: diese Gruppe nicht prüfen (für die Zahlen an den Knöpfen) */
export function matchesSelection(r: CatalogRecipe, sel: FacetSelection, ctx: FacetContext, except?: FacetGroup): boolean {
  return (Object.keys(sel) as FacetGroup[]).every(
    (g) => g === except || sel[g].length === 0 || sel[g].some((id) => matchesOption(g, id, r, ctx))
  );
}

/** Wie viele Gerichte es mit dieser Möglichkeit gäbe – bei sonst gleicher Auswahl der anderen Gruppen */
export function optionCount(recipes: CatalogRecipe[], group: FacetGroup, id: string, sel: FacetSelection, ctx: FacetContext): number {
  let n = 0;
  for (const r of recipes) if (matchesSelection(r, sel, ctx, group) && matchesOption(group, id, r, ctx)) n++;
  return n;
}

export const toggleOption = (sel: FacetSelection, group: FacetGroup, id: string): FacetSelection => ({
  ...sel,
  [group]: sel[group].includes(id) ? sel[group].filter((x) => x !== id) : [...sel[group], id],
});

export const selectionSize = (sel: FacetSelection) => Object.values(sel).reduce((n, ids) => n + ids.length, 0);

/** Name einer gewählten Möglichkeit (für die Chips unter der Suche) */
export function optionLabel(group: FacetGroup, id: string, customFilters: RecipeFilter[]): string {
  if (group === 'types') return TYPE_OPTIONS.find((t) => t.id === id)?.label ?? id;
  if (group === 'kinds') return byId(DISH_KINDS, id)?.label ?? id;
  if (group === 'ingredients') return byId(MAIN_INGREDIENTS, id)?.label ?? id;
  return customFilters.find((f) => f.id === id)?.name ?? id;
}
